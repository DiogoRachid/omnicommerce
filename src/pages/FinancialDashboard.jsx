import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default function FinancialDashboard() {
  const { selectedCompany } = useOutletContext();
  const [filtroTipo, setFiltroTipo] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const queryClient = useQueryClient();

  const { data: contas = [] } = useQuery({
    queryKey: ['financial-accounts', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.FinancialAccount.filter({ company_id: selectedCompany }, '-data_vencimento', 500);
      }
      return base44.entities.FinancialAccount.list('-data_vencimento', 500);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.FinancialAccount.update(id, { status, data_pagamento: status === 'pago' ? new Date().toISOString().split('T')[0] : null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-accounts'] }),
  });

  // Filters
  const filtradas = contas.filter(c => {
    const matchTipo = filtroTipo === 'todas' || c.tipo === filtroTipo;
    const matchStatus = filtroStatus === 'todas' || c.status === filtroStatus;
    return matchTipo && matchStatus;
  });

  // Sumários
  const receber = useMemo(() => filtradas.filter(c => c.tipo === 'receber'), [filtradas]);
  const pagar = useMemo(() => filtradas.filter(c => c.tipo === 'pagar'), [filtradas]);

  const totalReceber = receber.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalPagar = pagar.reduce((sum, c) => sum + (c.valor || 0), 0);

  const pendentesReceber = receber.filter(c => c.status === 'pendente').reduce((sum, c) => sum + (c.valor || 0), 0);
  const pendentesPagar = pagar.filter(c => c.status === 'pendente').reduce((sum, c) => sum + (c.valor || 0), 0);

  const atrasadas = filtradas.filter(c => c.status === 'atrasado').length;

  // Status display
  const statusColors = {
    pendente: 'bg-yellow-100 text-yellow-800',
    pago: 'bg-green-100 text-green-800',
    cancelado: 'bg-gray-100 text-gray-800',
    atrasado: 'bg-red-100 text-red-800'
  };

  const tipoIcons = {
    receber: <ArrowDown className="w-4 h-4 text-green-600" />,
    pagar: <ArrowUp className="w-4 h-4 text-red-600" />
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Fluxo Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Contas a pagar e receber</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totalReceber)}</p>
            <p className="text-xs text-muted-foreground mt-1">{receber.length} contas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totalPagar)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pagar.length} contas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendente Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatBRL(pendentesReceber)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Atrasadas
              {atrasadas > 0 && <Badge className="bg-red-100 text-red-800">{atrasadas}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatBRL(pendentesPagar)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="receber">A Receber</SelectItem>
            <SelectItem value="pagar">A Pagar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                <th className="px-4 py-2 text-left font-semibold">Centro Custo</th>
                <th className="px-4 py-2 text-right font-semibold">Valor</th>
                <th className="px-4 py-2 text-left font-semibold">Vencimento</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filtradas.map(conta => (
                <tr key={conta.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 flex items-center gap-2">
                    {tipoIcons[conta.tipo]}
                    <span className="capitalize text-xs font-medium">{conta.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{conta.descricao || conta.numero_documento || '-'}</p>
                      <p className="text-xs text-muted-foreground">{conta.fornecedor_nome || conta.cliente_nome}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{conta.centro_custo}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatBRL(conta.valor)}</td>
                  <td className="px-4 py-3 text-xs">
                    {conta.data_vencimento}
                    <br />
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(conta.data_vencimento), { locale: ptBR, addSuffix: true })}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusColors[conta.status]}>{conta.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {conta.status === 'pendente' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: conta.id, status: 'pago' })}
                        className="text-xs"
                      >
                        Marcar pago
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtradas.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhuma conta encontrada
          </div>
        )}
      </div>
    </div>
  );
}