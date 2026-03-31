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

async function exchangeToken(grantType, params, clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const jwt = await generateJWT(clientId, clientSecret);
  const body = new URLSearchParams({ grant_type: grantType, ...params });

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

async function saveToken(base44, data, companyId, account) {
  const expiresAt = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();
  const existing = await base44.entities.BlingToken.filter({ company_id: companyId });

  const payload = {
    company_id: companyId,
    account: account || companyId,
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
    const { action, code, company_id } = await req.json();

    if (!company_id) {
      return Response.json({ success: false, error: 'Parâmetro "company_id" obrigatório.' }, { status: 400 });
    }

    // Busca credenciais da empresa
    const companies = await base44.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ success: false, error: 'Empresa não encontrada.' }, { status: 404 });
    }
    const company = companies[0];
    const clientId = company.bling_client_id;
    const clientSecret = company.bling_client_secret;

    if (!clientId || !clientSecret) {
      return Response.json({ success: false, error: 'Client ID e Client Secret do Bling não configurados para esta empresa.' }, { status: 400 });
    }

    // Troca authorization_code por tokens
    // Conforme documentação Bling: NÃO enviar redirect_uri (é configurado no cadastro do app)
    if (action === 'exchange_code') {
      if (!code) {
        return Response.json({ success: false, error: 'Parâmetro "code" obrigatório.' }, { status: 400 });
      }
      const data = await exchangeToken('authorization_code', { code }, clientId, clientSecret);
      const expiresAt = await saveToken(base44, data, company_id, company.nome_fantasia || company.razao_social);
      return Response.json({ success: true, expires_at: expiresAt });
    }

    // Renova usando refresh_token
    if (action === 'refresh') {
      const tokens = await base44.entities.BlingToken.filter({ company_id });
      if (!tokens || tokens.length === 0) {
        return Response.json({ success: false, error: 'Nenhum token Bling encontrado para esta empresa. Autorize primeiro.' }, { status: 400 });
      }
      const tokenRecord = tokens[0];
      if (!tokenRecord.refresh_token) {
        return Response.json({ success: false, error: 'refresh_token não encontrado.' }, { status: 400 });
      }
      const data = await exchangeToken('refresh_token', { refresh_token: tokenRecord.refresh_token }, clientId, clientSecret);
      const expiresAt = await saveToken(base44, data, company_id, tokenRecord.account);
      return Response.json({ success: true, expires_at: expiresAt, account: tokenRecord.account });
    }

    return Response.json({ success: false, error: 'Ação inválida. Use "exchange_code" ou "refresh".' }, { status: 400 });

  } catch (error) {
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});