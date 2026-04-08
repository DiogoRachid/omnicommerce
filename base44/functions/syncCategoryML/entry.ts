import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ML_API = 'https://api.mercadolibre.com';

async function getMLToken(base44) {
  // Tenta buscar token ML do banco
  const tokens = await base44.asServiceRole.entities.MercadoLivreToken.list();
  if (!tokens || tokens.length === 0) return null;
  return tokens[0].access_token;
}

async function predictCategory(nome, accessToken) {
  const url = `${ML_API}/sites/MLB/category_predictor/predict?title=${encodeURIComponent(nome)}`;
  const headers = accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || null;
}

async function fetchCategoryAttributes(categoryId, accessToken) {
  const url = `${ML_API}/categories/${categoryId}/attributes`;
  const headers = accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data || [];
}

function filterRequiredAttributes(attributes) {
  return attributes
    .filter(attr => attr.tags?.required || attr.tags?.catalog_required)
    .map(attr => ({
      id: attr.id,
      nome: attr.name,
      tipo: attr.value_type || 'string',
      obrigatorio: !!attr.tags?.required,
      catalog_required: !!attr.tags?.catalog_required,
      valores_permitidos: (attr.values || []).map(v => ({ id: v.id, nome: v.name })),
      hint: attr.hint || '',
    }));
}

async function syncCategory(base44, categoryRecord, accessToken) {
  const nome = categoryRecord.nome;
  if (!nome) return { success: false, error: 'Nome vazio' };

  // 1. Prediz o category_id do ML
  const mlCategoryId = await predictCategory(nome, accessToken);
  if (!mlCategoryId) return { success: false, error: 'Não foi possível identificar categoria no ML' };

  // 2. Busca atributos
  const allAttributes = await fetchCategoryAttributes(mlCategoryId, accessToken);

  // 3. Filtra obrigatórios
  const required = filterRequiredAttributes(allAttributes);

  // 4. Atualiza o banco com os campos ML
  const camposML = required.map(attr => ({
    id: attr.id,
    nome: attr.nome,
    tipo: attr.tipo === 'number' ? 'number' : attr.tipo === 'boolean' ? 'boolean' : attr.valores_permitidos.length > 0 ? 'lista' : 'texto',
    obrigatorio: attr.obrigatorio || attr.catalog_required,
    opcoes: attr.valores_permitidos.map(v => v.nome),
    hint: attr.hint,
  }));

  const camposMarketplace = categoryRecord.campos_marketplace || {};
  camposMarketplace.mercado_livre = camposML;

  await base44.asServiceRole.entities.ProductCategory.update(categoryRecord.id, {
    campos_marketplace: camposMarketplace,
    ml_category_id: mlCategoryId,
  });

  return { success: true, mlCategoryId, requiredCount: required.length };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}

  const action = body.action || body?.payload?.action || 'sync_one';
  const payload = body.payload || body;

  const accessToken = await getMLToken(base44);

  // Sincroniza uma categoria específica
  if (action === 'sync_one') {
    const { category_id } = payload;
    if (!category_id) return Response.json({ error: 'category_id obrigatório' }, { status: 400 });

    const cats = await base44.asServiceRole.entities.ProductCategory.filter({ id: category_id });
    if (!cats || cats.length === 0) return Response.json({ error: 'Categoria não encontrada' }, { status: 404 });

    const result = await syncCategory(base44, cats[0], accessToken);
    return Response.json(result);
  }

  // Sincroniza todas as categorias (para o scheduled job)
  if (action === 'sync_all') {
    const cats = await base44.asServiceRole.entities.ProductCategory.list();
    const results = [];
    for (const cat of cats) {
      try {
        const r = await syncCategory(base44, cat, accessToken);
        results.push({ id: cat.id, nome: cat.nome, ...r });
      } catch (e) {
        results.push({ id: cat.id, nome: cat.nome, success: false, error: e.message });
      }
      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    const ok = results.filter(r => r.success).length;
    const err = results.filter(r => !r.success).length;
    return Response.json({ synced: ok, errors: err, results });
  }

  return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
});