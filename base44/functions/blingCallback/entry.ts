Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // URL do frontend — derivada do próprio host da função (mesmo domínio base44)
  const appId = Deno.env.get('BASE44_APP_ID');
  const appUrl = `https://app.base44.com/apps/${appId}`;

  const redirectUrl = new URL('/empresas', 'https://preview-sandbox--' + appId + '.base44.app');
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);

  return Response.redirect(redirectUrl.toString(), 302);
});