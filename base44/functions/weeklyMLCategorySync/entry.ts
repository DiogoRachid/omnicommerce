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
  // Scheduled job — sem usuário autenticado
  const base44 = createClientFromRequest(req);

  console.log('[weeklyMLCategorySync] Iniciando sincronização semanal de categorias...');

  const cats = await base44.asServiceRole.entities.ProductCategory.list();
  console.log(`[weeklyMLCategorySync] ${cats.length} categorias encontradas.`);

  const accessToken = await getMLToken(base44);
  const results = [];

  for (const cat of cats) {
    if (!cat.nome?.trim()) continue;
    try {
      const mlCategoryId = await predictCategory(cat.nome, accessToken);
      if (!mlCategoryId) {
        results.push({ nome: cat.nome, success: false, reason: 'sem predição ML' });
        continue;
      }

      const allAttrs = await fetchCategoryAttributes(mlCategoryId, accessToken);
      const camposML = buildCamposML(allAttrs);

      const camposMarketplace = cat.campos_marketplace || {};
      camposMarketplace.mercado_livre = camposML;

      await base44.asServiceRole.entities.ProductCategory.update(cat.id, {
        campos_marketplace: camposMarketplace,
        ml_category_id: mlCategoryId,
      });

      results.push({ nome: cat.nome, success: true, mlCategoryId, requiredCount: camposML.length });
      console.log(`[weeklyMLCategorySync] OK: "${cat.nome}" → ${mlCategoryId} (${camposML.length} campos)`);
    } catch (e) {
      results.push({ nome: cat.nome, success: false, error: e.message });
      console.error(`[weeklyMLCategorySync] ERRO em "${cat.nome}": ${e.message}`);
    }

    // Rate limiting: 300ms entre requests
    await new Promise(r => setTimeout(r, 300));
  }

  const ok = results.filter(r => r.success).length;
  const err = results.filter(r => !r.success).length;
  console.log(`[weeklyMLCategorySync] Concluído: ${ok} sucesso, ${err} erros.`);

  return Response.json({ synced: ok, errors: err, total: cats.length, results });
});