import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Warehouse, Plus, Search, ArrowUpCircle, ArrowDownCircle, FileText } from 'lucide-react';

export default function Stock() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [showMovement, setShowMovement] = useState(false);
  const [movementForm, setMovementForm] = useState({
    product_id: '', tipo: 'entrada', quantidade: '', custo_unitario: '', observacao: '', invoice_number: ''
  });
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.Product.list('-created_date', 200);
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['stockMovements', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.StockMovement.filter({ company_id: selectedCompany }, '-created_date', 100);
      }
      return base44.entities.StockMovement.list('-created_date', 100);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (data) => {
      const product = products.find(p => p.id === data.product_id);
      if (!product) return;

      const qty = parseFloat(data.quantidade);
      let newStock = product.estoque_atual || 0;

      if (['entrada', 'ajuste_positivo', 'devolucao'].includes(data.tipo)) {
        newStock += qty;
      } else {
        newStock -= qty;
      }

      await base44.entities.StockMovement.create({
        ...data,
        product_name: product.nome,
        quantidade: qty,
        custo_unitario: data.custo_unitario ? parseFloat(data.custo_unitario) : undefined,
        referencia_tipo: data.tipo === 'entrada' ? 'nfe_entrada' : 'ajuste_manual',
        company_id: selectedCompany !== 'all' ? selectedCompany : product.company_id,
      });

      await base44.entities.Product.update(product.id, { estoque_atual: newStock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      setShowMovement(false);
      setMovementForm({ product_id: '', tipo: 'entrada', quantidade: '', custo_unitario: '', observacao: '', invoice_number: '' });
    },
  });

  const filtered = products.filter(p =>
    p.ativo && (
      p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const tipoLabels = {
    entrada: 'Entrada',
    saida_venda: 'Saída Venda',
    ajuste_positivo: 'Ajuste +',
    ajuste_negativo: 'Ajuste -',
    devolucao: 'Devolução',
    transferencia: 'Transferência',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerenciamento unificado de estoque</p>
        </div>
        <div className="flex gap-2">
          <Link to="/notas-fiscais/importar">
            <Button variant="outline"><FileText className="w-4 h-4 mr-2" /> Importar XML</Button>
          </Link>
          <Button onClick={() => setShowMovement(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Movimentação
          </Button>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Posição de Estoque</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Estoque Atual</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const isLow = (p.estoque_atual || 0) <= (p.estoque_minimo || 0);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                    <TableCell className="text-sm font-mono">{p.sku}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${isLow ? 'text-destructive' : ''}`}>
                      {p.estoque_atual || 0} {p.unidade_medida || 'UN'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {p.estoque_minimo || 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isLow ? 'destructive' : 'default'} className="text-[10px]">
                        {isLow ? 'Baixo' : 'OK'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimas Movimentações</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.slice(0, 20).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {['entrada', 'ajuste_positivo', 'devolucao'].includes(m.tipo) ? (
                        <ArrowUpCircle className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className="text-sm">{tipoLabels[m.tipo] || m.tipo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{m.product_name}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{m.quantidade}</TableCell>
                  <TableCell className="text-sm">{m.invoice_number || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.observacao || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.created_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={showMovement} onOpenChange={setShowMovement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Produto *</Label>
              <Select value={movementForm.product_id} onValueChange={(v) => setMovementForm(prev => ({ ...prev, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.ativo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={movementForm.tipo} onValueChange={(v) => setMovementForm(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida_venda">Saída (Venda)</SelectItem>
                  <SelectItem value="ajuste_positivo">Ajuste Positivo</SelectItem>
                  <SelectItem value="ajuste_negativo">Ajuste Negativo</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" value={movementForm.quantidade} onChange={(e) => setMovementForm(prev => ({ ...prev, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label>Custo Unitário (R$)</Label>
                <Input type="number" step="0.01" value={movementForm.custo_unitario} onChange={(e) => setMovementForm(prev => ({ ...prev, custo_unitario: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Nº da Nota Fiscal</Label>
              <Input value={movementForm.invoice_number} onChange={(e) => setMovementForm(prev => ({ ...prev, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={movementForm.observacao} onChange={(e) => setMovementForm(prev => ({ ...prev, observacao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovement(false)}>Cancelar</Button>
            <Button onClick={() => moveMutation.mutate(movementForm)} disabled={moveMutation.isPending}>
              {moveMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}