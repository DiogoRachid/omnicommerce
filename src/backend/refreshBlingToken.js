import { createClientFromRequest } from "npm:@base44/sdk";

const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = 'b72a3e2b6c6a3a51b2bcff6d1cddd97b60f1bf01d8ef8e82ec985fde66cef6a0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca o token salvo
    const tokens = await base44.entities.BlingToken.list();
    if (!tokens || tokens.length === 0) {
      return Response.json({ success: false, error: 'Nenhum token Bling encontrado.' }, { status: 400 });
    }
    const tokenRecord = tokens[0];
    const refreshToken = tokenRecord.refresh_token;
    if (!refreshToken) {
      return Response.json({ success: false, error: 'refresh_token não encontrado no registro.' }, { status: 400 });
    }

    // Faz o POST para o Bling
    const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      return Response.json({
        success: false,
        error: `Bling retornou erro: ${data.error || data.error_description || JSON.stringify(data)}`,
        bling_response: data,
      }, { status: 400 });
    }

    // Calcula expires_at
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

    // Atualiza o token no banco
    await base44.entities.BlingToken.update(tokenRecord.id, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: expiresAt,
    });

    return Response.json({
      success: true,
      expires_at: expiresAt,
      account: tokenRecord.account,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});