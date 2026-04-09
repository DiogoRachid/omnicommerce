import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package, Plus, Search, Edit, ToggleLeft, ToggleRight,
  Trash2, ChevronRight, ChevronDown, Layers, Sparkles, Bot
} from 'lucide-react';
import ProductFilters, { applyFilters } from '@/components/products/ProductFilters';
import { getCategoriaLabel, formatBRL, calcTributos } from '@/lib/productCategories';
import ProductAIModal from '@/components/products/ProductAIModal';
import ProductDetailModal from '@/components/products/ProductDetailModal';
import ColumnConfigPanel, { DEFAULT_COLUMNS } from '@/components/products/ColumnConfigPanel';
import ViewModeSelector from '@/components/products/ViewModeSelector';
import ProductManagerChat from '@/components/products/ProductManagerChat';
import BulkEditVariationsModal from '@/components/products/BulkEditVariationsModal.jsx';

// ── helpers ───────────────────────────────────────────────────────────────────

// Extrai o primeiro atributo de "Cor" das variacoes_atributos (ex: "Azul | 39" → "Azul")
function getPrimaryAttr(v) {
  return (v.variacoes_atributos || '').split('|')[0].trim() || v.nome;
}

// Agrupa variações pelo primeiro atributo (ex: Cor)
function groupByPrimary(variacoes) {
  const map = {};
  variacoes.forEach(v => {
    const key = getPrimaryAttr(v);
    if (!map[key]) map[key] = [];
    map[key].push(v);
  });
  return map;
}

// ── Hook de colunas redimensionáveis ─────────────────────────────────────────
function useResizableColumns(initialWidths) {
  const [colWidths, setColWidths] = useState(initialWidths);
  const dragging = useRef(null);

  const onMouseDown = useCallback((colKey, e) => {
    e.preventDefault();
    dragging.current = { colKey, startX: e.clientX, startW: colWidths[colKey] };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const delta = ev.clientX - dragging.current.startX;
      const newW = Math.max(40, dragging.current.startW + delta);
      setColWidths(prev => ({ ...prev, [dragging.current.colKey]: newW }));
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [colWidths]);

  return [colWidths, onMouseDown];
}

// ── Componente de linha de tabela ─────────────────────────────────────────────
function ProductRow({ p, visibleCols, selected, onSelect, onOpen, onToggle, onDelete, onBulkEdit,
  isVariacao = false, indent = 0, extraLeft, parentNome = '', parentCor = '' }) {
  const isPai = p.tipo === 'pai';
  const tributos = calcTributos(p.preco_venda, p.categoria);
  const catLabel = getCategoriaLabel(p.categoria);

  const Td = ({ children, right, mono, muted, small, className = '' }) => (
    <td className={`border border-border px-2 py-0.5 text-xs ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${muted ? 'text-muted-foreground' : ''} ${small ? 'text-[11px]' : ''} ${className}`}>
      {children}
    </td>
  );

  return (
    <tr
      className={`${selected ? 'bg-primary/5' : isPai ? 'bg-orange-50/60' : isVariacao ? 'bg-slate-50/40' : ''} hover:bg-accent/40 transition-colors cursor-pointer`}
      onClick={(e) => { if (e.target.closest('button,a,input')) return; onOpen(p); }}
    >
      {/* Checkbox */}
      <Td className="w-8 text-center" onClick={e => e.stopPropagation()}>
        <Checkbox checked={!!selected} onCheckedChange={v => onSelect(p.id, v)} />
      </Td>

      {/* Expand / indent + nome (sempre visível) */}
      <td className="border border-border px-2 py-0.5 text-xs">
        <div className="flex items-center gap-1.5" style={{ paddingLeft: `${indent * 16}px` }}>
          {extraLeft}
          {isVariacao && indent > 0 && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
          <div onClick={e => e.stopPropagation()}>
            <button className="text-left hover:text-primary transition-colors" onClick={() => onOpen(p)}>
              {isVariacao && parentNome ? (
                // Mostra só o que é diferente: remove nome do pai e cor já exibida
                <p className="font-medium leading-tight">
                  {(() => {
                    const attrs = (p.variacoes_atributos || '').split('|').map(s => s.trim());
                    // Se já mostramos a cor no grupo pai, exibe só o segundo atributo (numeração)
                    if (parentCor && attrs.length > 1) {
                      const rem = attrs.filter(a => a.toLowerCase() !== parentCor.toLowerCase());
                      return rem.join(' | ') || attrs[attrs.length - 1];
                    }
                    return attrs.join(' | ') || p.nome;
                  })()}
                </p>
              ) : (
                <p className="font-medium leading-tight">{p.nome}</p>
              )}
              {!isVariacao && p.marca && <p className="text-[10px] text-muted-foreground">{p.marca}</p>}
            </button>
          </div>
        </div>
      </td>

      {visibleCols.includes('foto') && (
        <Td className="w-10 text-center p-1">
          {p.fotos?.[0] ? (
            <img src={p.fotos[0]} className="w-8 h-8 rounded object-cover mx-auto" alt="" />
          ) : (
            <div className={`w-8 h-8 rounded flex items-center justify-center mx-auto ${isPai ? 'bg-orange-100' : 'bg-muted'}`}>
              {isPai ? <Layers className="w-3.5 h-3.5 text-orange-500" /> : <Package className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          )}
        </Td>
      )}
      {visibleCols.includes('categoria') && <Td muted small>{catLabel}</Td>}
      {visibleCols.includes('marca') && <Td muted small>{p.marca || '-'}</Td>}
      {visibleCols.includes('sku') && <Td mono muted>{p.sku}</Td>}
      {visibleCols.includes('ean') && <Td mono muted>{p.ean || '-'}</Td>}
      {visibleCols.includes('custo') && <Td right>{p.preco_custo ? formatBRL(p.preco_custo) : '-'}</Td>}
      {visibleCols.includes('preco') && (
        <Td right className="font-semibold">
          {p.preco_venda ? formatBRL(p.preco_venda) : isPai ? <span className="text-muted-foreground font-normal text-[10px]">ver var.</span> : '-'}
        </Td>
      )}
      {visibleCols.includes('tributos') && (
        <Td right muted small>
          {p.preco_venda && p.categoria ? formatBRL(tributos) : '-'}
        </Td>
      )}
      {visibleCols.includes('estoque') && (
        <Td right>
          {isPai ? <span className="text-muted-foreground">—</span> : (
            <span className={p.estoque_atual <= (p.estoque_minimo || 0) ? 'text-destructive font-semibold' : ''}>
              {(p.estoque_atual || 0).toLocaleString('pt-BR')} {p.unidade_medida || 'UN'}
            </span>
          )}
        </Td>
      )}
      {visibleCols.includes('status') && (
        <Td className="text-center">
          <div className="flex flex-col items-center gap-0.5">
            <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[9px] px-1.5 h-4">{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
            {isPai && <Badge className="text-[9px] px-1 h-4 bg-orange-100 text-orange-700 border-0">Pai</Badge>}
            {isVariacao && <Badge variant="outline" className="text-[9px] px-1 h-4">Var.</Badge>}
          </div>
        </Td>
      )}

      {/* Ações */}
      <Td className="text-center" onClick={e => e.stopPropagation()}>
        <div className="flex gap-0.5 justify-center">
          <Link to={`/produtos/editar/${p.id}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-3 h-3" /></Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(p.id, p.ativo)}>
            {p.ativo ? <ToggleRight className="w-3.5 h-3.5 text-primary" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onDelete(p.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </Td>
    </tr>
  );
}

// ── Renderer por modo de visualização ────────────────────────────────────────

function RenderRows({ paginatedFiltered, variacoesPorPai, viewMode, visibleCols, expanded, setExpanded, selected, setSelected, onOpen, onToggle, onDelete, onBulkEdit }) {
  const rows = [];

  const rowProps = (p, extra = {}) => ({
    visibleCols,
    selected: !!selected[p.id],
    onSelect: (id, v) => setSelected(prev => ({ ...prev, [id]: v })),
    onOpen,
    onToggle,
    onDelete,
    onBulkEdit,
    ...extra,
  });

  const varRow = (v, pNome, pCor, extra = {}) =>
    <ProductRow key={v.id} p={v} isVariacao parentNome={pNome} parentCor={pCor} {...rowProps(v, { isVariacao: true, ...extra })} />;

  if (viewMode === 'flat_all') {
    paginatedFiltered.forEach(p => {
      const variacoes = variacoesPorPai[p.id] || [];
      if (p.tipo === 'pai') {
        variacoes.forEach(v => rows.push(varRow(v, p.nome, '')));
      } else {
        rows.push(<ProductRow key={p.id} p={p} {...rowProps(p)} />);
      }
    });

  } else if (viewMode === 'cor_produto') {
    // Cada cor como produto independente
    paginatedFiltered.forEach(p => {
      const variacoes = variacoesPorPai[p.id] || [];
      if (p.tipo === 'pai') {
        const grouped = groupByPrimary(variacoes);
        Object.entries(grouped).forEach(([cor, vars]) => {
          const rep = vars[0];
          rows.push(
            <ProductRow key={`${p.id}-${cor}`} p={{ ...rep, nome: `${p.nome} — ${cor}`, tipo: 'variacao' }}
              isVariacao {...rowProps(rep, { isVariacao: true })} />
          );
        });
      } else {
        rows.push(<ProductRow key={p.id} p={p} {...rowProps(p)} />);
      }
    });

  } else if (viewMode === 'cor_numeracao') {
    // Pai → clica → cores → clica → numerações
    paginatedFiltered.forEach(p => {
      const variacoes = variacoesPorPai[p.id] || [];
      const isPai = p.tipo === 'pai';

      if (isPai) {
        const isExpPai = !!expanded[p.id];
        const grouped = groupByPrimary(variacoes);

        rows.push(
          <ProductRow key={p.id} p={p} {...rowProps(p)}
            extraLeft={
              <button onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] })); }}
                className="p-0.5 rounded hover:bg-orange-200 transition-colors shrink-0">
                {isExpPai ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
              </button>
            }
          />
        );

        if (isExpPai) {
          Object.entries(grouped).forEach(([cor, vars]) => {
            const corKey = `${p.id}-cor-${cor}`;
            const isExpCor = !!expanded[corKey];
            // Linha de grupo "cor"
            rows.push(
              <tr key={corKey} className="bg-orange-50/80 hover:bg-orange-100/60 cursor-pointer transition-colors"
                onClick={() => setExpanded(prev => ({ ...prev, [corKey]: !prev[corKey] }))}>
                <td colSpan={2} className="border border-border px-2 py-1.5">
                  <div className="flex items-center gap-2 pl-8 text-xs font-semibold text-orange-700">
                    {isExpCor ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    🎨 {cor}
                    <span className="font-normal text-orange-500">({vars.length} numerações)</span>
                  </div>
                </td>
                {visibleCols.includes('foto') && <td className="border border-border" />}
                {visibleCols.includes('categoria') && <td className="border border-border" />}
                {visibleCols.includes('marca') && <td className="border border-border" />}
                {visibleCols.includes('sku') && <td className="border border-border" />}
                {visibleCols.includes('ean') && <td className="border border-border" />}
                {visibleCols.includes('custo') && <td className="border border-border" />}
                {visibleCols.includes('preco') && <td className="border border-border" />}
                {visibleCols.includes('tributos') && <td className="border border-border" />}
                {visibleCols.includes('estoque') && (
                  <td className="border border-border px-2 py-1.5 text-xs text-right text-muted-foreground">
                    {vars.reduce((s, v) => s + (v.estoque_atual || 0), 0)} total
                  </td>
                )}
                {visibleCols.includes('status') && <td className="border border-border" />}
                <td className="border border-border" />
              </tr>
            );

            if (isExpCor) {
              vars.forEach(v => rows.push(varRow(v, p.nome, cor, { indent: 2 })));
            }
          });
        }
      } else {
        rows.push(<ProductRow key={p.id} p={p} {...rowProps(p)} />);
      }
    });

  } else if (viewMode === 'pai_flat') {
    paginatedFiltered.forEach(p => {
      const variacoes = variacoesPorPai[p.id] || [];
      const isPai = p.tipo === 'pai';
      const isExp = !!expanded[p.id];

      rows.push(
        <ProductRow key={p.id} p={p} {...rowProps(p)}
          extraLeft={isPai && variacoes.length > 0 ? (
            <button onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] })); }}
              className="p-0.5 rounded hover:bg-orange-200 transition-colors shrink-0">
              {isExp ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
            </button>
          ) : null}
        />
      );
      if (isPai && isExp) {
        variacoes.forEach(v => rows.push(varRow(v, p.nome, '', { indent: 1 })));
      }
    });

  } else {
    // pai_collapsed (default): pai → clica → abre cores (agrupado)
    paginatedFiltered.forEach(p => {
      const variacoes = variacoesPorPai[p.id] || [];
      const isPai = p.tipo === 'pai';
      const isExp = !!expanded[p.id];

      rows.push(
        <ProductRow key={p.id} p={p} {...rowProps(p)}
          extraLeft={isPai && variacoes.length > 0 ? (
            <button onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] })); }}
              className="p-0.5 rounded hover:bg-orange-200 transition-colors shrink-0">
              {isExp ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
            </button>
          ) : null}
        />
      );

      if (isPai && isExp) {
        const grouped = groupByPrimary(variacoes);
        Object.entries(grouped).forEach(([cor, vars]) => {
          const corKey = `${p.id}-cor-${cor}`;
          const isExpCor = !!expanded[corKey];
          rows.push(
            <tr key={corKey} className="bg-orange-50/80 hover:bg-orange-100/60 cursor-pointer transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [corKey]: !prev[corKey] }))}>
              <td colSpan={2} className="border border-border px-2 py-1.5">
                <div className="flex items-center gap-2 pl-6 text-xs font-semibold text-orange-700">
                  {isExpCor ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {cor}
                  <span className="font-normal text-orange-500">({vars.length})</span>
                </div>
              </td>
              {visibleCols.includes('foto') && <td className="border border-border" />}
              {visibleCols.includes('categoria') && <td className="border border-border" />}
              {visibleCols.includes('marca') && <td className="border border-border" />}
              {visibleCols.includes('sku') && <td className="border border-border" />}
              {visibleCols.includes('ean') && <td className="border border-border" />}
              {visibleCols.includes('custo') && <td className="border border-border" />}
              {visibleCols.includes('preco') && <td className="border border-border" />}
              {visibleCols.includes('tributos') && <td className="border border-border" />}
              {visibleCols.includes('estoque') && (
                <td className="border border-border px-2 py-1.5 text-xs text-right text-muted-foreground">
                  {vars.reduce((s, v) => s + (v.estoque_atual || 0), 0)}
                </td>
              )}
              {visibleCols.includes('status') && <td className="border border-border" />}
              <td className="border border-border" />
            </tr>
          );
          if (isExpCor) {
            vars.forEach(v => rows.push(varRow(v, p.nome, cor, { indent: 1 })));
          }
        });
      }
    });
  }

  return <>{rows}</>;
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Products() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showAIModal, setShowAIModal] = useState(false);
  const [filters, setFilters] = useState([]);
  const [page, setPage] = useState(0);
  const [detailProduct, setDetailProduct] = useState(null);
  const [showManagerChat, setShowManagerChat] = useState(false);
  const [bulkEditProduct, setBulkEditProduct] = useState(null); // produto pai para edição em massa
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('products_viewMode') || 'pai_collapsed');
  const [visibleCols, setVisibleCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('products_cols')) || DEFAULT_COLUMNS; } catch { return DEFAULT_COLUMNS; }
  });

  const [colWidths, onResizeCol] = useResizableColumns({
    produto: 220, foto: 48, categoria: 110, marca: 90, sku: 130, ean: 120,
    custo: 90, preco: 100, tributos: 90, estoque: 100, status: 72, acoes: 90,
  });

  const ITEMS_PER_PAGE = 50;
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 10000);
      }
      return base44.entities.Product.list('-created_date', 10000);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.Product.update(id, { ativo: !ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Remove movimentações de estoque vinculadas
      const movements = await base44.entities.StockMovement.filter({ product_id: id });
      for (const m of (movements || [])) {
        await base44.entities.StockMovement.delete(m.id);
      }
      // Remove anúncios vinculados
      const listings = await base44.entities.MarketplaceListing.filter({ product_id: id });
      for (const l of (listings || [])) {
        await base44.entities.MarketplaceListing.delete(l.id);
      }
      await base44.entities.Product.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
    },
  });

  // Persist preferences
  useEffect(() => { localStorage.setItem('products_viewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('products_cols', JSON.stringify(visibleCols)); }, [visibleCols]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

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
  const searched = rootProducts.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.ean?.includes(search)
  );
  const filtered = applyFilters(searched, filters);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedFiltered = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  useEffect(() => { setPage(0); }, [search, filters]);

  const handleDeleteSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    for (const id of ids) await base44.entities.Product.delete(id);
    setSelected({});
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  // Cabeçalho com resize handle
  const Th = ({ children, right, colKey }) => (
    <th
      style={{ width: colWidths[colKey], minWidth: 40, position: 'relative' }}
      className={`border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground whitespace-nowrap select-none ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
      <span
        onMouseDown={e => onResizeCol(colKey, e)}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 transition-colors"
        style={{ userSelect: 'none' }}
      />
    </th>
  );

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
          <Link to="/notas-fiscais/importar">
            <Button variant="outline">Importar XML</Button>
          </Link>
          <Button variant="outline" onClick={() => setShowManagerChat(true)} className="gap-2">
            <Bot className="w-4 h-4" /> Chat IA
          </Button>
          <Button variant="outline" onClick={() => setShowAIModal(true)} className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
            <Sparkles className="w-4 h-4" /> Cadastrar com IA
          </Button>
          <Link to="/produtos/novo">
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
          </Link>
        </div>
      </div>

      {/* Busca + controles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, SKU ou EAN..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-10 h-8" />
          </div>
          <div className="ml-auto flex gap-2">
            <ViewModeSelector viewMode={viewMode} onChange={setViewMode} />
            <ColumnConfigPanel visibleColumns={visibleCols} onChange={setVisibleCols} />
            {selectedCount > 0 && (
              <Button variant="destructive" size="sm" className="gap-1.5 h-8" onClick={handleDeleteSelected}>
                <Trash2 className="w-3.5 h-3.5" />
                Excluir {selectedCount}
              </Button>
            )}
          </div>
        </div>
        <ProductFilters products={products} filters={filters} onChange={setFilters} />
      </div>

      {/* Tabela */}
      {filtered.length === 0 && !isLoading ? (
        <div className="border rounded-lg p-12 text-center bg-card">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre um produto manualmente, importe via XML ou importe do Bling</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, minWidth: 36 }} className="border border-border bg-muted px-2 py-0.5">
                      <Checkbox
                        checked={paginatedFiltered.length > 0 && selectedCount === paginatedFiltered.length}
                        onCheckedChange={v => {
                          const s = {};
                          paginatedFiltered.forEach(p => { s[p.id] = v; });
                          setSelected(s);
                        }}
                      />
                    </th>
                    <Th colKey="produto">Produto</Th>
                    {visibleCols.includes('foto') && <Th colKey="foto">Foto</Th>}
                    {visibleCols.includes('categoria') && <Th colKey="categoria">Categoria</Th>}
                    {visibleCols.includes('marca') && <Th colKey="marca">Marca</Th>}
                    {visibleCols.includes('sku') && <Th colKey="sku">SKU</Th>}
                    {visibleCols.includes('ean') && <Th colKey="ean">EAN</Th>}
                    {visibleCols.includes('custo') && <Th right colKey="custo">Custo</Th>}
                    {visibleCols.includes('preco') && <Th right colKey="preco">Preço Venda</Th>}
                    {visibleCols.includes('tributos') && <Th right colKey="tributos">Tributos Aprox.</Th>}
                    {visibleCols.includes('estoque') && <Th right colKey="estoque">Estoque</Th>}
                    {visibleCols.includes('status') && <Th colKey="status">Status</Th>}
                    <Th colKey="acoes">Ações</Th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  <RenderRows
                    paginatedFiltered={paginatedFiltered}
                    variacoesPorPai={variacoesPorPai}
                    viewMode={viewMode}
                    visibleCols={visibleCols}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    selected={selected}
                    setSelected={setSelected}
                    onOpen={setDetailProduct}
                    onToggle={(id, ativo) => toggleMutation.mutate({ id, ativo })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onBulkEdit={setBulkEditProduct}
                  />
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
              * Tributos aproximados calculados com base nas alíquotas médias IBPT por categoria. Valores estimados.
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card">
              <p className="text-xs text-muted-foreground">
                {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                <span className="px-3 py-1.5 text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ProductManagerChat open={showManagerChat} onClose={() => setShowManagerChat(false)} selectedCompany={selectedCompany} />
      <ProductAIModal open={showAIModal} onClose={() => setShowAIModal(false)} selectedCompany={selectedCompany} />
      <BulkEditVariationsModal
        open={!!bulkEditProduct}
        onClose={() => setBulkEditProduct(null)}
        pai={bulkEditProduct}
        variacoes={bulkEditProduct ? (variacoesPorPai[bulkEditProduct.id] || []) : []}
      />
      <ProductDetailModal
        product={detailProduct}
        variacoes={detailProduct ? (variacoesPorPai[detailProduct.id] || []) : []}
        onClose={() => setDetailProduct(null)}
      />
    </div>
  );
}