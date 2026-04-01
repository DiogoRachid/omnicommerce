import { base44 } from '@/api/base44Client';

const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = import.meta.env.VITE_BLING_CLIENT_SECRET || '';
const REDIRECT_URI = 'https://app.base44.com/api/apps/69c847515e26f8ca005176ef/auth/sso/callback';
const TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';

export function getBlingAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: 'bling_oauth',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function fetchToken(body) {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || JSON.stringify(data));
  }
  return data;
}

async function saveToken(data) {
  const payload = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 21600) * 1000,
    scope: data.scope || '',
  };
  const existing = await base44.entities.BlingToken.list();
  if (existing && existing.length > 0) {
    await base44.entities.BlingToken.update(existing[0].id, payload);
  } else {
    await base44.entities.BlingToken.create(payload);
  }
  return payload;
}

export async function exchangeCodeForToken(code) {
  const data = await fetchToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });
  return saveToken(data);
}

export async function refreshAccessToken() {
  const tokens = await base44.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Nenhum token encontrado. Conecte ao Bling primeiro.');
  const token = tokens[0];
  if (!token.refresh_token) throw new Error('refresh_token não encontrado.');
  const data = await fetchToken({
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
  });
  return saveToken(data);
}

export async function getValidAccessToken() {
  const tokens = await base44.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) throw new Error('Não conectado ao Bling.');
  const token = tokens[0];
  // Renova se expira em menos de 5 minutos
  if (token.expires_at && Date.now() > token.expires_at - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken();
    return refreshed.access_token;
  }
  return token.access_token;
}

export async function disconnectBling() {
  const tokens = await base44.entities.BlingToken.list();
  for (const t of tokens) {
    await base44.entities.BlingToken.delete(t.id);
  }
}

export async function getBlingStatus() {
  const tokens = await base44.entities.BlingToken.list();
  if (!tokens || tokens.length === 0) return { connected: false };
  const token = tokens[0];
  const expired = token.expires_at && Date.now() > token.expires_at;
  return {
    connected: true,
    expired,
    expires_at: token.expires_at,
    scope: token.scope,
  };
}