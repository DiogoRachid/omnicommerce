import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, PauseCircle, PlayCircle, RefreshCw, X, Plus, Download } from 'lucide-react';

const marketplaceNames = {
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  magalu: 'Magalu',
  americanas: 'Americanas',
};

const statusColors = {
  ativo: 'default',
  pausado: 'secondary',
  inativo: 'outline',
  erro: 'destructive',
  pendente: 'secondary',
};

const FILTER_FIELDS = [
  { key: 'marketplace', label: 'Marketplace', type: 'select', options: Object.entries(marketplaceNames).map(([v, l]) => ({ value: v, label: l })) },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'ativo', label: 'Ativo' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'inativo', label: 'Inativo' },
    { value: 'erro', label: 'Erro' },
    { value: 'pendente', label: 'Pendente' },
  ]},
  { key: 'product_name', label: 'Nome do Produto', type: 'text' },
  { key: 'marketplace_item_id', label: 'ID do Anúncio', type: 'text' },
];

function DynamicFilters({ filters, onChange }) {
  const [addingKey, setAddingKey] = useState('');

  const activeKeys = filters.map(f => f.key);
  const available = FILTER_FIELDS.filter(f => !activeKeys.includes(f.key));

  const addFilter = (key) => {
    const field = FILTER_FIELDS.find(f => f.key === key);
    if (!field) return;
    onChange([...filters, { key, value: '' }]);
    setAddingKey('');
  };

  const removeFilter = (key) => onChange(filters.filter(f => f.key !== key));

  const updateFilter = (key, value) =>
    onChange(filters.map(f => f.key === key ? { ...f, value } : f));

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {filters.map(f => {
        const field = FILTER_FIELDS.find(ff => ff.key === f.key);
        if (!field) return null;
        return (
          <div key={f.key} className="flex items-center gap-1 bg-primary/5 border border-primary/20 rounded-lg px-2 py-1">
            <span className="text-xs font-medium text-primary shrink-0">{field.label}:</span>
            {field.type === 'select' ? (
              <Select value={f.value} onValueChange={v => updateFilter(f.key, v)}>
                <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 pr-6 min-w-[80px] focus:ring-0">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                className="text-xs bg-transparent outline-none border-0 w-28 placeholder:text-muted-foreground"
                placeholder="..."
                value={f.value}
                onChange={e => updateFilter(f.key, e.target.value)}
              />
            )}
            <button onClick={() => removeFilter(f.key)} className="ml-1 text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      {available.length > 0 && (
        <Select value={addingKey} onValueChange={addFilter}>
          <SelectTrigger className="h-7 text-xs border-dashed gap-1 px-2 w-auto">
            <Plus className="w-3 h-3" />
            <span>Filtro</span>
          </SelectTrigger>
          <SelectContent>
            {available.map(f => (
              <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {filters.length > 0 && (
        <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
    </div>
  );
}

export default function ListingsTable({
  listings,
  loadingAction,
  onPause,
  onReactivate,
  onOpenStockDialog,
  onSyncAll,
  syncingAll,
  marketplaceFilter, // from card click
  onClearMarketplaceFilter,
  onImportSelected,
}) {
  const [filters, setFilters] = useState([]);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');

  // Apply card filter + dynamic filters
  const filtered = useMemo(() => {
    let result = listings;
    if (marketplaceFilter) {
      result = result.filter(l => l.marketplace === marketplaceFilter);
    }
    if (search) {
      result = result.filter(l => l.product_name?.toLowerCase().includes(search.toLowerCase()));
    }
    filters.forEach(f => {
      if (!f.value) return;
      result = result.filter(l => {
        const val = String(l[f.key] || '').toLowerCase();
        return val.includes(f.value.toLowerCase());
      });
    });
    return result;
  }, [listings, filters, search, marketplaceFilter]);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedItems = filtered.filter(l => selected[l.id]);

  const toggleAll = (v) => {
    const s = {};
    filtered.forEach(l => { s[l.id] = !!v; });
    setSelected(s);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs w-48"
          />
          <DynamicFilters filters={filters} onChange={setFilters} />
          {marketplaceFilter && (
            <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1">
              <span className="text-xs font-medium text-yellow-800">{marketplaceNames[marketplaceFilter]}</span>
              <button onClick={onClearMarketplaceFilter} className="ml-1 text-yellow-600 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {selectedCount > 0 && onImportSelected && (
            <Button size="sm" className="gap-1.5 h-7 bg-green-600 hover:bg-green-700 text-xs"
              onClick={() => onImportSelected(selectedItems)}>
              <Download className="w-3.5 h-3.5" />
              Importar {selectedCount}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onSyncAll} disabled={syncingAll} className="gap-1.5 h-7 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? 'Sincronizando...' : 'Sincronizar todos'}
          </Button>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} anúncio(s){selectedCount > 0 ? ` · ${selectedCount} selecionado(s)` : ''}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
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
              <TableHead>Marketplace</TableHead>
              <TableHead>ID Anúncio</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Sync</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  Nenhum anúncio encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id} className={selected[l.id] ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={!!selected[l.id]}
                      onCheckedChange={v => setSelected(s => ({ ...s, [l.id]: !!v }))}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">{l.product_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {marketplaceNames[l.marketplace] || l.marketplace}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.marketplace_item_id || '-'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {l.preco_anuncio ? `R$ ${l.preco_anuncio.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[l.status] || 'secondary'} className="text-[10px] capitalize">
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.ultima_sync ? new Date(l.ultima_sync).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {l.url_anuncio && (
                        <a href={l.url_anuncio} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {l.status === 'ativo' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:bg-orange-50"
                          disabled={!!loadingAction[`${l.id}_pause`]}
                          onClick={() => onPause(l)}
                          title="Pausar anúncio">
                          <PauseCircle className={`w-3.5 h-3.5 ${loadingAction[`${l.id}_pause`] ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      {l.status === 'pausado' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50"
                          disabled={!!loadingAction[`${l.id}_reactivate`]}
                          onClick={() => onReactivate(l)}
                          title="Reativar anúncio">
                          <PlayCircle className={`w-3.5 h-3.5 ${loadingAction[`${l.id}_reactivate`] ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                        onClick={() => onOpenStockDialog(l)}
                        title="Atualizar estoque/preço">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}