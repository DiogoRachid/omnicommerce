import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, AlertCircle, CheckCircle2, Search, ChevronRight, ChevronDown, Package } from 'lucide-react';

const MP_NAMES = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon' };

// ── Ícones dos marketplaces ────────────────────────────────────────────────────
function MpIcon({ marketplace, published }) {
  if (marketplace === 'mercado_livre') {
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-all ${
        published ? 'bg-yellow-400' : 'bg-gray-200'
      }`}>
        <span className={`text-[8px] font-bold ${published ? 'text-black' : 'text-gray-400'}`}>ML</span>
      </div>
    );
  }
  if (marketplace === 'shopee') {
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-all ${
        published ? 'bg-orange-500' : 'bg-gray-200'
      }`}>
        <span className={`text-[8px] font-bold ${published ? 'text-white' : 'text-gray-400'}`}>SH</span>
      </div>
    );
  }
  if (marketplace === 'amazon') {
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-all ${
        published ? 'bg-amber-500' : 'bg-gray-200'
      }`}>
        <span className={`text-[8px] font-bold ${published ? 'text-white' : 'text-gray-400'}`}>AZ</span>
      </div>
    );
  }
  return null;
}

// ── Helpers de variação ────────────────────────────────────────────────────────
function getAttr1(v) {
  // atributo 1 = cor (primeira parte antes do |)
  const attrs = (v.variacoes_atributos || '').split('|').map(s => s.trim());
  return attrs[0] || '';
}
function getAttr2(v) {
  const attrs = (v.variacoes_atributos || '').split('|').map(s => s.trim());
  return attrs[1] || '';
}

// ── Agrupa filhos por attr1 (cor) ─────────────────────────────────────────────
function groupByAttr1(children) {
  const map = {};
  const order = [];
  for (const c of children) {
    const a1 = getAttr1(c) || '(sem cor)';
    if (!map[a1]) { map[a1] = []; order.push(a1); }
    map[a1].push(c);
  }
  return order.map(a1 => ({ attr1: a1, items: map[a1] }));
}

// ── Componente de linha de variação individual ─────────────────────────────────
function VariacaoRow({ v, listing, selected, onToggle, marketplace, onPublish, indent }) {
  const published = !!listing;
  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/30"
      onClick={() => onToggle(v.id)}
    >
      <TableCell className="w-10" style={{ paddingLeft: `${indent * 16 + 8}px` }} onClick={e => e.stopPropagation()}>
        <Checkbox checked={!!selected} onCheckedChange={() => onToggle(v.id)} />
      </TableCell>
      <TableCell className="font-medium text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
          <span className="truncate max-w-[140px] text-muted-foreground">{v.nome}</span>
          {v.variacoes_atributos && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
              {v.variacoes_atributos}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{v.sku || '-'}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{v.ean || '-'}</TableCell>
      <TableCell className="text-right text-sm">{v.preco_venda ? `R$ ${Number(v.preco_venda).toFixed(2)}` : '-'}</TableCell>
      <TableCell className="text-right text-sm">{v.estoque_atual ?? 0}</TableCell>
      <TableCell>
        <Badge variant={v.ativo ? 'default' : 'secondary'} className="text-[10px]">
          {v.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <MpIcon marketplace={marketplace} published={published} />
          <span className={`text-[10px] font-medium ${published ? 'text-green-700' : 'text-muted-foreground'}`}>
            {published ? 'Publicado' : 'Novo'}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {listing?.ultima_sync ? new Date(listing.ultima_sync).toLocaleDateString('pt-BR') : '-'}
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        {marketplace === 'mercado_livre' && (
          <Button
            size="sm"
            variant="outline"
            className={`text-[11px] h-7 gap-1 ${published ? 'border-green-400 text-green-700 hover:bg-green-50' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'}`}
            onClick={() => onPublish(v)}
          >
            <MpIcon marketplace={marketplace} published={published} />
            {published ? 'Atualizar' : 'Publicar'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Linha de grupo de cor (attr1) ─────────────────────────────────────────────
function ColorGroupRow({ attr1, items, listings, selected, onToggleGroup, marketplace, onPublish, expandedColors, onToggleColor }) {
  const isExpanded = expandedColors[attr1];
  const allSelected = items.every(v => selected[v.id]);
  const someSelected = items.some(v => selected[v.id]);
  const publishedCount = items.filter(v => listings.find(l => l.product_id === v.id && l.marketplace === marketplace)).length;

  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => onToggleColor(attr1)}>
        <TableCell className="w-10 pl-8" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={() => onToggleGroup(items)}
          />
        </TableCell>
        <TableCell className="font-medium text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 shrink-0">
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
            <span className="font-semibold text-foreground">{attr1}</span>
            <span className="text-[10px] text-muted-foreground">({items.length} tamanhos)</span>
            {publishedCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">
                {publishedCount} publicado(s)
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell colSpan={8} />
      </TableRow>
      {isExpanded && items.map(v => {
        const listing = listings.find(l => l.product_id === v.id && l.marketplace === marketplace);
        return (
          <VariacaoRow
            key={v.id}
            v={v}
            listing={listing}
            selected={selected[v.id]}
            onToggle={(id) => onToggleGroup([v], !selected[id])}
            marketplace={marketplace}
            onPublish={onPublish}
            indent={3}
          />
        );
      })}
    </>
  );
}

// ── Linha de produto pai ───────────────────────────────────────────────────────
function PaiRow({ pai, children, listings, selected, onTogglePai, onToggleGroup, marketplace, onPublish, expandedPais, onTogglePaiExpand, expandedColors, onToggleColor }) {
  const isExpanded = expandedPais[pai.id];
  const allIds = children.map(c => c.id);
  const allSelected = allIds.every(id => selected[id]);
  const someSelected = allIds.some(id => selected[id]);
  const publishedCount = children.filter(v => listings.find(l => l.product_id === v.id && l.marketplace === marketplace)).length;
  const colorGroups = useMemo(() => groupByAttr1(children), [children]);

  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/50 cursor-pointer font-semibold" onClick={() => onTogglePaiExpand(pai.id)}>
        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={() => onTogglePai(children)}
          />
        </TableCell>
        <TableCell className="font-semibold text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 shrink-0">
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-primary" />
                : <ChevronRight className="w-4 h-4 text-primary" />}
            </div>
            <Package className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate max-w-[140px]">{pai.nome}</span>
            <span className="text-[10px] text-muted-foreground font-normal">({children.length} variações)</span>
            {publishedCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 font-normal">
                {publishedCount}/{children.length} publicados
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs">{pai.sku || '-'}</TableCell>
        <TableCell colSpan={7} />
      </TableRow>
      {isExpanded && colorGroups.map(({ attr1, items }) => {
        const hasTwoLevels = items.some(v => getAttr2(v));
        if (hasTwoLevels || items.length > 1) {
          return (
            <ColorGroupRow
              key={attr1}
              attr1={attr1}
              items={items}
              listings={listings}
              selected={selected}
              onToggleGroup={(items, forceVal) => {
                const newSel = { ...selected };
                items.forEach(v => { newSel[v.id] = forceVal !== undefined ? forceVal : !selected[v.id]; });
                onToggleGroup(newSel);
              }}
              marketplace={marketplace}
              onPublish={onPublish}
              expandedColors={expandedColors}
              onToggleColor={onToggleColor}
            />
          );
        }
        // Se só tem 1 item sem second attr, mostra direto
        return items.map(v => {
          const listing = listings.find(l => l.product_id === v.id && l.marketplace === marketplace);
          return (
            <VariacaoRow
              key={v.id}
              v={v}
              listing={listing}
              selected={selected[v.id]}
              onToggle={(id) => {
                const newSel = { ...selected, [id]: !selected[id] };
                onToggleGroup(newSel);
              }}
              marketplace={marketplace}
              onPublish={onPublish}
              indent={2}
            />
          );
        });
      })}
    </>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ExportProducts({ companies, selectedCompany }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ nome: '', sku: '', ean: '', marketplace: 'mercado_livre' });
  const [selected, setSelected] = useState({});
  const [exporting, setExporting] = useState(false);
  const [conflictQueue, setConflictQueue] = useState([]);
  const [currentConflict, setCurrentConflict] = useState(null);
  const [exportLog, setExportLog] = useState([]);
  const [expandedPais, setExpandedPais] = useState({});
  const [expandedColors, setExpandedColors] = useState({});

  const [mlPublishProduct, setMlPublishProduct] = useState(null);
  const [mlForm, setMlForm] = useState({ title: '', price: '', quantity: '', category_id: '', category_name: '' });
  const [mlCategorySearch, setMlCategorySearch] = useState('');
  const [mlCategories, setMlCategories] = useState([]);
  const [mlSearching, setMlSearching] = useState(false);
  const [mlPublishing, setMlPublishing] = useState(false);
  const [mlPublishMsg, setMlPublishMsg] = useState(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 1000);
      }
      return base44.entities.Product.list('-created_date', 1000);
    },
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['listings', selectedCompany],
    queryFn: () => base44.entities.MarketplaceListing.list('-created_date', 500),
  });

  // ── Monta estrutura hierárquica ─────────────────────────────────────────────
  const { paiRows, simpleRows } = useMemo(() => {
    const activeProducts = products.filter(p => p.ativo);
    const childrenByPai = {};
    const paiMap = {};

    for (const p of activeProducts) {
      if (p.tipo === 'pai') paiMap[p.id] = p;
      else if (p.tipo === 'variacao' && p.produto_pai_id) {
        if (!childrenByPai[p.produto_pai_id]) childrenByPai[p.produto_pai_id] = [];
        childrenByPai[p.produto_pai_id].push(p);
      }
    }

    const paiRows = [];
    for (const pai of Object.values(paiMap)) {
      const children = childrenByPai[pai.id] || [];
      // filter
      const nome = filters.nome.toLowerCase();
      const sku = filters.sku.toLowerCase();
      const ean = filters.ean;
      const matchPai = (!nome || pai.nome.toLowerCase().includes(nome)) ||
        (!sku || (pai.sku || '').toLowerCase().includes(sku));
      const matchedChildren = children.filter(c =>
        (!nome || c.nome.toLowerCase().includes(nome) || pai.nome.toLowerCase().includes(nome)) &&
        (!sku || (c.sku || '').toLowerCase().includes(sku)) &&
        (!ean || (c.ean || '').includes(ean))
      );
      if (matchPai || matchedChildren.length > 0) {
        paiRows.push({ pai, children: matchedChildren.length > 0 ? matchedChildren : children });
      }
    }

    // Produtos simples (não pai e não variação)
    const simpleRows = activeProducts.filter(p => (!p.tipo || p.tipo === 'simples') && !p.produto_pai_id).filter(p => {
      const nome = filters.nome.toLowerCase();
      const sku = filters.sku.toLowerCase();
      const ean = filters.ean;
      if (nome && !p.nome.toLowerCase().includes(nome)) return false;
      if (sku && !(p.sku || '').toLowerCase().includes(sku)) return false;
      if (ean && !(p.ean || '').includes(ean)) return false;
      return true;
    });

    return { paiRows, simpleRows };
  }, [products, filters]);

  const getListing = (productId) =>
    listings.find(l => l.product_id === productId && l.marketplace === filters.marketplace);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const togglePai = (children) => {
    const allSelected = children.every(c => selected[c.id]);
    const newSel = { ...selected };
    children.forEach(c => { newSel[c.id] = !allSelected; });
    setSelected(newSel);
  };

  const toggleSimple = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const toggleAllSimple = (v) => {
    const newSel = { ...selected };
    simpleRows.forEach(p => { newSel[p.id] = v; });
    setSelected(newSel);
  };

  const logAction = async (tipo, status, p, mensagem, extra = {}) => {
    const entry = { tipo, status, marketplace: filters.marketplace, produto: p.nome, mensagem, detalhes: { sku: p.sku, ean: p.ean, ...extra } };
    await base44.entities.MarketplaceLog.create(entry);
    setExportLog(prev => [{ ...entry, id: Date.now() + Math.random(), created_date: new Date().toISOString() }, ...prev]);
  };

  const createListing = async (p) => {
    await base44.entities.MarketplaceListing.create({
      product_id: p.id,
      product_name: p.nome,
      marketplace: filters.marketplace,
      status: 'pendente',
      preco_anuncio: p.preco_venda,
      ultima_sync: new Date().toISOString(),
      company_id: p.company_id,
    });
  };

  const handleExport = async () => {
    const allProducts = [...paiRows.flatMap(r => r.children), ...simpleRows];
    const toExport = allProducts.filter(p => selected[p.id]);
    const conflicts = toExport.filter(p => getListing(p.id));
    const news = toExport.filter(p => !getListing(p.id));

    setExporting(true);
    for (const p of news) {
      await createListing(p);
      await logAction('exportacao', 'sucesso', p, 'Novo anúncio criado.');
    }
    queryClient.invalidateQueries({ queryKey: ['listings'] });

    if (conflicts.length > 0) {
      setConflictQueue(conflicts);
      setCurrentConflict(conflicts[0]);
    } else {
      setExporting(false);
    }
  };

  const resolveConflict = async (action) => {
    const p = currentConflict;
    const listing = getListing(p.id);
    if (action === 'update' && listing) {
      await base44.entities.MarketplaceListing.update(listing.id, {
        preco_anuncio: p.preco_venda,
        ultima_sync: new Date().toISOString(),
        status: 'pendente',
      });
      await logAction('atualizacao', 'sucesso', p, 'Anúncio atualizado.', { listing_id: listing.marketplace_item_id });
    } else if (action === 'skip') {
      await logAction('exportacao', 'sucesso', p, 'Produto não alterado.');
    } else {
      setConflictQueue([]); setCurrentConflict(null); setExporting(false); return;
    }
    const remaining = conflictQueue.slice(1);
    if (remaining.length > 0) {
      setConflictQueue(remaining); setCurrentConflict(remaining[0]);
    } else {
      setConflictQueue([]); setCurrentConflict(null); setExporting(false);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    }
  };

  const openMlPublish = (p) => {
    setMlPublishProduct(p);
    setMlForm({ title: p.nome || '', price: p.preco_venda ? String(p.preco_venda) : '', quantity: p.estoque_atual ? String(p.estoque_atual) : '1', category_id: '', category_name: '' });
    setMlCategories([]); setMlCategorySearch(''); setMlPublishMsg(null);
  };

  const handleMlCategorySearch = async () => {
    if (!mlCategorySearch.trim()) return;
    setMlSearching(true); setMlCategories([]);
    try {
      const res = await base44.functions.invoke('mlProxy', { action: 'getCategories', query: mlCategorySearch.trim() });
      setMlCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setMlPublishMsg({ type: 'error', text: 'Erro ao buscar categorias: ' + e.message });
    }
    setMlSearching(false);
  };

  const handleMlPublish = async () => {
    if (!mlForm.title.trim()) return setMlPublishMsg({ type: 'error', text: 'Informe o título do anúncio.' });
    if (!mlForm.price || isNaN(Number(mlForm.price))) return setMlPublishMsg({ type: 'error', text: 'Informe um preço válido.' });
    if (!mlForm.category_id) return setMlPublishMsg({ type: 'error', text: 'Selecione uma categoria.' });

    setMlPublishing(true); setMlPublishMsg(null);
    try {
      const res = await base44.functions.invoke('mlProxy', {
        action: 'createListing',
        product_id: mlPublishProduct.id,
        product_name: mlPublishProduct.nome,
        company_id: mlPublishProduct.company_id,
        listing: {
          title: mlForm.title.trim(),
          price: Number(mlForm.price),
          available_quantity: Number(mlForm.quantity) || 1,
          category_id: mlForm.category_id,
          listing_type_id: 'gold_special',
          condition: 'new',
          currency_id: 'BRL',
        },
      });
      if (res.data?.id) {
        setMlPublishMsg({ type: 'success', text: `Anúncio publicado! ID: ${res.data.id}` });
        await logAction('exportacao', 'sucesso', mlPublishProduct, `Publicado no ML. ID: ${res.data.id}`, { ml_id: res.data.id });
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        queryClient.invalidateQueries({ queryKey: ['listings', selectedCompany] });
      } else {
        throw new Error(res.data?.error || 'Resposta inesperada da API');
      }
    } catch (e) {
      setMlPublishMsg({ type: 'error', text: 'Erro ao publicar: ' + e.message });
    }
    setMlPublishing(false);
  };

  const totalProducts = paiRows.reduce((acc, r) => acc + r.children.length, 0) + simpleRows.length;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Exportar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Marketplace destino</label>
              <Select value={filters.marketplace} onValueChange={v => setFilters(f => ({ ...f, marketplace: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input placeholder="Filtrar por nome" value={filters.nome} onChange={e => setFilters(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
              <Input placeholder="Filtrar por SKU" value={filters.sku} onChange={e => setFilters(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">EAN</label>
              <Input placeholder="Filtrar por EAN" value={filters.ean} onChange={e => setFilters(f => ({ ...f, ean: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela hierárquica */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">
              {paiRows.length} produtos pai · {simpleRows.length} simples · {selectedCount} selecionados
            </CardTitle>
            <Button onClick={handleExport} disabled={selectedCount === 0 || exporting} className="gap-2" size="sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Exportar selecionados ({selectedCount})
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Última Sync</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalProducts === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhum produto ativo encontrado.
                  </TableCell>
                </TableRow>
              )}

              {/* Produtos pai com variações */}
              {paiRows.map(({ pai, children }) => (
                <PaiRow
                  key={pai.id}
                  pai={pai}
                  children={children}
                  listings={listings}
                  selected={selected}
                  onTogglePai={togglePai}
                  onToggleGroup={(newSel) => setSelected(newSel)}
                  marketplace={filters.marketplace}
                  onPublish={openMlPublish}
                  expandedPais={expandedPais}
                  onTogglePaiExpand={(id) => setExpandedPais(s => ({ ...s, [id]: !s[id] }))}
                  expandedColors={expandedColors}
                  onToggleColor={(attr1) => setExpandedColors(s => ({ ...s, [attr1]: !s[attr1] }))}
                />
              ))}

              {/* Produtos simples */}
              {simpleRows.length > 0 && (
                <>
                  {paiRows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-1 px-4 bg-muted/20">
                        <span className="text-xs text-muted-foreground font-medium">Produtos Simples</span>
                      </TableCell>
                    </TableRow>
                  )}
                  {simpleRows.map(p => {
                    const listing = getListing(p.id);
                    const published = !!listing;
                    return (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-accent/20" onClick={() => toggleSimple(p.id)}>
                        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={!!selected[p.id]} onCheckedChange={() => toggleSimple(p.id)} />
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[160px]">{p.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{p.ean || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{p.preco_venda ? `R$ ${Number(p.preco_venda).toFixed(2)}` : '-'}</TableCell>
                        <TableCell className="text-right text-sm">{p.estoque_atual ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px]">
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MpIcon marketplace={filters.marketplace} published={published} />
                            <span className={`text-[10px] font-medium ${published ? 'text-green-700' : 'text-muted-foreground'}`}>
                              {published ? 'Publicado' : 'Novo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {listing?.ultima_sync ? new Date(listing.ultima_sync).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {filters.marketplace === 'mercado_livre' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`text-[11px] h-7 gap-1 ${published ? 'border-green-400 text-green-700 hover:bg-green-50' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'}`}
                              onClick={() => openMlPublish(p)}
                            >
                              <MpIcon marketplace={filters.marketplace} published={published} />
                              {published ? 'Atualizar' : 'Publicar'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Log */}
      {exportLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Log de Exportação</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-48 overflow-y-auto">
            {exportLog.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                <Badge variant={l.status === 'sucesso' ? 'default' : 'destructive'} className="text-[9px]">{l.status}</Badge>
                <span className="font-medium truncate">{l.produto}</span>
                <span className="text-muted-foreground flex-1">{l.mensagem}</span>
                <span className="text-muted-foreground shrink-0">{new Date(l.created_date).toLocaleTimeString('pt-BR')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal publicar no ML */}
      <Dialog open={!!mlPublishProduct && !currentConflict} onOpenChange={(open) => { if (!open && !mlPublishing) setMlPublishProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center shrink-0">
                <span className="text-black text-[9px] font-bold">ML</span>
              </div>
              Publicar no Mercado Livre
            </DialogTitle>
          </DialogHeader>
          {mlPublishProduct && (
            <div className="space-y-4 py-1">
              {mlPublishMsg && (
                <Alert className={mlPublishMsg.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {mlPublishMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                  <AlertDescription className={mlPublishMsg.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                    {mlPublishMsg.text}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Título do anúncio</Label>
                <Input className="mt-1" value={mlForm.title} onChange={e => setMlForm(f => ({ ...f, title: e.target.value }))} placeholder="Título que aparecerá no ML" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                  <Input className="mt-1" type="number" min="0" step="0.01" value={mlForm.price} onChange={e => setMlForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quantidade disponível</Label>
                  <Input className="mt-1" type="number" min="1" value={mlForm.quantity} onChange={e => setMlForm(f => ({ ...f, quantity: e.target.value }))} placeholder="1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Categoria do ML</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={mlCategorySearch} onChange={e => setMlCategorySearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleMlCategorySearch()} placeholder="Ex: Smartphone, Tênis..." className="flex-1" />
                  <Button variant="outline" size="sm" onClick={handleMlCategorySearch} disabled={mlSearching} className="gap-1.5 shrink-0">
                    {mlSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar
                  </Button>
                </div>
                {mlForm.category_name && <p className="text-xs text-green-700 mt-1.5 font-medium">✓ {mlForm.category_name}</p>}
                {mlCategories.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {mlCategories.map(cat => (
                      <button key={cat.category_id} className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors" onClick={() => { setMlForm(f => ({ ...f, category_id: cat.category_id, category_name: cat.category_name || cat.domain_name })); setMlCategories([]); }}>
                        <span className="font-medium">{cat.category_name || cat.domain_name}</span>
                        <span className="text-muted-foreground ml-2">{cat.category_id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMlPublishProduct(null)} disabled={mlPublishing}>Cancelar</Button>
            <Button onClick={handleMlPublish} disabled={mlPublishing || mlPublishMsg?.type === 'success'} className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold">
              {mlPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Publicar no ML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal conflito */}
      <Dialog open={!!currentConflict} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" /> Produto já existe no marketplace
            </DialogTitle>
          </DialogHeader>
          {currentConflict && (() => {
            const listing = getListing(currentConflict.id);
            return (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">Restam <strong>{conflictQueue.length}</strong> produto(s) com conflito.</p>
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <p><strong>Produto:</strong> {currentConflict.nome}</p>
                  <p><strong>SKU:</strong> {currentConflict.sku || '-'}</p>
                  <p><strong>ID do anúncio:</strong> {listing?.marketplace_item_id || '-'}</p>
                  <p><strong>Preço atual:</strong> {listing?.preco_anuncio ? `R$ ${listing.preco_anuncio.toFixed(2)}` : '-'}</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => resolveConflict('cancel')}>Cancelar exportação</Button>
            <Button variant="secondary" onClick={() => resolveConflict('skip')}>Não alterar produto</Button>
            <Button onClick={() => resolveConflict('update')}>Atualizar produto existente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}