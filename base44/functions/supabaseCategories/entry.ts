import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

function parseOpcoes(valores) {
  if (!valores) return [];
  if (Array.isArray(valores)) return valores.map(String);
  if (typeof valores === 'string') return valores.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

function detectTipo(a) {
  const opcoes = parseOpcoes(a.valores_possiveis);
  if (opcoes.length > 0) return 'lista';
  const nome = (a.nome_atributo || '').toLowerCase();
  if (['largura', 'altura', 'peso', 'comprimento', 'voltagem', 'wattagem', 'potencia'].some(k => nome.includes(k))) return 'number';
  return 'texto';
}

async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, payload = {} } = body;

  if (action === 'listCategorias') {
    // By default load nivel=1 only for performance
    const { nivel = 1, search = '', offset = 0, limit = 1000 } = payload;
    let path;
    if (search) {
      path = `categorias?select=id,nome,nivel&nome=ilike.*${encodeURIComponent(search)}*&order=nome&limit=${limit}&offset=${offset}`;
    } else {
      path = `categorias?select=id,nome,nivel&nivel=eq.${nivel}&order=nome&limit=${limit}&offset=${offset}`;
    }
    const data = await supabaseFetch(path);
    return Response.json({ data, offset, limit, count: data.length });
  }

  if (action === 'listCategoriasPaginated') {
    // Fetch ALL categorias in batches (for select-all use case)
    let todas = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      const batch = await supabaseFetch(
        `categorias?select=id,nome,nivel&order=nome&limit=${limit}&offset=${offset}`
      );
      todas = todas.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    return Response.json({ data: todas, total: todas.length });
  }

  if (action === 'getAtributos') {
    const { categoria_id } = payload;

    // Fetch direct attributes
    const direct = await supabaseFetch(
      `atributos?select=id,nome_atributo,obrigatorio,valores_possiveis,categoria_id&categoria_id=eq.${categoria_id}&limit=5000`
    );

    // Also fetch attributes from child categories (nivel 2/3) to get tamanho, cor, etc.
    const children = await supabaseFetch(
      `categorias?select=id&categoria_pai_id=eq.${categoria_id}&limit=500`
    ).catch(() => []);

    let childAttrs = [];
    if (children.length > 0) {
      const childIds = children.map(c => c.id);
      // Fetch in batches to avoid URL length limits
      for (const childId of childIds.slice(0, 20)) {
        const attrs = await supabaseFetch(
          `atributos?select=id,nome_atributo,obrigatorio,valores_possiveis,categoria_id&categoria_id=eq.${childId}&limit=500`
        ).catch(() => []);
        childAttrs = childAttrs.concat(attrs);
      }
    }

    // Merge and deduplicate by nome_atributo
    const allAttrs = [...direct, ...childAttrs];
    const seen = new Set();
    const data = allAttrs.filter(a => {
      const key = a.nome_atributo?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({ data });
  }

  if (action === 'importarCategoria') {
    const { categoria, atributos, company_id } = payload;

    // Save to ProductCategory entity
    const existing = await base44.asServiceRole.entities.ProductCategory.filter({ nome: categoria.nome });

    let catRecord;
    if (existing && existing.length > 0) {
      catRecord = existing[0];
    } else {
      const variacoesPadrao = (atributos || []).map(a => ({
        nome: a.nome_atributo,
        tipo: 'texto',
        obrigatorio: !!a.obrigatorio,
        opcoes: a.valores_possiveis
          ? (typeof a.valores_possiveis === 'string'
              ? a.valores_possiveis.split(',').map(v => v.trim()).filter(Boolean)
              : a.valores_possiveis)
          : [],
      }));

      // Map attributes to ML marketplace fields
      const mlFields = (atributos || []).map(a => ({
        id: String(a.id),
        nome: a.nome_atributo,
        tipo: detectTipo(a),
        obrigatorio: !!a.obrigatorio,
        opcoes: parseOpcoes(a.valores_possiveis),
        hint: '',
      }));

      catRecord = await base44.asServiceRole.entities.ProductCategory.create({
        nome: categoria.nome,
        descricao: `Categoria importada do banco global`,
        ml_category_id: String(categoria.id),
        variacoes_padrao: variacoesPadrao,
        campos_marketplace: {
          mercado_livre: mlFields,
          shopee: mlFields,
          amazon: mlFields,
          magalu: mlFields,
        },
        ativo: true,
      });
    }

    return Response.json({ success: true, id: catRecord.id });
  }

  return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
});