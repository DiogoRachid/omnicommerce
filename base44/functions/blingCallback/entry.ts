// Callback OAuth do Bling — redireciona para /empresas com code e state
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Usa o APP_BASE_URL configurado, ou detecta pelo Referer/Origin
  const appBaseUrl = Deno.env.get('APP_BASE_URL') || 
    (() => {
      const ref = req.headers.get('referer') || req.headers.get('origin') || '';
      try { return new URL(ref).origin; } catch { return ''; }
    })();

  const redirectUrl = new URL('/empresas', appBaseUrl || 'https://app.base44.com');
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);

  return Response.redirect(redirectUrl.toString(), 302);
});