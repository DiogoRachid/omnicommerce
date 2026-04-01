import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_API = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const DELAY = 400;
const BATCH = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Erro ao renovar token Bling');
  }

  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 21600) * 1000,
    scope: data.scope || tokenRecord.scope || '',
  };
  await base44.asServiceRole.entities.BlingToken.update(tokenRecord.id, updated);
  return updated;
}

async function getValidToken(base44) {
  let token = await getToken(base44);
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    token = await refreshToken(base44, token);
  }
  return token.access_token;
}

async function blingRequest(accessToken, path, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BLING_API}${path}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    const data = await res.json();
    if (res.status === 429 || (data?.error?.type === 'TOO_MANY_REQUESTS') ||
      (data?.error?.description || '').includes('limite')) {
      await sleep((attempt + 1) * 2000);
      continue;
    }
    if (!res.ok) {
      throw new Error(data?.error?.description || data?.error?.message || JSON.stringify(data));
    }
    return data;
  }
  throw new Error('Rate limit atingido após múltiplas tentativas.');
}

// ── Helpers de mapeamento (reaproveitados do BlingImportDialog) ─────────────

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

function buildProductRecord(p, companyId, extraAtributos = {}) {
  const d = p.dimensoes || {};
  const fotos = Array.isArray(p.imagens) && p.imagens.length > 0
    ? p.imagens
    : (p.imagemURL ? [p.imagemURL] : []);

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

// ── SYNC: Produtos ──────────────────────────────────────────────────────────

async function syncProdutos(base44, accessToken, companyId, log) {
  let criados = 0, atualizados = 0, erros = 0;

  // Busca todos os produtos do Bling com paginação
  let allProducts = [];
  let pagina = 1;
  while (true) {
    const data = await blingRequest(accessToken, `/produtos?pagina=${pagina}&limite=100&criterio=5&tipo=T`);
    const items = data?.data || [];
    allProducts = allProducts.concat(items);
    if (items.length < 100) break;
    pagina++;
    await sleep(DELAY);
  }

  // Busca todos os produtos locais desta empresa para comparar
  const localProducts = companyId
    ? await base44.asServiceRole.entities.Product.filter({ company_id: companyId }, '-created_date', 2000)
    : await base44.asServiceRole.entities.Product.list('-created_date', 2000);

  const localByBlingId = {};
  for (const p of localProducts) {
    if (p.bling_id) localByBlingId[p.bling_id] = p;
  }

  // Separa simples de com variações
  const simples = allProducts.filter(p => p.tipo !== 'V' && !(p.variacoes?.length > 0));
  const comVariacao = allProducts.filter(p => p.tipo === 'V' || p.variacoes?.length > 0);

  // Estoques dos simples
  const estoqueMap = {};
  for (let i = 0; i < simples.length; i += BATCH) {
    const lote = simples.slice(i, i + BATCH);
    await Promise.all(lote.map(async (p) => {
      try {
        const ed = await blingRequest(accessToken, `/estoques?idProduto=${p.id}`);
        estoqueMap[p.id] = (ed?.data || []).reduce((a, x) => a + parseFloat(x.saldoFisico || 0), 0);
      } catch { estoqueMap[p.id] = 0; }
    }));
    if (i + BATCH < simples.length) await sleep(DELAY);
  }

  // Upsert produtos simples
  for (const p of simples) {
    try {
      const record = {
        ...buildProductRecord(p, companyId),
        tipo: 'simples',
        estoque_atual: estoqueMap[p.id] ?? 0,
      };
      const existing = localByBlingId[String(p.id)];
      if (existing) {
        await base44.asServiceRole.entities.Product.update(existing.id, record);
        atualizados++;
      } else {
        await base44.asServiceRole.entities.Product.create(record);
        criados++;
      }
    } catch { erros++; }
  }

  // Detalhes dos produtos com variações em lotes
  const detalhesPai = [];
  for (let i = 0; i < comVariacao.length; i += BATCH) {
    const lote = comVariacao.slice(i, i + BATCH);
    const results = await Promise.all(lote.map(async (p) => {
      try {
        const det = await blingRequest(accessToken, `/produtos/${p.id}`);
        return det?.data || p;
      } catch { return p; }
    }));
    detalhesPai.push(...results);
    if (i + BATCH < comVariacao.length) await sleep(DELAY);
  }

  // Estoques das variações
  for (const pai of detalhesPai) {
    for (let i = 0; i < (pai.variacoes || []).length; i += BATCH) {
      const lote = pai.variacoes.slice(i, i + BATCH);
      await Promise.all(lote.map(async (v) => {
        try {
          const ve = await blingRequest(accessToken, `/estoques?idProduto=${v.id}`);
          estoqueMap[v.id] = (ve?.data || []).reduce((a, x) => a + parseFloat(x.saldoFisico || 0), 0);
        } catch { estoqueMap[v.id] = 0; }
      }));
      if (i + BATCH < pai.variacoes.length) await sleep(DELAY);
    }
  }

  // Upsert pais + variações
  for (const p of detalhesPai) {
    try {
      const paiRecord = {
        ...buildProductRecord(p, companyId),
        tipo: 'pai',
        sku: p.codigo ? `PAI-${p.codigo}` : `PAI-${p.id}`,
        estoque_atual: 0,
      };
      let paiId;
      const existingPai = localByBlingId[String(p.id)];
      if (existingPai) {
        await base44.asServiceRole.entities.Product.update(existingPai.id, paiRecord);
        paiId = existingPai.id;
        atualizados++;
      } else {
        const created = await base44.asServiceRole.entities.Product.create(paiRecord);
        paiId = created.id;
        criados++;
      }

      for (const v of (p.variacoes || [])) {
        try {
          const atributosExtrasVar = {};
          (v.atributos || []).forEach(a => { atributosExtrasVar[a.nome] = a.valor; });
          const attrs = (v.atributos || []).map(a => `${a.nome}: ${a.valor}`).join(' | ');
          const nomeVar = `${p.nome}${attrs ? ` - ${attrs}` : ''}`;

          const varRecord = clean({
            ...buildProductRecord(
              { ...p, id: v.id, codigo: v.codigo, gtin: v.gtin, preco: v.preco || p.preco,
                precoCusto: v.precoCusto || p.precoCusto, imagens: v.imagemURL ? [v.imagemURL] : (p.imagens || []),
                dimensoes: v.dimensoes || p.dimensoes || {}, tributacao: v.tributacao || p.tributacao || {},
                estoque: { saldoFisico: estoqueMap[v.id] ?? 0, minimo: v.estoque?.minimo || 0 } },
              companyId,
              atributosExtrasVar
            ),
            nome: nomeVar,
            tipo: 'variacao',
            bling_pai_id: String(p.id),
            produto_pai_id: paiId,
            variacoes_atributos: attrs || undefined,
          });

          const existingVar = localByBlingId[String(v.id)];
          if (existingVar) {
            await base44.asServiceRole.entities.Product.update(existingVar.id, varRecord);
            atualizados++;
          } else {
            await base44.asServiceRole.entities.Product.create(varRecord);
            criados++;
          }
        } catch { erros++; }
      }
    } catch { erros++; }
  }

  return { criados, atualizados, erros };
}

// ── SYNC: Estoque (atualização rápida apenas do saldo) ───────────────────────

async function syncEstoque(base44, accessToken, companyId) {
  let atualizados = 0, erros = 0;

  const localProducts = companyId
    ? await base44.asServiceRole.entities.Product.filter({ company_id: companyId }, '-created_date', 2000)
    : await base44.asServiceRole.entities.Product.list('-created_date', 2000);

  // Apenas produtos com bling_id e que não são pai (pais não têm estoque direto)
  const targets = localProducts.filter(p => p.bling_id && p.tipo !== 'pai');

  for (let i = 0; i < targets.length; i += BATCH) {
    const lote = targets.slice(i, i + BATCH);
    await Promise.all(lote.map(async (p) => {
      try {
        const ed = await blingRequest(accessToken, `/estoques?idProduto=${p.bling_id}`);
        const saldo = (ed?.data || []).reduce((a, x) => a + parseFloat(x.saldoFisico || 0), 0);
        if (saldo !== p.estoque_atual) {
          await base44.asServiceRole.entities.Product.update(p.id, { estoque_atual: saldo });
          atualizados++;
        }
      } catch { erros++; }
    }));
    if (i + BATCH < targets.length) await sleep(DELAY);
  }

  return { atualizados, erros };
}

// ── SYNC: Vendas (pedidos recentes do Bling → Sale) ─────────────────────────

async function syncVendas(base44, accessToken, companyId) {
  let criadas = 0, erros = 0;

  // Busca pedidos das últimas 48h (para não reprocessar tudo)
  const dataInicio = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  let allOrders = [];
  let pagina = 1;
  while (true) {
    const data = await blingRequest(accessToken, `/pedidos/vendas?pagina=${pagina}&limite=100&dataInicio=${dataInicio}`);
    const items = data?.data || [];
    allOrders = allOrders.concat(items);
    if (items.length < 100) break;
    pagina++;
    await sleep(DELAY);
  }

  // Busca vendas existentes para evitar duplicatas (por marketplace_order_id = bling id)
  const existingSales = companyId
    ? await base44.asServiceRole.entities.Sale.filter({ company_id: companyId }, '-created_date', 1000)
    : await base44.asServiceRole.entities.Sale.list('-created_date', 1000);

  const existingBlingIds = new Set(existingSales.map(s => s.marketplace_order_id).filter(Boolean));

  const CANAL_MAP = {
    'Loja Virtual': 'ecommerce',
    'Mercado Livre': 'mercado_livre',
    'Shopee': 'shopee',
    'Amazon': 'amazon',
    'B2B': 'b2b',
  };

  const STATUS_MAP = {
    0: 'pendente', 1: 'pendente', 3: 'confirmada', 4: 'confirmada',
    6: 'cancelada', 9: 'devolvida',
  };

  for (const order of allOrders) {
    const blingOrderId = String(order.id);
    if (existingBlingIds.has(blingOrderId)) continue;

    try {
      const items = (order.itens || []).map(item => ({
        product_name: item.produto?.nome || item.descricao || '',
        sku: item.produto?.codigo || '',
        quantidade: parseFloat(item.quantidade || 1),
        preco_unitario: parseFloat(item.valor || 0),
        desconto: 0,
        total: parseFloat(item.quantidade || 1) * parseFloat(item.valor || 0),
      }));

      const total = parseFloat(order.totalProdutos || order.total || 0);
      const canal = CANAL_MAP[order.loja?.nome] || 'outro';
      const status = STATUS_MAP[order.situacao?.id] || 'pendente';

      await base44.asServiceRole.entities.Sale.create(clean({
        canal,
        status,
        client_name: order.contato?.nome || undefined,
        subtotal: total,
        desconto: parseFloat(order.desconto?.valor || 0),
        frete: parseFloat(order.transporte?.frete || 0),
        total,
        forma_pagamento: 'marketplace',
        marketplace_order_id: blingOrderId,
        company_id: companyId || undefined,
        items,
      }));
      criadas++;
    } catch { erros++; }
  }

  return { criadas, erros };
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Suporte a chamada por automation (sem usuário autenticado) ou manual (admin)
  let isScheduled = false;
  try {
    const body = await req.clone().json();
    isScheduled = body?.scheduled === true || body?.automation !== undefined;
  } catch { /* não é JSON ou sem body */ }

  if (!isScheduled) {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas admins podem executar manualmente.' }, { status: 403 });
    }
  }

  // Verifica se há token Bling configurado
  let accessToken;
  try {
    accessToken = await getValidToken(base44);
  } catch (e) {
    return Response.json({ error: e.message, skipped: true }, { status: 200 });
  }

  // Company ID: pega o da primeira empresa registrada ou null (todos)
  let companyId = null;
  try {
    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1);
    if (companies && companies.length > 0) companyId = companies[0].id;
  } catch { /* sem empresa, usa null */ }

  // Cria log de sync
  const logRecord = await base44.asServiceRole.entities.SyncLog.create({
    tipo: 'completo',
    status: 'em_andamento',
    iniciado_em: new Date().toISOString(),
    company_id: companyId,
    produtos_atualizados: 0,
    produtos_criados: 0,
    estoques_atualizados: 0,
    vendas_criadas: 0,
    erros: 0,
  });

  try {
    // 1. Sincroniza produtos (inclui estoques embutidos)
    const prodResult = await syncProdutos(base44, accessToken, companyId, logRecord);

    // 2. Sincroniza estoque adicional (produtos que já existiam e não foram recriados)
    const estResult = await syncEstoque(base44, accessToken, companyId);

    // 3. Sincroniza vendas recentes
    const vendasResult = await syncVendas(base44, accessToken, companyId);

    const totalErros = prodResult.erros + estResult.erros + vendasResult.erros;

    await base44.asServiceRole.entities.SyncLog.update(logRecord.id, {
      status: totalErros === 0 ? 'sucesso' : 'sucesso',
      finalizado_em: new Date().toISOString(),
      produtos_criados: prodResult.criados,
      produtos_atualizados: prodResult.atualizados,
      estoques_atualizados: estResult.atualizados,
      vendas_criadas: vendasResult.criadas,
      erros: totalErros,
      detalhes: `Produtos: +${prodResult.criados} criados, ~${prodResult.atualizados} atualizados. Estoques: ${estResult.atualizados} atualizados. Vendas: ${vendasResult.criadas} importadas.`,
    });

    return Response.json({
      success: true,
      produtos_criados: prodResult.criados,
      produtos_atualizados: prodResult.atualizados,
      estoques_atualizados: estResult.atualizados,
      vendas_criadas: vendasResult.criadas,
      erros: totalErros,
    });
  } catch (e) {
    await base44.asServiceRole.entities.SyncLog.update(logRecord.id, {
      status: 'erro',
      finalizado_em: new Date().toISOString(),
      detalhes: e.message,
    });
    return Response.json({ error: e.message }, { status: 500 });
  }
});