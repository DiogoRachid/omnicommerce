import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Plus, Search } from 'lucide-react';

const statusColors = {
  confirmada: 'default',
  pendente: 'secondary',
  cancelada: 'destructive',
  devolvida: 'outline',
};

const statusLabels = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  cancelada: 'Cancelada',
  devolvida: 'Devolvida',
};

const canalLabels = {
  pdv: 'PDV',
  ecommerce: 'E-Commerce',
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  b2b: 'B2B',
  outro: 'Outro',
};

export default function Sales() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Sale.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.Sale.list('-created_date', 200);
    },
  });

  const filtered = sales.filter(s =>
    s.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.numero?.toString().includes(search) ||
    s.marketplace_order_id?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{sales.length} vendas registradas</p>
        </div>
        <Link to="/vendas/nova">
          <Button><Plus className="w-4 h-4 mr-2" /> Nova Venda</Button>
        </Link>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por cliente, número..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 && !isLoading ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma venda encontrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Registre sua primeira venda</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-mono">{s.numero || '-'}</TableCell>
                    <TableCell className="text-sm font-medium">{s.client_name || 'Venda avulsa'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {canalLabels[s.canal] || s.canal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{s.forma_pagamento?.replace('_', ' ') || '-'}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      R$ {(s.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[s.status] || 'secondary'} className="text-[10px]">
                        {statusLabels[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.created_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}