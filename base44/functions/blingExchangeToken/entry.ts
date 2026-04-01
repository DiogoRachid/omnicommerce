import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/bling-callback';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json();
  if (!code) return Response.json({ error: 'Código não informado.' }, { status: 400 });

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
      redirect_uri: REDIRECT_URI,
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
});