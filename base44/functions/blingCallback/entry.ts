Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Monta a URL de redirecionamento para o frontend
  const appUrl = Deno.env.get('APP_BASE_URL') || 'https://preview-sandbox--69c847515e26f8ca005176ef.base44.app';
  
  const redirectUrl = new URL('/empresas', appUrl);
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);

  return Response.redirect(redirectUrl.toString(), 302);
});