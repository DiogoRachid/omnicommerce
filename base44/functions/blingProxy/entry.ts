import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_API = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

async function getToken(base44) {
  const tokens = await base44.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Nenhum token Bling encontrado.');
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
    token = await refreshToken(base44, token);
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
      'enable-jwt': '1',
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

  const { action, payload = {} } = await req.json();

  // Status
  if (action === 'status') {
    const tokens = await base44.entities.BlingToken.list();
    if (!tokens || tokens.length === 0) return Response.json({ connected: false });
    const t = tokens[0];
    return Response.json({
      connected: true,
      expired: t.expires_at ? Date.now() > t.expires_at : false,
      expires_at: t.expires_at,
      scope: t.scope,
    });
  }

  // Exchange authorization code for token
  if (action === 'exchange') {
    const { code } = payload;
    const clientId = Deno.env.get('VITE_BLING_CLIENT_ID');
    const clientSecret = Deno.env.get('VITE_BLING_CLIENT_SECRET');
    const redirectUri = Deno.env.get('APP_BASE_URL')
      ? `${Deno.env.get('APP_BASE_URL')}/empresas`
      : payload.redirect_uri;
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
        redirect_uri: redirectUri,
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

  // Refresh token
  if (action === 'refresh') {
    const token = await getToken(base44);
    const updated = await refreshToken(base44, token);
    return Response.json({ success: true, expires_at: updated.expires_at });
  }

  // Disconnect
  if (action === 'disconnect') {
    const tokens = await base44.asServiceRole.entities.BlingToken.list();
    for (const t of tokens) {
      await base44.asServiceRole.entities.BlingToken.delete(t.id);
    }
    return Response.json({ success: true });
  }

  // List products
  if (action === 'listProducts') {
    const accessToken = await getValidAccessToken(base44);
    const pagina = payload.pagina || 1;
    const limite = payload.limite || 100;
    const data = await blingRequest(accessToken, `/produtos?pagina=${pagina}&limite=${limite}&criterio=5&tipo=T`);
    return Response.json(data);
  }

  // List orders
  if (action === 'listOrders') {
    const accessToken = await getValidAccessToken(base44);
    const pagina = payload.pagina || 1;
    const limite = payload.limite || 100;
    const data = await blingRequest(accessToken, `/pedidos/vendas?pagina=${pagina}&limite=${limite}`);
    return Response.json(data);
  }

  // Create product
  if (action === 'createProduct') {
    const accessToken = await getValidAccessToken(base44);
    const data = await blingRequest(accessToken, '/produtos', {
      method: 'POST',
      body: JSON.stringify(payload.produto),
    });
    return Response.json(data);
  }

  return Response.json({ error: 'Ação desconhecida' }, { status: 400 });
});