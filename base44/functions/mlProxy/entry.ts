import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ML_API = 'https://api.mercadolibre.com';

// ── Pega credenciais ML da empresa ou fallback para env vars ──────────────────
async function getMlCredentials(base44) {
  const companies = await base44.asServiceRole.entities.Company.list('-created_date', 20);
  // Tenta encontrar a primeira empresa com ML credentials configuradas
  for (const company of (companies || [])) {
    const mlConfig = company?.marketplaces_config?.mercado_livre || {};
    const appId = (mlConfig.ml_app_id || '').trim();
    const secretKey = (mlConfig.ml_secret_key || '').trim();
    if (appId && secretKey) {
      console.log('Found ML credentials in company:', company.id);
      return { appId, secretKey };
    }
  }
  // Fallback para env vars
  const appId = (Deno.env.get('ML_APP_ID') || '').trim();
  const secretKey = (Deno.env.get('ML_SECRET_KEY') || '').trim();
  if (appId && secretKey) {
    console.log('Using ML credentials from env vars');
    return { appId, secretKey };
  }
  throw new Error('Credenciais Mercado Livre não configuradas. Configure ml_app_id e ml_secret_key na empresa ou nas variáveis de ambiente.');
}

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getStoredToken(base44) {
  const tokens = await base44.asServiceRole.entities.MercadoLivreToken.list('-created_date', 1);
  return tokens?.[0] || null;
}

async function saveToken(base44, data, existingId) {
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 21600) * 1000,
    user_id: String(data.user_id || ''),
    scope: data.scope || '',
  };
  if (existingId) {
    return base44.asServiceRole.entities.MercadoLivreToken.update(existingId, record);
  }
  return base44.asServiceRole.entities.MercadoLivreToken.create(record);
}

async function refreshTokenIfNeeded(base44, token, appId, secretKey) {
  const tenMinutes = 10 * 60 * 1000;
  if (token.expires_at - Date.now() > tenMinutes) return token;

  console.log('Refreshing ML token for user:', token.user_id?.slice(0, 4));

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appId,
    client_secret: secretKey,
    refresh_token: token.refresh_token,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Token refresh failed:', res.status, errText);
    let errMsg;
    try {
      const err = JSON.parse(errText);
      errMsg = err.message || err.error || errText;
    } catch {
      errMsg = errText;
    }
    // refresh_token vencido ou inválido precisa de re-autenticação
    if (res.status === 400 && errMsg?.includes('invalid_grant')) {
      throw new Error('Sessão Mercado Livre expirada. Reconecte na página da empresa.');
    }
    throw new Error(`Falha ao renovar token ML: ${errMsg}`);
  }

  const data = await res.json();
  const updated = await saveToken(base44, data, token.id);
  return updated;
}

async function mlRequest(base44, method, path, body) {
  const { appId, secretKey } = await getMlCredentials(base44);
  const stored = await getStoredToken(base44);
  if (!stored) throw new Error('Mercado Livre não está conectado.');

  const token = await refreshTokenIfNeeded(base44, stored, appId, secretKey);

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${ML_API}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) throw new Error(json?.message || json?.error || text);
  return json;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, ...payload } = await req.json();

    // ── exchange ──────────────────────────────────────────────────────────────
    if (action === 'exchange') {
      const { code, redirect_uri } = payload;
      const { appId, secretKey } = await getMlCredentials(base44);

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: secretKey,
        code,
        redirect_uri,
      });

      console.log('exchange params:', {
        grant_type: 'authorization_code',
        client_id: appId,
        client_id_length: appId?.length,
        redirect_uri,
        code_prefix: code?.slice(0, 10),
      });

      const res = await fetch(`${ML_API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params,
      });

      const data = await res.json();
      console.log('exchange response:', JSON.stringify(data));
      if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data));

      // Remove tokens antigos
      const old = await base44.asServiceRole.entities.MercadoLivreToken.list('-created_date', 10);
      for (const t of (old || [])) {
        await base44.asServiceRole.entities.MercadoLivreToken.delete(t.id);
      }

      const saved = await saveToken(base44, data, null);
      return Response.json({ success: true, token: saved });
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (action === 'status') {
      const token = await getStoredToken(base44);
      if (!token) return Response.json({ connected: false });
      const valid = token.expires_at > Date.now();
      return Response.json({ connected: true, valid, user_id: token.user_id, expires_at: token.expires_at });
    }

    // ── refresh ───────────────────────────────────────────────────────────────
    if (action === 'refresh') {
      const token = await getStoredToken(base44);
      if (!token) return Response.json({ connected: false });
      const { appId, secretKey } = await getMlCredentials(base44);
      const newToken = await refreshTokenIfNeeded(base44, token, appId, secretKey);
      return Response.json({ connected: true, token: newToken });
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const tokens = await base44.asServiceRole.entities.MercadoLivreToken.list('-created_date', 50);
      for (const t of (tokens || [])) {
        await base44.asServiceRole.entities.MercadoLivreToken.delete(t.id);
      }
      return Response.json({ success: true });
    }

    // ── getUser ───────────────────────────────────────────────────────────────
    if (action === 'getUser') {
      const data = await mlRequest(base44, 'GET', '/users/me');
      return Response.json(data);
    }

    // ── getCategories ─────────────────────────────────────────────────────────
    if (action === 'getCategories') {
      const { query } = payload;
      const data = await mlRequest(base44, 'GET', `/sites/MLB/domain_discovery/search?q=${encodeURIComponent(query)}`);
      return Response.json(data);
    }

    // ── getCategoryAttributes ─────────────────────────────────────────────────
    if (action === 'getCategoryAttributes') {
      const { category_id } = payload;
      const data = await mlRequest(base44, 'GET', `/categories/${category_id}/attributes`);
      return Response.json(data);
    }

    // ── createListing ─────────────────────────────────────────────────────────
    if (action === 'createListing') {
      const { listing } = payload;
      const data = await mlRequest(base44, 'POST', '/items', listing);

      if (data.id && payload.product_id) {
        await base44.asServiceRole.entities.MarketplaceListing.create({
          product_id: payload.product_id,
          product_name: payload.product_name || listing.title,
          marketplace: 'mercado_livre',
          marketplace_item_id: data.id,
          status: 'ativo',
          preco_anuncio: listing.price || 0,
          url_anuncio: data.permalink,
          ultima_sync: new Date().toISOString(),
          company_id: payload.company_id,
        });
      }

      return Response.json(data);
    }

    // ── updateListing ─────────────────────────────────────────────────────────
    if (action === 'updateListing') {
      const { item_id, dados } = payload;
      const data = await mlRequest(base44, 'PUT', `/items/${item_id}`, dados);
      return Response.json(data);
    }

    // ── getListing ────────────────────────────────────────────────────────────
    if (action === 'getListing') {
      const { item_id } = payload;
      const data = await mlRequest(base44, 'GET', `/items/${item_id}`);
      return Response.json(data);
    }

    // ── syncListings ──────────────────────────────────────────────────────────
    if (action === 'syncListings') {
      const token = await getStoredToken(base44);
      if (!token) throw new Error('Mercado Livre não está conectado.');

      const userId = token.user_id;
      let synced = 0;
      let offset = 0;
      const limit = 50;

      // Carrega listings existentes em cache
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const allListings = await base44.asServiceRole.entities.MarketplaceListing.list('-created_date', 2000);
      const existingMap = new Map<string, any>();
      for (const listing of (allListings || [])) {
        if (listing.marketplace_item_id) existingMap.set(listing.marketplace_item_id, listing);
      }

      while (true) {
        const searchRes = await mlRequest(
          base44,
          'GET',
          `/users/${userId}/items/search?status=active&limit=${limit}&offset=${offset}`
        );

        const itemIds = searchRes?.results || [];
        if (itemIds.length === 0) break;

        // Batch: busca todos os items com delay maior
        for (const itemId of itemIds) {
          try {
            const item = await mlRequest(base44, 'GET', `/items/${itemId}`);
            await sleep(200); // Pausa após request ML

            const statusMap: Record<string, string> = {
              active: 'ativo',
              paused: 'pausado',
              closed: 'inativo',
              under_review: 'pendente',
            };

            const listingData = {
              marketplace_item_id: item.id,
              product_name: item.title,
              marketplace: 'mercado_livre',
              status: statusMap[item.status] || 'pendente',
              preco_anuncio: item.price || 0,
              url_anuncio: item.permalink,
              ultima_sync: new Date().toISOString(),
            };

            const existing = existingMap.get(item.id);
            if (existing) {
              await base44.asServiceRole.entities.MarketplaceListing.update(existing.id, listingData);
            } else {
              await base44.asServiceRole.entities.MarketplaceListing.create(listingData);
            }
            synced++;
            await sleep(1000); // Pausa após entity operation
          } catch (err) {
            console.error(`Erro ao sincronizar item ${itemId}:`, err.message);
            await sleep(1000); // Pausa após erro
          }
        }

        if (itemIds.length < limit) break;
        offset += limit;
        await sleep(2000); // Pausa entre páginas
      }

      return Response.json({ success: true, synced });

    // ── syncStock ─────────────────────────────────────────────────────────────
    if (action === 'syncStock') {
      const { item_id, price, available_quantity } = payload;

      const body = {};
      if (price !== undefined) body.price = Number(price);
      if (available_quantity !== undefined) body.available_quantity = Number(available_quantity);

      const data = await mlRequest(base44, 'PUT', `/items/${item_id}`, body);

      // Atualiza o registro local
      const existing = await base44.asServiceRole.entities.MarketplaceListing.filter(
        { marketplace_item_id: item_id },
        '-created_date',
        1
      );
      if (existing && existing.length > 0) {
        const updateData = { ultima_sync: new Date().toISOString() };
        if (price !== undefined) updateData.preco_anuncio = Number(price);
        await base44.asServiceRole.entities.MarketplaceListing.update(existing[0].id, updateData);
      }

      return Response.json({ success: true, data });
    }

    // ── pauseListing ──────────────────────────────────────────────────────────
    if (action === 'pauseListing') {
      const { item_id } = payload;
      const data = await mlRequest(base44, 'PUT', `/items/${item_id}`, { status: 'paused' });

      const existing = await base44.asServiceRole.entities.MarketplaceListing.filter(
        { marketplace_item_id: item_id },
        '-created_date',
        1
      );
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.MarketplaceListing.update(existing[0].id, {
          status: 'pausado',
          ultima_sync: new Date().toISOString(),
        });
      }

      return Response.json({ success: true, data });
    }

    // ── reactivateListing ─────────────────────────────────────────────────────
    if (action === 'reactivateListing') {
      const { item_id } = payload;
      const data = await mlRequest(base44, 'PUT', `/items/${item_id}`, { status: 'active' });

      const existing = await base44.asServiceRole.entities.MarketplaceListing.filter(
        { marketplace_item_id: item_id },
        '-created_date',
        1
      );
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.MarketplaceListing.update(existing[0].id, {
          status: 'ativo',
          ultima_sync: new Date().toISOString(),
        });
      }

      return Response.json({ success: true, data });
    }

    // ── getOrders ─────────────────────────────────────────────────────────────
    if (action === 'getOrders') {
      const { status: orderStatus } = payload;
      const token = await getStoredToken(base44);
      if (!token) throw new Error('Mercado Livre não está conectado.');

      let path = `/orders/search?seller=${token.user_id}&sort=date_desc&limit=50`;
      if (orderStatus) path += `&order.status=${orderStatus}`;

      const data = await mlRequest(base44, 'GET', path);
      return Response.json(data);
    }

    return Response.json({ error: `Action desconhecida: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('mlProxy error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
