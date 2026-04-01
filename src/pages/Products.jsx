import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package, Plus, Search, Edit, ToggleLeft, ToggleRight,
  Trash2, ChevronRight, ChevronDown, Layers, Download
} from 'lucide-react';
import BlingImportDialog from '@/components/bling/BlingImportDialog';
import ProductFilters, { applyFilters } from '@/components/products/ProductFilters';
import { CATEGORIA_MAP, formatBRL, calcTributos } from '@/lib/productCategories';

export default function Products() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showBlingImport, setShowBlingImport] = useState(false);
  const [filters, setFilters] = useState([]);
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
    for (const id of ids) await base44.entities.Product.delete(id);
    setSelected({});
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // Separa variações dos root
  const rootProducts = products.filter(p => p.tipo !== 'variacao');
  const variacoesPorPai = {};
  products.filter(p => p.tipo === 'variacao').forEach(v => {
    if (v.produto_pai_id) {
      if (!variacoesPorPai[v.produto_pai_id]) variacoesPorPai[v.produto_pai_id] = [];
      variacoesPorPai[v.produto_pai_id].push(v);
    }
  });

  // Aplica busca e filtros
  const searched = rootProducts.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.ean?.includes(search)
  );
  const filtered = applyFilters(searched, filters);

  const toggleAll = (val) => {
    const s = {};
    filtered.forEach(p => { s[p.id] = val; });
    setSelected(s);
  };

  const toggleExpanded = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const companyForImport = selectedCompany && selectedCompany !== 'all' ? { id: selectedCompany } : null;

  // Cabeçalho de coluna com estilo planilha
  const Th = ({ children, right, w }) => (
    <th className={`border border-border bg-muted px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${w || ''}`}>
      {children}
    </th>
  );

  const Td = ({ children, right, mono, muted, small, className = '' }) => (
    <td className={`border border-border px-2 py-1.5 text-xs ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${muted ? 'text-muted-foreground' : ''} ${small ? 'text-[11px]' : ''} ${className}`}>
      {children}
    </td>
  );

  const renderProductRow = (p, isVariacao = false, paiNome = '') => {
    const isPai = p.tipo === 'pai';
    const isExpanded = expanded[p.id];
    const variacoes = isPai ? (variacoesPorPai[p.id] || []) : [];
    const tributos = calcTributos(p.preco_venda, p.categoria);
    const catLabel = CATEGORIA_MAP[p.categoria]?.label || p.categoria || '-';

    return (
      <React.Fragment key={p.id}>
        <tr
          className={`
            ${selected[p.id] ? 'bg-primary/5' : ''}
            ${isPai ? 'bg-orange-50/60' : ''}
            ${isVariacao ? 'bg-slate-50/60' : ''}
            hover:bg-accent/40 transition-colors
          `}
        >
          {/* Checkbox */}
          <Td className="w-8 text-center">
            <Checkbox
              checked={!!selected[p.id]}
              onCheckedChange={(v) => setSelected(prev => ({ ...prev, [p.id]: v }))}
            />
          </Td>

          {/* Foto */}
          <Td className="w-10 text-center p-1">
            {p.fotos?.[0] ? (
              <img src={p.fotos[0]} className="w-8 h-8 rounded object-cover mx-auto" alt="" />
            ) : (
              <div className={`w-8 h-8 rounded flex items-center justify-center mx-auto ${isPai ? 'bg-orange-100' : 'bg-muted'}`}>
                {isPai ? <Layers className="w-3.5 h-3.5 text-orange-500" /> : <Package className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            )}
          </Td>

          {/* Categoria */}
          <Td muted small>{catLabel}</Td>

          {/* Produto / Nome */}
          <Td className={isVariacao ? 'pl-8' : ''}>
            <div className="flex items-center gap-1.5">
              {isPai && (
                <button
                  onClick={() => toggleExpanded(p.id)}
                  className="p-0.5 rounded hover:bg-orange-200 transition-colors flex-shrink-0"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" />
                    : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />
                  }
                </button>
              )}
              {isVariacao && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 ml-2" />}
              <div>
                <p className="font-medium leading-tight">
                  {p.nome}
                  {isPai && variacoes.length > 0 && (
                    <span className="text-[10px] text-orange-600 ml-1.5 font-normal">({variacoes.length} var.)</span>
                  )}
                </p>
                {p.marca && <p className="text-[10px] text-muted-foreground">{p.marca}</p>}
                {isVariacao && p.variacoes_atributos && (
                  <p className="text-[10px] text-muted-foreground">{p.variacoes_atributos}</p>
                )}
              </div>
            </div>
          </Td>

          {/* SKU */}
          <Td mono muted>{p.sku}</Td>

          {/* EAN */}
          <Td mono muted>{p.ean || '-'}</Td>

          {/* Custo */}
          <Td right>{p.preco_custo ? formatBRL(p.preco_custo) : '-'}</Td>

          {/* Preço Venda */}
          <Td right className="font-semibold">
            {p.preco_venda ? formatBRL(p.preco_venda) : (isPai ? <span className="text-muted-foreground font-normal text-[10px]">ver var.</span> : '-')}
          </Td>

          {/* Tributos aprox. */}
          <Td right muted small>
            {p.preco_venda && p.categoria ? (
              <span title={`Alíquota aprox.: ${(CATEGORIA_MAP[p.categoria]?.aliquota * 100 || 0).toFixed(1)}%`}>
                {formatBRL(tributos)}
              </span>
            ) : '-'}
          </Td>

          {/* Estoque */}
          <Td right>
            {isPai ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className={p.estoque_atual <= (p.estoque_minimo || 0) ? 'text-destructive font-semibold' : ''}>
                {(p.estoque_atual || 0).toLocaleString('pt-BR')} {p.unidade_medida || 'UN'}
              </span>
            )}
          </Td>

          {/* Status */}
          <Td className="text-center">
            <div className="flex flex-col items-center gap-0.5">
              <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[9px] px-1.5 h-4">
                {p.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
              {isPai && <Badge className="text-[9px] px-1 h-4 bg-orange-100 text-orange-700 border-0">Pai</Badge>}
              {isVariacao && <Badge variant="outline" className="text-[9px] px-1 h-4">Var.</Badge>}
            </div>
          </Td>

          {/* Ações */}
          <Td className="text-center">
            <div className="flex gap-0.5 justify-center">
              <Link to={`/produtos/editar/${p.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Edit className="w-3 h-3" />
                </Button>
              </Link>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => toggleMutation.mutate({ id: p.id, ativo: p.ativo })}
              >
                {p.ativo ? <ToggleRight className="w-3.5 h-3.5 text-primary" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => deleteMutation.mutate(p.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </Td>
        </tr>

        {/* Variações expandidas */}
        {isPai && isExpanded && variacoes.map(v => renderProductRow(v, true, p.nome))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Busca + Filtros + Excluir */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou EAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-8"
            />
          </div>
          {selectedCount > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5 h-8" onClick={handleDeleteSelected}>
              <Trash2 className="w-3.5 h-3.5" />
              Excluir {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
            </Button>
          )}
        </div>
        <ProductFilters products={products} filters={filters} onChange={setFilters} />
      </div>

      {/* Tabela planilha */}
      {filtered.length === 0 && !isLoading ? (
        <div className="border rounded-lg p-12 text-center bg-card">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre um produto manualmente, importe via XML ou importe do Bling</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <Th w="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && selectedCount === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </Th>
                  <Th w="w-10">Foto</Th>
                  <Th w="w-28">Categoria</Th>
                  <Th>Produto</Th>
                  <Th w="w-28">SKU</Th>
                  <Th w="w-28">EAN</Th>
                  <Th right w="w-24">Custo</Th>
                  <Th right w="w-24">Preço Venda</Th>
                  <Th right w="w-24">Tributos Aprox.</Th>
                  <Th right w="w-28">Estoque</Th>
                  <Th w="w-20">Status</Th>
                  <Th w="w-24">Ações</Th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {filtered.map(p => renderProductRow(p))}
              </tbody>
            </table>
          </div>
          {/* Legenda tributos */}
          <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
            * Tributos aproximados calculados com base nas alíquotas médias IBPT por categoria (federal + estadual). Valores estimados.
          </div>
        </div>
      )}

      <BlingImportDialog
        company={companyForImport}
        open={showBlingImport}
        onClose={() => setShowBlingImport(false)}
      />
    </div>
  );
}