import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ML_API = 'https://api.mercadolibre.com';

async function getMLToken(base44) {
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
  return await res.json() || [];
}

function buildCamposML(attributes) {
  return attributes
    .filter(attr => attr.tags?.required || attr.tags?.catalog_required)
    .map(attr => ({
      id: attr.id,
      nome: attr.name,
      tipo: attr.value_type === 'number' ? 'number' : attr.value_type === 'boolean' ? 'boolean' : (attr.values?.length > 0 ? 'lista' : 'texto'),
      obrigatorio: !!(attr.tags?.required || attr.tags?.catalog_required),
      opcoes: (attr.values || []).map(v => v.name),
      hint: attr.hint || '',
    }));
}

Deno.serve(async (req) => {
  // Esta função é invocada pela automação de entidade (sem usuário autenticado)
  const base44 = createClientFromRequest(req);

  let body = {};
  try { body = await req.json(); } catch {}

  const event = body.event || {};
  const data = body.data || {};

  // Só processa create ou update com mudança no nome
  if (event.type === 'update') {
    const changedFields = body.changed_fields || [];
    if (!changedFields.includes('nome')) {
      return Response.json({ skipped: true, reason: 'nome não alterado' });
    }
  }

  const categoryId = event.entity_id || data.id;
  if (!categoryId) return Response.json({ error: 'entity_id não encontrado' }, { status: 400 });

  // Busca o registro atualizado
  let cats;
  if (data && data.nome) {
    cats = [data];
  } else {
    cats = await base44.asServiceRole.entities.ProductCategory.filter({ id: categoryId });
  }
  if (!cats || cats.length === 0) return Response.json({ error: 'Categoria não encontrada' });

  const cat = cats[0];
  const nome = cat.nome;
  if (!nome?.trim()) return Response.json({ skipped: true, reason: 'Nome vazio' });

  const accessToken = await getMLToken(base44);

  // Prediz categoria ML
  const mlCategoryId = await predictCategory(nome, accessToken);
  if (!mlCategoryId) return Response.json({ success: false, error: 'ML não retornou categoria' });

  // Busca atributos
  const allAttrs = await fetchCategoryAttributes(mlCategoryId, accessToken);
  const camposML = buildCamposML(allAttrs);

  // Atualiza no banco
  const camposMarketplace = cat.campos_marketplace || {};
  camposMarketplace.mercado_livre = camposML;

  await base44.asServiceRole.entities.ProductCategory.update(cat.id, {
    campos_marketplace: camposMarketplace,
    ml_category_id: mlCategoryId,
  });

  console.log(`[syncCategoryML] Categoria "${nome}" → ML: ${mlCategoryId}, ${camposML.length} campos obrigatórios salvos.`);
  return Response.json({ success: true, mlCategoryId, requiredCount: camposML.length });
});