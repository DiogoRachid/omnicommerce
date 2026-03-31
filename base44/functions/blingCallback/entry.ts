// Callback OAuth do Bling — redireciona para /empresas com code e state
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // URL base fixa do app Base44
  const appBaseUrl = 'https://app.base44.com/OmniCommerce';

  const redirectUrl = new URL('/empresas', appBaseUrl);
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);

  return Response.redirect(redirectUrl.toString(), 302);
});