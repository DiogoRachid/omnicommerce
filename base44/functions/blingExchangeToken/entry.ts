import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/bling-callback';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  console.log('=== RAW BODY RECEIVED ===', JSON.stringify(body));

  // O SDK base44 pode encapsular o payload em body.payload
  const code = body.code || body?.payload?.code;

  if (!code) {
    return Response.json({
      error: 'Código não informado.',
      raw_body: body,
    }, { status: 400 });
  }

  const clientId = Deno.env.get('VITE_BLING_CLIENT_ID');
  const clientSecret = Deno.env.get('VITE_BLING_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return Response.json({
      error: 'Secrets VITE_BLING_CLIENT_ID ou VITE_BLING_CLIENT_SECRET não configurados.',
      has_client_id: !!clientId,
      has_client_secret: !!clientSecret,
    }, { status: 500 });
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const requestBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });

  console.log('=== BLING TOKEN REQUEST ===');
  console.log('redirect_uri:', REDIRECT_URI);
  console.log('code (primeiros 10):', code.substring(0, 10));
  console.log('client_id:', clientId);
  console.log('Body:', requestBody.toString());

  const res = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: requestBody.toString(),
  });

  const responseText = await res.text();
  console.log('=== BLING RESPONSE ===');
  console.log('Status:', res.status);
  console.log('Body:', responseText);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  if (!res.ok || !data.access_token) {
    return Response.json({
      error: data.error_description || data.error || 'Erro desconhecido',
      bling_status: res.status,
      bling_response: data,
      debug: {
        redirect_uri_sent: REDIRECT_URI,
        code_preview: code.substring(0, 10),
        code_length: code.length,
        client_id: clientId,
        has_secret: !!clientSecret,
        body_sent: requestBody.toString(),
      },
    }, { status: 400 });
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