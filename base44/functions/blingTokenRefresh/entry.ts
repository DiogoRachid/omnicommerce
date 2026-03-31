import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";
import { SignJWT } from "npm:jose@5.9.6";

const BLING_TOKEN_URL = 'https://api.bling.com.br/Api/v3/oauth/token';

async function generateJWT(clientId, clientSecret) {
  const key = new TextEncoder().encode(clientSecret);
  const jwt = await new SignJWT({ iss: clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(key);
  return jwt;
}

async function refreshToken(tokenRecord, company) {
  const clientId = company.bling_client_id;
  const clientSecret = company.bling_client_secret;
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const jwt = await generateJWT(clientId, clientSecret);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenRecord.refresh_token,
  });

  const response = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '1.0',
      'X-JWT-Token': jwt,
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca todos os tokens ativos
    const tokens = await base44.asServiceRole.entities.BlingToken.list();
    if (!tokens || tokens.length === 0) {
      return Response.json({ message: 'Nenhum token Bling encontrado.', refreshed: 0, errors: 0 });
    }

    let refreshed = 0;
    let errors = 0;
    const results = [];

    for (const tokenRecord of tokens) {
      if (!tokenRecord.company_id) continue;

      // Verifica se expira em menos de 4 horas (evita renovar se ainda tem bastante tempo)
      if (tokenRecord.expires_at) {
        const expiresAt = new Date(tokenRecord.expires_at);
        const hoursLeft = (expiresAt - new Date()) / 1000 / 3600;
        if (hoursLeft > 4) {
          results.push({ company_id: tokenRecord.company_id, status: 'skipped', reason: `Expira em ${hoursLeft.toFixed(1)}h` });
          continue;
        }
      }

      try {
        // Busca credenciais da empresa
        const companies = await base44.asServiceRole.entities.Company.filter({ id: tokenRecord.company_id });
        if (!companies || companies.length === 0) {
          results.push({ company_id: tokenRecord.company_id, status: 'error', reason: 'Empresa não encontrada' });
          errors++;
          continue;
        }
        const company = companies[0];
        if (!company.bling_client_id || !company.bling_client_secret) {
          results.push({ company_id: tokenRecord.company_id, status: 'error', reason: 'Credenciais Bling não configuradas' });
          errors++;
          continue;
        }

        const data = await refreshToken(tokenRecord, company);
        const expiresAt = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();

        await base44.asServiceRole.entities.BlingToken.update(tokenRecord.id, {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
        });

        results.push({ company_id: tokenRecord.company_id, status: 'ok', expires_at: expiresAt });
        refreshed++;
      } catch (e) {
        results.push({ company_id: tokenRecord.company_id, status: 'error', reason: e.message });
        errors++;
      }
    }

    return Response.json({ message: 'Renovação concluída.', refreshed, errors, results });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});