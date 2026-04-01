import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package, Plus, Search, Edit, ToggleLeft, ToggleRight,
  Trash2, ChevronRight, ChevronDown, Layers, Download
} from 'lucide-react';
import BlingImportDialog from '@/components/bling/BlingImportDialog';

export default function Products() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showBlingImport, setShowBlingImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 500);
      }
      return base44.entities.Product.list('-created_date', 500);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.Product.update(id, { ativo: !ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const handleDeleteSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    for (const id of ids) {
      await base44.entities.Product.delete(id);
    }
    setSelected({});
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // Separa em root (pai + simples) e variações por pai
  const rootProducts = products.filter(p => p.tipo !== 'variacao');
  const variacoesPorPai = {};
  products.filter(p => p.tipo === 'variacao').forEach(v => {
    if (v.produto_pai_id) {
      if (!variacoesPorPai[v.produto_pai_id]) variacoesPorPai[v.produto_pai_id] = [];
      variacoesPorPai[v.produto_pai_id].push(v);
    }
  });

  const filtered = rootProducts.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.ean?.includes(search)
  );

  const toggleAll = (val) => {
    const s = {};
    filtered.forEach(p => { s[p.id] = val; });
    setSelected(s);
  };

  const toggleExpanded = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Encontra a empresa selecionada para o dialog de importação
  const companyForImport = selectedCompany && selectedCompany !== 'all'
    ? { id: selectedCompany }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {rootProducts.length} produtos · {products.filter(p => p.tipo === 'variacao').length} variações
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowBlingImport(true)} className="gap-2">
            <Download className="w-4 h-4" /> Importar do Bling
          </Button>
          <Link to="/notas-fiscais/importar">
            <Button variant="outline">Importar XML</Button>
          </Link>
          <Link to="/produtos/novo">
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou EAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleDeleteSelected}
          >
            <Trash2 className="w-4 h-4" />
            Excluir {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {filtered.length === 0 && !isLoading ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre um produto manualmente, importe via XML ou importe do Bling</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedCount === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const isPai = p.tipo === 'pai';
                  const variacoes = isPai ? (variacoesPorPai[p.id] || []) : [];
                  const isExpanded = expanded[p.id];

                  return (
                    <React.Fragment key={p.id}>
                      <TableRow className={selected[p.id] ? 'bg-muted/40' : isPai ? 'bg-orange-50/40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={!!selected[p.id]}
                            onCheckedChange={(v) => setSelected(prev => ({ ...prev, [p.id]: v }))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isPai && (
                              <button
                                onClick={() => toggleExpanded(p.id)}
                                className="p-0.5 rounded hover:bg-orange-200 transition-colors flex-shrink-0"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-orange-600" />
                                  : <ChevronRight className="w-4 h-4 text-orange-600" />
                                }
                              </button>
                            )}
                            {p.fotos?.[0] ? (
                              <img src={p.fotos[0]} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" alt="" />
                            ) : (
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPai ? 'bg-orange-100' : 'bg-muted'}`}>
                                {isPai
                                  ? <Layers className="w-4 h-4 text-orange-500" />
                                  : <Package className="w-4 h-4 text-muted-foreground" />
                                }
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {p.nome}
                                {isPai && variacoes.length > 0 && (
                                  <span className="text-xs text-orange-600 ml-1.5 font-normal">
                                    ({variacoes.length} variações)
                                  </span>
                                )}
                              </p>
                              {p.marca && <p className="text-xs text-muted-foreground">{p.marca}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{p.sku}</TableCell>
                        <TableCell className="text-sm font-mono">{p.ean || '-'}</TableCell>
                        <TableCell className="text-right text-sm">
                          {p.preco_custo ? `R$ ${p.preco_custo.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : (isPai ? <span className="text-muted-foreground text-xs">ver variações</span> : '-')}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPai ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={p.estoque_atual <= (p.estoque_minimo || 0) ? 'text-destructive font-semibold' : ''}>
                              {p.estoque_atual || 0} {p.unidade_medida || 'UN'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px]">
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                            {isPai && <Badge className="text-[10px] bg-orange-100 text-orange-700 border-0">Pai</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link to={`/produtos/editar/${p.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => toggleMutation.mutate({ id: p.id, ativo: p.ativo })}
                            >
                              {p.ativo ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(p.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Linhas de variações expandidas */}
                      {isPai && isExpanded && variacoes.map(v => (
                        <TableRow key={v.id} className="bg-muted/10 border-l-2 border-l-orange-200">
                          <TableCell />
                          <TableCell className="pl-14">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm">{v.variacoes_atributos || v.nome}</p>
                                {v.ean && <p className="text-xs text-muted-foreground font-mono">{v.ean}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">{v.sku}</TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">{v.ean || '-'}</TableCell>
                          <TableCell className="text-right text-sm">
                            {v.preco_custo ? `R$ ${v.preco_custo.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {v.preco_venda ? `R$ ${v.preco_venda.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={v.estoque_atual <= (v.estoque_minimo || 0) ? 'text-destructive font-semibold' : 'text-sm'}>
                              {v.estoque_atual || 0} {v.unidade_medida || 'UN'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">Variação</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Link to={`/produtos/editar/${v.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteMutation.mutate(v.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <BlingImportDialog
        company={companyForImport}
        open={showBlingImport}
        onClose={() => setShowBlingImport(false)}
      />
    </div>
  );
}