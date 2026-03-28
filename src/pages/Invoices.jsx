import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, Search } from 'lucide-react';

const statusColors = {
  autorizada: 'default', importada: 'default', pendente: 'secondary',
  rejeitada: 'destructive', cancelada: 'outline',
};

export default function Invoices() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Invoice.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.Invoice.list('-created_date', 200);
    },
  });

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.numero?.includes(search) || inv.emitente_nome?.toLowerCase().includes(search.toLowerCase()) || inv.chave_acesso?.includes(search);
    const matchTipo = tipoFilter === 'all' || inv.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notas Fiscais</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{invoices.length} notas registradas</p>
        </div>
        <Link to="/notas-fiscais/importar">
          <Button><Upload className="w-4 h-4 mr-2" /> Importar XML</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, emitente, chave..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Tabs value={tipoFilter} onValueChange={setTipoFilter}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="entrada">Entrada</TabsTrigger>
            <TabsTrigger value="saida">Saída</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma nota fiscal encontrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Importe um XML de nota fiscal para começar</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {inv.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{inv.numero || '-'}</TableCell>
                    <TableCell className="text-sm">{inv.emitente_nome || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {inv.data_emissao ? new Date(inv.data_emissao).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      R$ {(inv.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[inv.status] || 'secondary'} className="text-[10px] capitalize">
                        {inv.status || 'pendente'}
                      </Badge>
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