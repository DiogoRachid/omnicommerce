import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return Response.json({ uploaded: [] });
    }

    const uploaded = [];

    for (const url of urls) {
      // Ignora URLs obviamente inválidas/fictícias
      if (!url || typeof url !== 'string') continue;
      if (url.includes('example.com') || url.includes('placeholder') || url.includes('generic')) continue;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductBot/1.0)' }
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) continue;

        const blob = await res.blob();
        if (blob.size < 1000) continue; // Ignora imagens menores que 1KB (provavelmente placeholder)

        // Upload para o storage do Base44
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        uploaded.push(file_url);
      } catch {
        // URL inacessível — pula silenciosamente
        continue;
      }
    }

    return Response.json({ uploaded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});