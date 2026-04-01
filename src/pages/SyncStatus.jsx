import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw, CheckCircle2, XCircle, Loader2, Clock,
  Package, Warehouse, ShoppingCart, AlertCircle, Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const [activeLogId, setActiveLogId] = useState(null);
  const queryClient = useQueryClient();
  const pollRef = useRef(null);

  // Histórico de logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => base44.entities.SyncLog.list('-created_date', 20),
    refetchInterval: activeLogId ? 2000 : 15000,
  });

  const lastSync = logs[0];
  const activeLog = activeLogId ? logs.find(l => l.id === activeLogId) : null;

  // Quando o log ativo finalizar, limpa o polling
  useEffect(() => {
    if (activeLog && activeLog.status !== 'em_andamento') {
      setActiveLogId(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  }, [activeLog?.status]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('blingSyncJob', { scheduled: false });
      const logId = res?.data?.log_id;
      if (logId) {
        setActiveLogId(logId);
        queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      }
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }); } catch { return iso; }
  };

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
  };

  const duration = (log) => {
    if (!log?.iniciado_em || !log?.finalizado_em) return null;
    const ms = new Date(log.finalizado_em) - new Date(log.iniciado_em);
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}min`;
  };

  // Log a mostrar no painel de atividade ao vivo
  const liveLog = activeLog || (lastSync?.status === 'em_andamento' ? lastSync : null);
  const isRunning = !!liveLog && liveLog.status === 'em_andamento';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sincronização Bling</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Atualização automática de produtos, estoque e vendas — executa a cada hora
          </p>
        </div>
        <Button onClick={handleManualSync} disabled={syncing || isRunning} className="gap-2">
          {(syncing || isRunning)
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          {isRunning ? 'Sincronizando...' : syncing ? 'Iniciando...' : 'Sincronizar agora'}
        </Button>
      </div>

      {/* Painel de atividade ao vivo */}
      {liveLog && (
        <Card className={`border-2 ${isRunning ? 'border-blue-300 bg-blue-50/50' : liveLog.status === 'sucesso' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {isRunning && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              {liveLog.status === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {liveLog.status === 'erro' && <XCircle className="w-4 h-4 text-red-500" />}
              <span className={isRunning ? 'text-blue-700' : liveLog.status === 'sucesso' ? 'text-green-700' : 'text-red-700'}>
                {isRunning ? 'Sincronização em andamento' : liveLog.status === 'sucesso' ? 'Sincronização concluída' : 'Erro na sincronização'}
              </span>
              {!isRunning && duration(liveLog) && (
                <span className="text-xs font-normal text-muted-foreground bg-white/60 px-2 py-0.5 rounded-full ml-1">
                  {duration(liveLog)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mensagem de atividade atual */}
            {liveLog.detalhes && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${isRunning ? 'bg-blue-100/80 text-blue-800' : 'bg-white/60 text-foreground'}`}>
                {isRunning && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />}
                <span>{liveLog.detalhes}</span>
              </div>
            )}

            {/* Contadores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { icon: Package, label: 'Criados', value: liveLog.produtos_criados ?? 0, color: 'text-green-600', bg: 'bg-green-100' },
                { icon: Package, label: 'Atualizados', value: liveLog.produtos_atualizados ?? 0, color: 'text-blue-600', bg: 'bg-blue-100' },
                { icon: Warehouse, label: 'Estoques', value: liveLog.estoques_atualizados ?? 0, color: 'text-orange-600', bg: 'bg-orange-100' },
                { icon: ShoppingCart, label: 'Vendas', value: liveLog.vendas_criadas ?? 0, color: 'text-purple-600', bg: 'bg-purple-100' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {liveLog.erros > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {liveLog.erros} erro{liveLog.erros > 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Último sync resumido (se não estiver ativo) */}
      {!liveLog && lastSync && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Última sincronização: {formatDate(lastSync.iniciado_em)}</p>
              {lastSync.detalhes && <p className="text-xs text-muted-foreground mt-0.5">{lastSync.detalhes}</p>}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">+{lastSync.produtos_criados ?? 0} criados</span>
              <span className="text-blue-600 font-medium">~{lastSync.produtos_atualizados ?? 0} atualizados</span>
              <span className="text-purple-600 font-medium">{lastSync.vendas_criadas ?? 0} vendas</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Histórico de sincronizações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma sincronização realizada ainda.
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const running = log.status === 'em_andamento';
                return (
                  <div key={log.id} className={`px-6 py-3 flex items-center gap-4 flex-wrap ${running ? 'bg-blue-50/50' : 'hover:bg-muted/30'}`}>
                    {running && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                    {log.status === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {log.status === 'erro' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatDateTime(log.iniciado_em)}</p>
                      {log.detalhes && <p className="text-xs text-muted-foreground truncate">{log.detalhes}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 flex-wrap">
                      {(log.produtos_criados > 0) && <span className="text-green-600">+{log.produtos_criados} prod.</span>}
                      {(log.produtos_atualizados > 0) && <span className="text-blue-600">~{log.produtos_atualizados} atual.</span>}
                      {(log.vendas_criadas > 0) && <span className="text-purple-600">{log.vendas_criadas} vendas</span>}
                      {(log.erros > 0) && <span className="text-red-500">{log.erros} erros</span>}
                      {duration(log) && <span className="bg-muted px-1.5 py-0.5 rounded">{duration(log)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}