import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw, CheckCircle2, XCircle, Loader2, Clock,
  Package, Warehouse, ShoppingCart, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  sucesso: { label: 'Sucesso', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  erro: { label: 'Erro', color: 'bg-red-100 text-red-700', icon: XCircle },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
};

export default function SyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => base44.entities.SyncLog.list('-created_date', 20),
    refetchInterval: 10000,
  });

  const lastSync = logs[0];

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('blingSyncJob', { scheduled: false });
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
    } catch { return iso; }
  };

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('pt-BR');
    } catch { return iso; }
  };

  const duration = (log) => {
    if (!log?.iniciado_em || !log?.finalizado_em) return null;
    const ms = new Date(log.finalizado_em) - new Date(log.iniciado_em);
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}min`;
  };

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
        <Button onClick={handleManualSync} disabled={syncing} className="gap-2">
          {syncing
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />
          }
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>
      </div>

      {/* Status cards */}
      {lastSync && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Package, label: 'Criados', value: lastSync.produtos_criados ?? 0, color: 'text-green-600' },
            { icon: Package, label: 'Atualizados', value: lastSync.produtos_atualizados ?? 0, color: 'text-blue-600' },
            { icon: Warehouse, label: 'Estoques', value: lastSync.estoques_atualizados ?? 0, color: 'text-orange-600' },
            { icon: ShoppingCart, label: 'Vendas', value: lastSync.vendas_criadas ?? 0, color: 'text-purple-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color} opacity-80`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Última sincronização */}
      {lastSync && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Última sincronização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {(() => {
                const cfg = STATUS_CONFIG[lastSync.status] || STATUS_CONFIG.em_andamento;
                const Icon = cfg.icon;
                return (
                  <Badge className={`${cfg.color} border-0 gap-1.5`}>
                    <Icon className={`w-3.5 h-3.5 ${lastSync.status === 'em_andamento' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                );
              })()}
              <span className="text-sm text-muted-foreground">{formatDate(lastSync.iniciado_em)}</span>
              {duration(lastSync) && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {duration(lastSync)}
                </span>
              )}
            </div>
            {lastSync.detalhes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {lastSync.detalhes}
              </p>
            )}
            {lastSync.erros > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {lastSync.erros} erro{lastSync.erros > 1 ? 's' : ''} encontrado{lastSync.erros > 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de sincronizações</CardTitle>
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
                const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.em_andamento;
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="px-6 py-3 flex items-center gap-4 flex-wrap hover:bg-muted/30">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${log.status === 'sucesso' ? 'text-green-500' : log.status === 'erro' ? 'text-red-500' : 'text-blue-500'} ${log.status === 'em_andamento' ? 'animate-spin' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatDateTime(log.iniciado_em)}</p>
                      {log.detalhes && (
                        <p className="text-xs text-muted-foreground truncate">{log.detalhes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                      {log.produtos_criados > 0 && <span className="text-green-600">+{log.produtos_criados} prod.</span>}
                      {log.produtos_atualizados > 0 && <span className="text-blue-600">~{log.produtos_atualizados} atualiz.</span>}
                      {log.estoques_atualizados > 0 && <span className="text-orange-600">{log.estoques_atualizados} est.</span>}
                      {log.vendas_criadas > 0 && <span className="text-purple-600">{log.vendas_criadas} vendas</span>}
                      {log.erros > 0 && <span className="text-red-500">{log.erros} erros</span>}
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