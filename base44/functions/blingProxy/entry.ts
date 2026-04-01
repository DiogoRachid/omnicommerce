import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_API = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

async function getToken(base44) {
  const tokens = await base44.asServiceRole.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Nenhum token Bling encontrado.');
  return tokens[0];
}

async function doRefreshToken(base44, tokenRecord) {
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

async function blingRequest(accessToken, path, options = {}) {
  const res = await fetch(`${BLING_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || data?.error?.message || JSON.stringify(data));
  }
  return data;
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

    // 1. Busca todos os IDs com paginação
    let allSummaries = [];
    let pagina = 1;
    while (true) {
      const data = await blingRequest(accessToken, `/produtos?pagina=${pagina}&limite=100&criterio=5&tipo=T`);
      const items = data?.data || [];
      allSummaries = allSummaries.concat(items);
      if (items.length < 100) break;
      pagina++;
    }

    // 2. Busca detalhes em lotes paralelos de 10
    const BATCH = 10;
    const detalhes = [];
    for (let i = 0; i < allSummaries.length; i += BATCH) {
      const lote = allSummaries.slice(i, i + BATCH);
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
      detalhes.push(...results);
    }

    // 3. Busca estoques em lotes paralelos de 10
    const estoqueMap = {};
    for (let i = 0; i < detalhes.length; i += BATCH) {
      const lote = detalhes.slice(i, i + BATCH);
      await Promise.all(
        lote.map(async (p) => {
          try {
            const estoqueData = await blingRequest(accessToken, `/estoques?idProduto=${p.id}`);
            const itens = estoqueData?.data || [];
            const saldo = itens.reduce((acc, item) => acc + (parseFloat(item.saldoFisico || item.saldoFisicoTotal || 0)), 0);
            estoqueMap[p.id] = saldo;
            // Para variações, buscar estoque individual
            if (p.variacoes && p.variacoes.length > 0) {
              for (const v of p.variacoes) {
                try {
                  const ve = await blingRequest(accessToken, `/estoques?idProduto=${v.id}`);
                  const vi = ve?.data || [];
                  estoqueMap[v.id] = vi.reduce((acc, item) => acc + (parseFloat(item.saldoFisico || item.saldoFisicoTotal || 0)), 0);
                } catch { estoqueMap[v.id] = v.estoque?.saldoFisico || 0; }
              }
            }
          } catch {
            estoqueMap[p.id] = p.estoque?.saldoFisico || p.estoque?.saldoFisicoTotal || 0;
          }
        })
      );
    }

    // 4. Classifica e formata
    const produtos_simples = [];
    const produtos_pai = [];

    for (const p of detalhes) {
      // Coleta todas as imagens
      const imagens = [];
      if (p.imagemURL) imagens.push(p.imagemURL);
      if (Array.isArray(p.imagens)) {
        p.imagens.forEach(img => {
          const url = img.link || img.url || img;
          if (url && !imagens.includes(url)) imagens.push(url);
        });
      }

      // Monta atributos extras (campos soltos do produto)
      const atributos_extras = {};
      if (p.cor) atributos_extras['Cor'] = p.cor;
      if (p.tamanho) atributos_extras['Tamanho'] = p.tamanho;
      if (p.voltagem) atributos_extras['Voltagem'] = p.voltagem;
      if (p.material) atributos_extras['Material'] = p.material;

      // Campos completos do produto
      const produtoCompleto = {
        // Identificação
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        gtin: p.gtin,
        situacao: p.situacao,
        // Preços
        preco: p.preco,
        precoCusto: p.precoCusto,
        precoCompra: p.precoCompra,
        // Descrições
        descricaoCurta: p.descricaoCurta,
        descricaoComplementar: p.descricaoComplementar,
        // Identificação fiscal
        tributacao: p.tributacao || {},
        // Dimensões
        dimensoes: p.dimensoes || {},
        // Estoque
        estoque: {
          saldoFisico: estoqueMap[p.id] ?? (p.estoque?.saldoFisico || 0),
          saldoVirtual: p.estoque?.saldoVirtual || 0,
          minimo: p.estoque?.minimo || 0,
          maximo: p.estoque?.maximo || 0,
          crossdocking: p.estoque?.crossdocking || 0,
        },
        // Outros
        marca: p.marca,
        unidade: p.unidade,
        tipo: p.tipo,
        imagemURL: p.imagemURL,
        imagens: imagens,
        categoria: p.categoria || {},
        fornecedores: p.fornecedores || [],
        componentes: p.componentes || [],
        estrutura: p.estrutura || {},
        atributos_extras,
      };

      const variacoes = p.variacoes || [];
      if (variacoes.length > 0) {
        const variacoesFormatadas = variacoes.map(v => {
          const vImagens = [];
          if (v.imagemURL) vImagens.push(v.imagemURL);
          // Atributos da variação (pode ser array ou objeto único)
          let atributos = [];
          if (v.variacao) {
            atributos = [{ nome: v.variacao.nome, valor: v.variacao.valor }];
          } else if (Array.isArray(v.variacoes)) {
            atributos = v.variacoes.map(a => ({ nome: a.nome, valor: a.valor }));
          }
          return {
            id: v.id,
            nome: v.nome,
            codigo: v.codigo,
            preco: v.preco,
            precoCusto: v.precoCusto,
            gtin: v.gtin,
            estoque: estoqueMap[v.id] ?? (v.estoque?.saldoFisico || 0),
            estoqueMinimo: v.estoque?.minimo || 0,
            atributos,
            imagemURL: v.imagemURL || p.imagemURL,
            imagens: vImagens.length > 0 ? vImagens : imagens,
            dimensoes: v.dimensoes || p.dimensoes || {},
            tributacao: v.tributacao || p.tributacao || {},
          };
        });
        produtos_pai.push({ ...produtoCompleto, variacoes: variacoesFormatadas });
      } else {
        produtos_simples.push(produtoCompleto);
      }
    }

    return Response.json({
      produtos_simples,
      produtos_pai,
      total: allSummaries.length,
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

  return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
});