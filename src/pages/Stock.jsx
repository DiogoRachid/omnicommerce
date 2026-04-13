import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Warehouse, Plus, Search, ArrowUpCircle, ArrowDownCircle, FileText, ChevronRight, ChevronDown, Layers, Package } from 'lucide-react';

const tipoLabels = {
  entrada: 'Entrada',
  saida_venda: 'Saída Venda',
  ajuste_positivo: 'Ajuste +',
  ajuste_negativo: 'Ajuste -',
  devolucao: 'Devolução',
  transferencia: 'Transferência',
};

export default function Stock() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [showMovement, setShowMovement] = useState(false);
  const [movementForm, setMovementForm] = useState({
    product_id: '', tipo: 'entrada', quantidade: '', custo_unitario: '', observacao: '', invoice_number: ''
  });
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 10000);
      }
      return base44.entities.Product.list('-created_date', 10000);
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

  // Build pai → variacoes map
  const variacoesPorPai = useMemo(() => {
    const map = {};
    products.filter(p => p.tipo === 'variacao').forEach(v => {
      if (v.produto_pai_id) {
        if (!map[v.produto_pai_id]) map[v.produto_pai_id] = [];
        map[v.produto_pai_id].push(v);
      }
    });
    return map;
  }, [products]);

  const rootProducts = products.filter(p => p.tipo !== 'variacao');
  const filtered = rootProducts.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Totals
  const totalProdutos = rootProducts.filter(p => p.tipo !== 'pai').length +
    products.filter(p => p.tipo === 'variacao').length;
  const totalBaixo = products.filter(p => p.tipo !== 'pai' && (p.estoque_atual || 0) <= (p.estoque_minimo || 0)).length;

  const StockRow = ({ p, isVariacao = false, indent = 0 }) => {
    const isLow = p.tipo !== 'pai' && (p.estoque_atual || 0) <= (p.estoque_minimo || 0);
    const isPai = p.tipo === 'pai';
    const variacoes = variacoesPorPai[p.id] || [];
    const totalPaiStock = isPai ? variacoes.reduce((s, v) => s + (v.estoque_atual || 0), 0) : null;
    const isExp = !!expanded[p.id];

    return (
      <>
        <tr className={`${isPai ? 'bg-orange-50/60' : isVariacao ? 'bg-slate-50/30' : ''} hover:bg-accent/30 transition-colors`}>
          {/* Produto */}
          <td className="border border-border px-2 py-1.5 text-xs">
            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${indent * 16}px` }}>
              {isPai && variacoes.length > 0 && (
                <button onClick={() => toggleExpand(p.id)} className="p-0.5 rounded hover:bg-orange-200 shrink-0">
                  {isExp ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
                </button>
              )}
              {isVariacao && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
              {!isPai && !isVariacao && <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <div>
                <p className="font-medium leading-tight">{p.nome}</p>
                {p.marca && <p className="text-[10px] text-muted-foreground">{p.marca}</p>}
              </div>
            </div>
          </td>
          {/* SKU */}
          <td className="border border-border px-2 py-1.5 text-xs font-mono text-muted-foreground">{p.sku}</td>
          {/* Categoria */}
          <td className="border border-border px-2 py-1.5 text-xs text-muted-foreground">{p.categoria || '—'}</td>
          {/* Estoque */}
          <td className="border border-border px-2 py-1.5 text-xs text-right">
            {isPai ? (
              <span className="text-muted-foreground text-[10px]">{totalPaiStock} total</span>
            ) : (
              <span className={`font-semibold ${isLow ? 'text-destructive' : ''}`}>
                {p.estoque_atual || 0} {p.unidade_medida || 'UN'}
              </span>
            )}
          </td>
          {/* Mínimo */}
          <td className="border border-border px-2 py-1.5 text-xs text-right text-muted-foreground">
            {isPai ? '—' : (p.estoque_minimo || 0)}
          </td>
          {/* Status */}
          <td className="border border-border px-2 py-1.5 text-xs text-center">
            {isPai ? (
              <Badge className="text-[9px] px-1 h-4 bg-orange-100 text-orange-700 border-0">Pai</Badge>
            ) : (
              <Badge variant={isLow ? 'destructive' : 'default'} className="text-[9px] px-1.5 h-4">
                {isLow ? 'Baixo' : 'OK'}
              </Badge>
            )}
          </td>
          {/* Ação */}
          <td className="border border-border px-2 py-1.5 text-xs text-center">
            {!isPai && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                onClick={() => { setMovementForm(f => ({ ...f, product_id: p.id })); setShowMovement(true); }}>
                + Mov.
              </Button>
            )}
          </td>
        </tr>
        {isPai && isExp && variacoes.map(v => (
          <StockRow key={v.id} p={v} isVariacao indent={1} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {totalProdutos} itens · <span className={totalBaixo > 0 ? 'text-destructive font-medium' : ''}>{totalBaixo} abaixo do mínimo</span>
          </p>
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

      {/* Busca */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-8" />
      </div>

      {/* Tabela de Estoque */}
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                <th className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground">SKU</th>
                <th className="border border-border px-2 py-2 text-left font-semibold text-muted-foreground">Categoria</th>
                <th className="border border-border px-2 py-2 text-right font-semibold text-muted-foreground">Estoque Atual</th>
                <th className="border border-border px-2 py-2 text-right font-semibold text-muted-foreground">Mínimo</th>
                <th className="border border-border px-2 py-2 text-center font-semibold text-muted-foreground">Status</th>
                <th className="border border-border px-2 py-2 text-center font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Warehouse className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(p => <StockRow key={p.id} p={p} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movimentações recentes */}
      <div>
        <h2 className="text-base font-semibold mb-3">Últimas Movimentações</h2>
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Tipo</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                <th className="border border-border px-3 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">NF</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Observação</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {movements.slice(0, 20).map(m => (
                <tr key={m.id} className="hover:bg-accent/20">
                  <td className="border border-border px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {['entrada', 'ajuste_positivo', 'devolucao'].includes(m.tipo)
                        ? <ArrowUpCircle className="w-3.5 h-3.5 text-green-600" />
                        : <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />}
                      {tipoLabels[m.tipo] || m.tipo}
                    </div>
                  </td>
                  <td className="border border-border px-3 py-1.5">{m.product_name}</td>
                  <td className="border border-border px-3 py-1.5 text-right font-medium">{m.quantidade}</td>
                  <td className="border border-border px-3 py-1.5 text-muted-foreground">{m.invoice_number || '-'}</td>
                  <td className="border border-border px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{m.observacao || '-'}</td>
                  <td className="border border-border px-3 py-1.5 text-muted-foreground">
                    {new Date(m.created_date).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma movimentação ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog movimentação */}
      <Dialog open={showMovement} onOpenChange={setShowMovement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Produto *</Label>
              <Select value={movementForm.product_id} onValueChange={v => setMovementForm(p => ({ ...p, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.tipo !== 'pai').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={movementForm.tipo} onValueChange={v => setMovementForm(p => ({ ...p, tipo: v }))}>
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
                <Input type="number" value={movementForm.quantidade} onChange={e => setMovementForm(p => ({ ...p, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label>Custo Unitário (R$)</Label>
                <Input type="number" step="0.01" value={movementForm.custo_unitario} onChange={e => setMovementForm(p => ({ ...p, custo_unitario: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Nº da Nota Fiscal</Label>
              <Input value={movementForm.invoice_number} onChange={e => setMovementForm(p => ({ ...p, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={movementForm.observacao} onChange={e => setMovementForm(p => ({ ...p, observacao: e.target.value }))} />
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