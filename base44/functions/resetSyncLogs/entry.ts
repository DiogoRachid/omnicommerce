import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    // Apaga TODOS os logs de sincronização
    const allLogs = await base44.asServiceRole.entities.SyncLog.list('-created_date', 1000);
    for (const log of allLogs) {
      await base44.asServiceRole.entities.SyncLog.delete(log.id);
    }
    return Response.json({ success: true, deleted: allLogs.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});