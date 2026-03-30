import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

const MP_NAMES = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon' };

const STATUS_LABELS = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  ja_cadastrado: { label: 'Já cadastrado', color: 'bg-yellow-100 text-yellow-700' },
  atualizado: { label: 'Atualizado', color: 'bg-green-100 text-green-700' },
  nao_alterado: { label: 'Não alterado', color: 'bg-gray-100 text-gray-600' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.novo;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
}

export default function ExportProducts({ companies, selectedCompany }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ nome: '', sku: '', ean: '', marketplace: 'mercado_livre' });
  const [selected, setSelected] = useState({});
  const [exporting, setExporting] = useState(false);
  const [conflictQueue, setConflictQueue] = useState([]);
  const [currentConflict, setCurrentConflict] = useState(null);
  const [exportLog, setExportLog] = useState([]);

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

  const filtered = products.filter(p => {
    if (!p.ativo) return false;
    if (filters.nome && !p.nome.toLowerCase().includes(filters.nome.toLowerCase())) return false;
    if (filters.sku && !(p.sku || '').toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.ean && !(p.ean || '').includes(filters.ean)) return false;
    return true;
  });

  const getListing = (productId) =>
    listings.find(l => l.product_id === productId && l.marketplace === filters.marketplace);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const toggleAll = (v) => {
    const s = {};
    filtered.forEach(p => { s[p.id] = v; });
    setSelected(s);
  };

  const logAction = async (tipo, status, p, mensagem, extra = {}) => {
    const entry = {
      tipo, status,
      marketplace: filters.marketplace,
      produto: p.nome,
      mensagem,
      detalhes: { sku: p.sku, ean: p.ean, ...extra },
    };
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
    const toExport = filtered.filter(p => selected[p.id]);
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
      setConflictQueue([]);
      setCurrentConflict(null);
      setExporting(false);
      return;
    }

    const remaining = conflictQueue.slice(1);
    if (remaining.length > 0) {
      setConflictQueue(remaining);
      setCurrentConflict(remaining[0]);
    } else {
      setConflictQueue([]);
      setCurrentConflict(null);
      setExporting(false);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Exportar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">{filtered.length} produtos — {selectedCount} selecionados</CardTitle>
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0 || exporting}
              className="gap-2"
              size="sm"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Exportar selecionados ({selectedCount})
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selectedCount === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Última Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum produto ativo encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(p => {
                const listing = getListing(p.id);
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={!!selected[p.id]} onCheckedChange={v => setSelected(s => ({ ...s, [p.id]: v }))} />
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[160px] truncate">{p.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ean || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-right text-sm">{p.estoque_atual ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px]">
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={listing ? 'ja_cadastrado' : 'novo'} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {listing?.ultima_sync ? new Date(listing.ultima_sync).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

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

      {/* Conflict Dialog */}
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
                <p className="text-sm text-muted-foreground">
                  Restam <strong>{conflictQueue.length}</strong> produto(s) com conflito.
                </p>
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