import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  let body = {};
  try { body = await req.json(); } catch { }
  const { logId } = body;

  if (!logId) {
    return Response.json({ error: 'logId obrigatório' }, { status: 400 });
  }

  try {
    await base44.asServiceRole.entities.SyncLog.delete(logId);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});