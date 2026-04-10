import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

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
    const data = await supabaseFetch(
      `atributos?select=id,nome_atributo,obrigatorio,valores_possiveis,categoria_id&categoria_id=eq.${categoria_id}&limit=5000`
    );
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
      const variacoesPadrao = (atributos || []).slice(0, 50).map(a => ({
        nome: a.nome_atributo,
        tipo: 'texto',
        obrigatorio: !!a.obrigatorio,
        opcoes: a.valores_possiveis
          ? (typeof a.valores_possiveis === 'string'
              ? a.valores_possiveis.split(',').map(v => v.trim()).filter(Boolean)
              : a.valores_possiveis)
          : [],
      }));

      catRecord = await base44.asServiceRole.entities.ProductCategory.create({
        nome: categoria.nome,
        descricao: `Nível ${categoria.nivel || 1}`,
        variacoes_padrao: variacoesPadrao,
        ativo: true,
      });
    }

    return Response.json({ success: true, id: catRecord.id });
  }

  return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
});