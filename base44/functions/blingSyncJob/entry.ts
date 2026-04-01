import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_API = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const DELAY = 350;
const BATCH = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

async function getToken(base44) {
  const tokens = await base44.asServiceRole.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Nenhum token Bling encontrado. Configure a integração primeiro.');
  return tokens[0];
}

async function refreshToken(base44, tokenRecord) {
  const clientId = Deno.env.get('VITE_BLING_CLIENT_ID');
  const clientSecret = Deno.env.get('VITE_BLING_CLIENT_SECRET');
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokenRecord.refresh_token }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error_description || 'Erro ao renovar token Bling');
  const updated = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 21600) * 1000, scope: data.scope || tokenRecord.scope || '' };
  await base44.asServiceRole.entities.BlingToken.update(tokenRecord.id, updated);
  return updated;
}

async function getValidToken(base44) {
  let token = await getToken(base44);
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) token = await refreshToken(base44, token);
  return token.access_token;
}

async function blingGet(accessToken, path, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BLING_API}${path}`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
    });
    const data = await res.json();
    if (res.status === 429 || (data?.error?.type === 'TOO_MANY_REQUESTS')) {
      await sleep((attempt + 1) * 2000);
      continue;
    }
    if (!res.ok) throw new Error(data?.error?.description || data?.error?.message || JSON.stringify(data));
    return data;
  }
  throw new Error('Rate limit após múltiplas tentativas.');
}

function buildProductRecord(p, companyId, extraAtributos = {}) {
  const d = p.dimensoes || {};
  const fotos = Array.isArray(p.imagens) && p.imagens.length > 0 ? p.imagens : (p.imagemURL ? [p.imagemURL] : []);
  return clean({
    bling_id: String(p.id),
    sku: p.codigo || `BLING-${p.id}`,
    ean: p.gtin || undefined,
    nome: p.nome || '-',
    descricao: p.descricaoCurta || p.descricaoComplementar || undefined,
    marca: p.marca || undefined,
    unidade_medida: p.unidade || 'UN',
    ativo: p.situacao === 'A',
    origem: 'importacao',
    company_id: companyId || undefined,
    preco_venda: p.preco ? parseFloat(p.preco) : undefined,
    preco_custo: p.precoCusto || p.precoCompra ? parseFloat(p.precoCusto || p.precoCompra) : undefined,
    ncm: p.tributacao?.ncm || undefined,
    cest: p.tributacao?.cest || undefined,
    altura_cm: d.altura ? parseFloat(d.altura) : undefined,
    largura_cm: d.largura ? parseFloat(d.largura) : undefined,
    comprimento_cm: d.profundidade ? parseFloat(d.profundidade) : undefined,
    peso_bruto_kg: d.pesoBruto ? parseFloat(d.pesoBruto) : undefined,
    peso_liquido_kg: d.pesoLiquido ? parseFloat(d.pesoLiquido) : undefined,
    estoque_atual: parseFloat(p.estoque?.saldoFisico || 0),
    estoque_minimo: parseFloat(p.estoque?.minimo || 0),
    fotos: fotos.length > 0 ? fotos : undefined,
    atributos_extras: Object.keys(extraAtributos).length > 0 ? extraAtributos : undefined,
  });
}

// Atualiza o log com atividade corrente e contadores
async function updateLog(base44, logId, patch) {
  try { await base44.asServiceRole.entities.SyncLog.update(logId, patch); } catch { /* best effort */ }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body = {};
  try { body = await req.json(); } catch { /* sem body */ }

  const isScheduled = body?.scheduled === true || body?.automation !== undefined;
  if (!isScheduled) {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado.' }, { status: 403 });
    }
  }

  // Verifica token Bling
  let accessToken;
  try { accessToken = await getValidToken(base44); }
  catch (e) { return Response.json({ error: e.message, skipped: true }, { status: 200 }); }

  // Company ID
  let companyId = null;
  try {
    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1);
    if (companies?.length > 0) companyId = companies[0].id;
  } catch { /* sem empresa */ }

  // Cria log inicial
  const logRecord = await base44.asServiceRole.entities.SyncLog.create({
    tipo: 'completo', status: 'em_andamento',
    iniciado_em: new Date().toISOString(),
    company_id: companyId,
    produtos_atualizados: 0, produtos_criados: 0,
    estoques_atualizados: 0, vendas_criadas: 0, erros: 0,
    detalhes: 'Iniciando sincronização...',
  });
  const logId = logRecord.id;

  // Inicia o processamento assíncrono e retorna imediatamente
  // (o cliente usa polling no SyncLog para acompanhar o progresso)
  runSync(base44, accessToken, companyId, logId).catch(async (e) => {
    await updateLog(base44, logId, { status: 'erro', finalizado_em: new Date().toISOString(), detalhes: e.message });
  });

  return Response.json({ success: true, log_id: logId, message: 'Sincronização iniciada. Acompanhe o progresso em tempo real.' });
});

async function runSync(base44, accessToken, companyId, logId) {
  let prodCriados = 0, prodAtualizados = 0, estoqueAtualizados = 0, vendasCriadas = 0, erros = 0;

  // ── FASE 1: Buscar lista de produtos do Bling ─────────────────────────────
  await updateLog(base44, logId, { detalhes: '📦 Buscando lista de produtos no Bling...' });

  let allProducts = [];
  let pagina = 1;
  while (true) {
    const data = await blingGet(accessToken, `/produtos?pagina=${pagina}&limite=100&criterio=5&tipo=T`);
    const items = data?.data || [];
    allProducts = allProducts.concat(items);
    if (items.length < 100) break;
    pagina++;
    await sleep(DELAY);
  }

  await updateLog(base44, logId, { detalhes: `📦 ${allProducts.length} produtos encontrados no Bling. Carregando catálogo local...` });

  // Busca produtos locais para upsert inteligente
  const localProducts = companyId
    ? await base44.asServiceRole.entities.Product.filter({ company_id: companyId }, '-created_date', 2000)
    : await base44.asServiceRole.entities.Product.list('-created_date', 2000);

  const localByBlingId = {};
  for (const p of localProducts) { if (p.bling_id) localByBlingId[p.bling_id] = p; }

  const simples = allProducts.filter(p => p.tipo !== 'V' && !(p.variacoes?.length > 0));
  const comVariacao = allProducts.filter(p => p.tipo === 'V' || p.variacoes?.length > 0);

  // ── FASE 2: Estoques dos produtos simples ─────────────────────────────────
  await updateLog(base44, logId, { detalhes: `🏭 Buscando estoques de ${simples.length} produtos simples...` });

  const estoqueMap = {};
  for (let i = 0; i < simples.length; i += BATCH) {
    const lote = simples.slice(i, i + BATCH);
    await Promise.all(lote.map(async (p) => {
      try {
        const ed = await blingGet(accessToken, `/estoques?idProduto=${p.id}`);
        estoqueMap[p.id] = (ed?.data || []).reduce((a, x) => a + parseFloat(x.saldoFisico || 0), 0);
      } catch { estoqueMap[p.id] = 0; }
    }));
    if (i + BATCH < simples.length) await sleep(DELAY);
    if (i % 30 === 0 && i > 0) {
      await updateLog(base44, logId, { detalhes: `🏭 Estoques: ${i}/${simples.length} processados...` });
    }
  }

  // ── FASE 3: Upsert produtos simples ──────────────────────────────────────
  await updateLog(base44, logId, { detalhes: `💾 Salvando ${simples.length} produtos simples...` });

  for (let i = 0; i < simples.length; i++) {
    const p = simples[i];
    try {
      const record = { ...buildProductRecord(p, companyId), tipo: 'simples', estoque_atual: estoqueMap[p.id] ?? 0 };
      const existing = localByBlingId[String(p.id)];
      if (existing) { await base44.asServiceRole.entities.Product.update(existing.id, record); prodAtualizados++; }
      else { await base44.asServiceRole.entities.Product.create(record); prodCriados++; }
    } catch { erros++; }

    if (i % 20 === 0 && i > 0) {
      await updateLog(base44, logId, {
        produtos_criados: prodCriados, produtos_atualizados: prodAtualizados, erros,
        detalhes: `💾 Produtos simples: ${i}/${simples.length} salvos...`,
      });
    }
    await sleep(50);
  }

  // ── FASE 4: Detalhes dos produtos com variações ───────────────────────────
  if (comVariacao.length > 0) {
    await updateLog(base44, logId, {
      produtos_criados: prodCriados, produtos_atualizados: prodAtualizados,
      detalhes: `🔄 Buscando detalhes de ${comVariacao.length} produtos com variações...`,
    });

    const detalhesPai = [];
    for (let i = 0; i < comVariacao.length; i += BATCH) {
      const lote = comVariacao.slice(i, i + BATCH);
      const results = await Promise.all(lote.map(async (p) => {
        try { const det = await blingGet(accessToken, `/produtos/${p.id}`); return det?.data || p; }
        catch { return p; }
      }));
      detalhesPai.push(...results);
      if (i + BATCH < comVariacao.length) await sleep(DELAY);
      if (i % 9 === 0 && i > 0) {
        await updateLog(base44, logId, { detalhes: `🔄 Variações: ${i}/${comVariacao.length} carregados...` });
      }
    }

    // Estoques das variações
    for (const pai of detalhesPai) {
      for (let i = 0; i < (pai.variacoes || []).length; i += BATCH) {
        const lote = pai.variacoes.slice(i, i + BATCH);
        await Promise.all(lote.map(async (v) => {
          try {
            const ve = await blingGet(accessToken, `/estoques?idProduto=${v.id}`);
            estoqueMap[v.id] = (ve?.data || []).reduce((a, x) => a + parseFloat(x.saldoFisico || 0), 0);
          } catch { estoqueMap[v.id] = 0; }
        }));
        if (i + BATCH < pai.variacoes.length) await sleep(DELAY);
      }
    }

    await updateLog(base44, logId, { detalhes: `💾 Salvando produtos com variações...` });

    // Upsert pais + variações
    for (const p of detalhesPai) {
      try {
        const paiRecord = { ...buildProductRecord(p, companyId), tipo: 'pai', sku: p.codigo ? `PAI-${p.codigo}` : `PAI-${p.id}`, estoque_atual: 0 };
        let paiId;
        const existingPai = localByBlingId[String(p.id)];
        if (existingPai) { await base44.asServiceRole.entities.Product.update(existingPai.id, paiRecord); paiId = existingPai.id; prodAtualizados++; }
        else { const c = await base44.asServiceRole.entities.Product.create(paiRecord); paiId = c.id; prodCriados++; }

        for (const v of (p.variacoes || [])) {
          try {
            const atributosExtrasVar = {};
            (v.atributos || []).forEach(a => { atributosExtrasVar[a.nome] = a.valor; });
            const attrs = (v.atributos || []).map(a => `${a.nome}: ${a.valor}`).join(' | ');
            const varRecord = clean({
              ...buildProductRecord({ ...p, id: v.id, codigo: v.codigo, gtin: v.gtin, preco: v.preco || p.preco, precoCusto: v.precoCusto || p.precoCusto, imagens: v.imagemURL ? [v.imagemURL] : (p.imagens || []), dimensoes: v.dimensoes || p.dimensoes || {}, tributacao: v.tributacao || p.tributacao || {}, estoque: { saldoFisico: estoqueMap[v.id] ?? 0, minimo: v.estoque?.minimo || 0 } }, companyId, atributosExtrasVar),
              nome: `${p.nome}${attrs ? ` - ${attrs}` : ''}`,
              tipo: 'variacao', bling_pai_id: String(p.id), produto_pai_id: paiId,
              variacoes_atributos: attrs || undefined,
            });
            const existingVar = localByBlingId[String(v.id)];
            if (existingVar) { await base44.asServiceRole.entities.Product.update(existingVar.id, varRecord); prodAtualizados++; }
            else { await base44.asServiceRole.entities.Product.create(varRecord); prodCriados++; }
          } catch { erros++; }
        }
      } catch { erros++; }
      await sleep(50);
    }
  }

  // ── FASE 5: Sincronizar vendas recentes ───────────────────────────────────
  await updateLog(base44, logId, {
    produtos_criados: prodCriados, produtos_atualizados: prodAtualizados,
    detalhes: '🛒 Buscando vendas recentes no Bling (últimas 48h)...',
  });

  const dataInicio = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  let allOrders = [];
  let op = 1;
  while (true) {
    const data = await blingGet(accessToken, `/pedidos/vendas?pagina=${op}&limite=100&dataInicio=${dataInicio}`);
    const items = data?.data || [];
    allOrders = allOrders.concat(items);
    if (items.length < 100) break;
    op++;
    await sleep(DELAY);
  }

  const existingSales = companyId
    ? await base44.asServiceRole.entities.Sale.filter({ company_id: companyId }, '-created_date', 1000)
    : await base44.asServiceRole.entities.Sale.list('-created_date', 1000);
  const existingBlingIds = new Set(existingSales.map(s => s.marketplace_order_id).filter(Boolean));

  const CANAL_MAP = { 'Loja Virtual': 'ecommerce', 'Mercado Livre': 'mercado_livre', 'Shopee': 'shopee', 'Amazon': 'amazon', 'B2B': 'b2b' };
  const STATUS_MAP = { 0: 'pendente', 1: 'pendente', 3: 'confirmada', 4: 'confirmada', 6: 'cancelada', 9: 'devolvida' };

  for (const order of allOrders) {
    if (existingBlingIds.has(String(order.id))) continue;
    try {
      const items = (order.itens || []).map(item => ({ product_name: item.produto?.nome || '', sku: item.produto?.codigo || '', quantidade: parseFloat(item.quantidade || 1), preco_unitario: parseFloat(item.valor || 0), desconto: 0, total: parseFloat(item.quantidade || 1) * parseFloat(item.valor || 0) }));
      await base44.asServiceRole.entities.Sale.create(clean({ canal: CANAL_MAP[order.loja?.nome] || 'outro', status: STATUS_MAP[order.situacao?.id] || 'pendente', client_name: order.contato?.nome || undefined, subtotal: parseFloat(order.totalProdutos || order.total || 0), desconto: parseFloat(order.desconto?.valor || 0), frete: parseFloat(order.transporte?.frete || 0), total: parseFloat(order.totalProdutos || order.total || 0), forma_pagamento: 'marketplace', marketplace_order_id: String(order.id), company_id: companyId || undefined, items }));
      vendasCriadas++;
    } catch { erros++; }
  }

  // ── FINALIZAR ─────────────────────────────────────────────────────────────
  await base44.asServiceRole.entities.SyncLog.update(logId, {
    status: 'sucesso',
    finalizado_em: new Date().toISOString(),
    produtos_criados: prodCriados,
    produtos_atualizados: prodAtualizados,
    estoques_atualizados: estoqueAtualizados,
    vendas_criadas: vendasCriadas,
    erros,
    detalhes: `✅ Concluído! Produtos: +${prodCriados} criados, ~${prodAtualizados} atualizados. Vendas: ${vendasCriadas} importadas. Erros: ${erros}.`,
  });
}