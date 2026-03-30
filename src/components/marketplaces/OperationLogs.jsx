import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList } from 'lucide-react';

const MP_NAMES = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu', americanas: 'Americanas' };
const TIPO_LABELS = { teste_conexao: 'Teste Conexão', importacao: 'Importação', exportacao: 'Exportação', atualizacao: 'Atualização' };

export default function OperationLogs() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['marketplace-logs'],
    queryFn: () => base44.entities.MarketplaceLog.list('-created_date', 100),
    refetchInterval: 10000,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Logs de Operação
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Carregando logs...</p>}
        {!isLoading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum log registrado ainda.</p>
        )}
        {logs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[l.tipo] || l.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{MP_NAMES[l.marketplace] || l.marketplace || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.company_name || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate">{l.produto || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={l.status === 'sucesso' ? 'default' : l.status === 'erro' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.mensagem || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {l.created_date ? new Date(l.created_date).toLocaleString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}