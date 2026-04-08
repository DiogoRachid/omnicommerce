import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_API = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

async function getToken(base44) {
  const tokens = await base44.asServiceRole.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Nenhum token Bling encontrado.');
  return tokens[0];
}

async function doRefreshToken(base44, tokenRecord) {
  const clientId = Deno.env.get('BLING_CLIENT_ID');
  const clientSecret = Deno.env.get('BLING_CLIENT_SECRET');
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
    throw new Error(data.error_description || data.error || 'Erro ao renovar token');
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

async function getValidAccessToken(base44) {
  let token = await getToken(base44);
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    token = await doRefreshToken(base44, token);
  }
  return token.access_token;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function blingRequest(accessToken, path, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BLING_API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}: ${res.statusText}`);
      }
      data = {};
    }

    if (res.status === 429 || (data?.error?.type === 'TOO_MANY_REQUESTS') ||
        (data?.error?.description || '').includes('limite')) {
      // Rate limit: espera antes de tentar novamente
      const wait = (attempt + 1) * 1500;
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      // Isso vai pegar o pacote inteiro de erro do Bling e jogar na tela como texto!
      throw new Error(`[ERRO BRUTO BLING]: ${JSON.stringify(data)}`);
    }
    return data;
  }
  throw new Error('Rate limit atingido após múltiplas tentativas.');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // O SDK do Base44 pode encapsular o payload em diferentes formatos
  const action = body.action || body?.payload?.action;
  const payload = body.payload || body?.payload?.payload || {};

  try {

  if (action === 'status') {
    const tokens = await base44.asServiceRole.entities.BlingToken.list();
    if (!tokens || tokens.length === 0) return Response.json({ connected: false });
    const t = tokens[0];
    return Response.json({
      connected: true,
      expired: t.expires_at ? Date.now() > t.expires_at : false,
      expires_at: t.expires_at,
      scope: t.scope,
    });
  }

  if (action === 'exchange') {
    const { code, redirect_uri } = payload;
    const clientId = Deno.env.get('BLING_CLIENT_ID');
    const clientSecret = Deno.env.get('BLING_CLIENT_SECRET');
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const res = await fetch(BLING_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }).toString(),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      return Response.json({ error: data.error_description || data.error || JSON.stringify(data) }, { status: 400 });
    }

    const tokenPayload = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 21600) * 1000,
      scope: data.scope || '',
    };

    const existing = await base44.asServiceRole.entities.BlingToken.list();
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.BlingToken.update(existing[0].id, tokenPayload);
    } else {
      await base44.asServiceRole.entities.BlingToken.create(tokenPayload);
    }

    return Response.json({ success: true, expires_at: tokenPayload.expires_at, scope: tokenPayload.scope });
  }

  if (action === 'refresh') {
    const token = await getToken(base44);
    const updated = await doRefreshToken(base44, token);
    return Response.json({ success: true, expires_at: updated.expires_at });
  }

  if (action === 'disconnect') {
    const tokens = await base44.asServiceRole.entities.BlingToken.list();
    for (const t of tokens) {
      await base44.asServiceRole.entities.BlingToken.delete(t.id);
    }
    return Response.json({ success: true });
  }

  if (action === 'listProducts') {
    const accessToken = await getValidAccessToken(base44);
    const pagina = payload.pagina || 1;
    const limite = payload.limite || 100;
    const data = await blingRequest(accessToken, `/produtos?pagina=${pagina}&limite=${limite}&criterio=5&tipo=T`);
    return Response.json(data);
  }

  if (action === 'listOrders') {
    const accessToken = await getValidAccessToken(base44);
    const pagina = payload.pagina || 1;
    const limite = payload.limite || 100;
    const data = await blingRequest(accessToken, `/pedidos/vendas?pagina=${pagina}&limite=${limite}`);
    return Response.json(data);
  }

  if (action === 'createProduct') {
    const accessToken = await getValidAccessToken(base44);
    const data = await blingRequest(accessToken, '/produtos', {
      method: 'POST',
      body: JSON.stringify(payload.produto),
    });
    return Response.json(data);
  }

  if (action === 'listProductsFull') {
    const accessToken = await getValidAccessToken(base44);
    const DELAY = 400;

    // 1. Busca todos os produtos com paginação (listagem já traz campos básicos + variacoes resumidas)
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

    // 2. Para produtos com variações, buscar detalhe individual (necessário para obter lista de variações)
    //    Para produtos simples, usar dados da listagem diretamente
    const produtosComVariacao = allProducts.filter(p => p.formato === 'V' || p.variacoes?.length > 0);
    const produtosSimplesBrutos = allProducts.filter(p => p.formato !== 'V' && !(p.variacoes?.length > 0));

    // Busca detalhes apenas dos produtos pai (com variações) - lotes de 3
    const BATCH = 3;
    const detalhesPai = [];
    for (let i = 0; i < produtosComVariacao.length; i += BATCH) {
      const lote = produtosComVariacao.slice(i, i + BATCH);
      const results = await Promise.all(
        lote.map(async (p) => {
          try {
            const det = await blingRequest(accessToken, `/produtos/${p.id}`);
            return det?.data || p;
          } catch {
            return p;
          }
        })
      );
      detalhesPai.push(...results);
      if (i + BATCH < produtosComVariacao.length) await sleep(DELAY);
    }

    // 3. Busca estoques dos produtos simples em lotes de 3
    const estoqueMap = {};
    for (let i = 0; i < produtosSimplesBrutos.length; i += BATCH) {
      const lote = produtosSimplesBrutos.slice(i, i + BATCH);
      await Promise.all(
        lote.map(async (p) => {
          try {
            const estoqueData = await blingRequest(accessToken, `/estoques?idProduto=${p.id}`);
            const itens = estoqueData?.data || [];
            estoqueMap[p.id] = itens.reduce((acc, item) => acc + parseFloat(item.saldoFisico || item.saldoFisicoTotal || 0), 0);
          } catch {
            estoqueMap[p.id] = p.estoque?.saldoFisico || 0;
          }
        })
      );
      if (i + BATCH < produtosSimplesBrutos.length) await sleep(DELAY);
    }

    // 4. Busca estoques das variações em lotes de 3
    for (const pai of detalhesPai) {
      const vars = pai.variacoes || [];
      for (let i = 0; i < vars.length; i += BATCH) {
        const lote = vars.slice(i, i + BATCH);
        await Promise.all(
          lote.map(async (v) => {
            try {
              const ve = await blingRequest(accessToken, `/estoques?idProduto=${v.id}`);
              const vi = ve?.data || [];
              estoqueMap[v.id] = vi.reduce((acc, item) => acc + parseFloat(item.saldoFisico || item.saldoFisicoTotal || 0), 0);
            } catch {
              estoqueMap[v.id] = v.estoque?.saldoFisico || 0;
            }
          })
        );
        if (i + BATCH < vars.length) await sleep(DELAY);
      }
    }

    // 5. Formata produtos simples
    const produtos_simples = produtosSimplesBrutos.map(p => {
      const imagens = [];
      if (p.imagemURL) imagens.push(p.imagemURL);
      return {
        id: p.id, nome: p.nome, codigo: p.codigo, gtin: p.gtin, situacao: p.situacao,
        preco: p.preco, precoCusto: p.precoCusto,
        descricaoCurta: p.descricaoCurta,
        tributacao: p.tributacao || {},
        dimensoes: p.dimensoes || {},
        estoque: { saldoFisico: estoqueMap[p.id] ?? 0, minimo: p.estoque?.minimo || 0, maximo: p.estoque?.maximo || 0 },
        marca: p.marca, unidade: p.unidade,
        imagemURL: p.imagemURL, imagens,
        atributos_extras: {},
      };
    });

    // 6. Formata produtos pai com variações
    const produtos_pai = detalhesPai.map(p => {
      const imagens = [];
      if (p.imagemURL) imagens.push(p.imagemURL);
      if (Array.isArray(p.imagens)) {
        p.imagens.forEach(img => { const url = img.link || img.url || img; if (url && !imagens.includes(url)) imagens.push(url); });
      }

      const variacoes = (p.variacoes || []).map(v => {
        let atributos = [];
        if (v.variacao) atributos = [{ nome: v.variacao.nome, valor: v.variacao.valor }];
        else if (Array.isArray(v.variacoes)) atributos = v.variacoes.map(a => ({ nome: a.nome, valor: a.valor }));
        return {
          id: v.id, nome: v.nome, codigo: v.codigo, preco: v.preco, precoCusto: v.precoCusto,
          gtin: v.gtin, estoque: estoqueMap[v.id] ?? 0, estoqueMinimo: v.estoque?.minimo || 0,
          atributos,
          imagemURL: v.imagemURL || p.imagemURL,
          imagens: v.imagemURL ? [v.imagemURL] : imagens,
          dimensoes: v.dimensoes || p.dimensoes || {},
          tributacao: v.tributacao || p.tributacao || {},
        };
      });

      return {
        id: p.id, nome: p.nome, codigo: p.codigo, gtin: p.gtin, situacao: p.situacao,
        preco: p.preco, precoCusto: p.precoCusto,
        descricaoCurta: p.descricaoCurta,
        tributacao: p.tributacao || {},
        dimensoes: p.dimensoes || {},
        estoque: { saldoFisico: 0, minimo: 0, maximo: 0 },
        marca: p.marca, unidade: p.unidade,
        imagemURL: p.imagemURL, imagens,
        atributos_extras: {},
        variacoes,
      };
    });

    return Response.json({
      produtos_simples,
      produtos_pai,
      total: allProducts.length,
    });
  }

  if (action === 'getProductStock') {
    const accessToken = await getValidAccessToken(base44);
    const { bling_id } = payload;
    if (!bling_id) return Response.json({ saldo: 0 });
    const data = await blingRequest(accessToken, `/estoques?idProduto=${bling_id}`);
    const itens = data?.data || [];
    const saldo = itens.reduce((acc, item) => acc + (parseFloat(item.saldoFisico || item.saldoFisicoTotal || 0)), 0);
    return Response.json({ saldo });
  }

  if (action === 'createProductWithVariacoes') {
    const accessToken = await getValidAccessToken(base44);
    const pai = body.pai;
    const variacoes = body.variacoes || [];

    // 1. Traduzir as variações do Base44 para o Bling
    const variacoesBling = variacoes.map(v => {
      let stringVariacao = "";
      if (v.atributos_extras) {
        stringVariacao = Object.entries(v.atributos_extras)
          .map(([chave, valor]) => `${chave}:${valor}`)
          .join(';');
      }

      return {
        nome: v.nome,
        codigo: v.sku,
        tipo: "P",      // CORREÇÃO: O filho também é um Produto (P)
        formato: "S",   // CORREÇÃO: O filho tem formato Simples (S)
        preco: v.preco_venda || 0,
        situacao: v.ativo ? "A" : "I",
        imagemURL: v.fotos && v.fotos.length > 0 ? v.fotos[0] : "",
        variacao: {
          nome: stringVariacao
        }
      };
    });

    // 2. Montar o Produto Pai (Agrupador)
    const produtoBling = {
      nome: pai.nome,
      codigo: pai.sku,
      tipo: "P",      // Obrigatório: P = Produto
      formato: "V",   // Obrigatório: V = Com Variações
      situacao: pai.ativo ? "A" : "I",
      descricaoCurta: pai.descricao || "",
      marca: pai.marca || "",
      imagemURL: pai.fotos && pai.fotos.length > 0 ? pai.fotos[0] : "",
      variacoes: variacoesBling
    };

    // 3. Disparar para a API do Bling
    try {
      const data = await blingRequest(accessToken, '/produtos', {
        method: 'POST',
        body: JSON.stringify(produtoBling),
      });
      return Response.json(data);
    } catch (error) {
      const erroCompleto = JSON.stringify(error, Object.getOwnPropertyNames(error));
      return Response.json({ error: true, message: erroCompleto }, { status: 400 });
    }
  }

    return Response.json({ error: 'Ação desconhecida' }, { status: 400 });

  } catch (error) {
    console.error('[blingProxy] Erro capturado:', error.message, error.stack);
    return Response.json({
      error: true,
      message: error.message || 'Erro de comunicação com a API Bling',
    }, { status: 400 });
  }
});