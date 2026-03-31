import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = 'b72a3e2b6c6a3a51b2bcff6d1cddd97b60f1bf01d8ef8e82ec985fde66cef6a0';
const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';

function getCredentials() {
  return btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
}

async function exchangeToken(grantType, params) {
  const body = new URLSearchParams({ grant_type: grantType, ...params });
  const response = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${getCredentials()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '1.0',
    },
    body: body.toString(),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const errMsg = data.error?.description || data.error?.message || data.error_description
    || (typeof data.error === 'string' ? data.error : null)
    || JSON.stringify(data);
  throw new Error(errMsg);
  }
  return data;
}

async function saveToken(base44, data, account) {
  const expiresAt = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();
  const existing = await base44.entities.BlingToken.list();

  const payload = {
    account: account || 'bling',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
  };

  if (existing && existing.length > 0) {
    await base44.entities.BlingToken.update(existing[0].id, payload);
  } else {
    await base44.entities.BlingToken.create(payload);
  }

  return expiresAt;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, code, redirect_uri, account } = await req.json();

    // Troca authorization_code por tokens
    if (action === 'exchange_code') {
      if (!code) {
        return Response.json({ success: false, error: 'Parâmetro "code" obrigatório.' }, { status: 400 });
      }
      const data = await exchangeToken('authorization_code', {
        code,
        redirect_uri: redirect_uri || '',
      });
      const expiresAt = await saveToken(base44, data, account);
      return Response.json({ success: true, expires_at: expiresAt });
    }

    // Renova usando refresh_token
    if (action === 'refresh') {
      const tokens = await base44.entities.BlingToken.list();
      if (!tokens || tokens.length === 0) {
        return Response.json({ success: false, error: 'Nenhum token Bling encontrado. Autorize primeiro.' }, { status: 400 });
      }
      const tokenRecord = tokens[0];
      if (!tokenRecord.refresh_token) {
        return Response.json({ success: false, error: 'refresh_token não encontrado.' }, { status: 400 });
      }
      const data = await exchangeToken('refresh_token', {
        refresh_token: tokenRecord.refresh_token,
      });
      const expiresAt = await saveToken(base44, data, tokenRecord.account);
      return Response.json({ success: true, expires_at: expiresAt, account: tokenRecord.account });
    }

    return Response.json({ success: false, error: 'Ação inválida. Use "exchange_code" ou "refresh".' }, { status: 400 });

  } catch (error) {
    const msg = error?.message || String(error);
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
});