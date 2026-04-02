import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ML_APP_ID = Deno.env.get('ML_APP_ID');
const ML_SECRET_KEY = Deno.env.get('ML_SECRET_KEY');
const ML_API = 'https://api.mercadolibre.com';

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

async function refreshTokenIfNeeded(base44, token) {
  const tenMinutes = 10 * 60 * 1000;
  if (token.expires_at - Date.now() > tenMinutes) return token;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ML_APP_ID,
    client_secret: ML_SECRET_KEY,
    refresh_token: token.refresh_token,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao renovar token ML: ${err}`);
  }

  const data = await res.json();
  const updated = await saveToken(base44, data, token.id);
  return updated;
}

async function mlRequest(base44, method, path, body) {
  const stored = await getStoredToken(base44);
  if (!stored) throw new Error('Mercado Livre não está conectado.');

  const token = await refreshTokenIfNeeded(base44, stored);

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
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ML_APP_ID,
        client_secret: ML_SECRET_KEY,
        code,
        redirect_uri,
      });

      const res = await fetch(`${ML_API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Erro ao trocar código');

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

      // Salva na entidade MarketplaceListing
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

    return Response.json({ error: `Action desconhecida: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});