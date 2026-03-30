import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, Loader2, AlertCircle } from 'lucide-react';
import { askBlingAgentJSON } from '@/lib/blingAgent';

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

export default function ImportProducts({ companies }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ marketplace: 'all', company: 'all', sku: '', ean: '', nome: '' });
  const [mpProducts, setMpProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflictQueue, setConflictQueue] = useState([]);
  const [currentConflict, setCurrentConflict] = useState(null);
  const [importLog, setImportLog] = useState([]);

  const { data: localProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 1000),
  });

  const handleSearch = async () => {
    setLoading(true);
    setMpProducts([]);
    setSelected({});
    try {
      const products = await askBlingAgentJSON(
        `Liste os produtos ativos do Bling. Retorne um array JSON com: id, nome, codigo (SKU), gtin (EAN), preco, situacao, marca, unidade. Máximo 200 produtos.`
      );
      const mapped = (Array.isArray(products) ? products : []).map(p => ({
        id: String(p.id),
        marketplace: 'mercado_livre',
        nome: p.nome || '',
        sku: p.codigo || '',
        ean: p.gtin || '',
        preco: p.preco ? parseFloat(p.preco) : 0,
        estoque: 0,
        status: p.situacao === 'A' ? 'ativo' : 'inativo',
        updated_at: new Date().toISOString(),
        _cadastro: undefined,
      }));
      setMpProducts(mapped.map(p => ({
        ...p,
        _cadastro: checkLocal(p, localProducts),
      })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const checkLocal = (mpProd, locals) => {
    if (mpProd.ean) {
      const found = locals.find(lp => lp.ean === mpProd.ean);
      if (found) return found;
    }
    if (mpProd.sku) {
      const found = locals.find(lp => lp.sku === mpProd.sku);
      if (found) return found;
    }
    return null;
  };

  const filtered = mpProducts.filter(p => {
    if (filters.sku && !p.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.ean && !p.ean.includes(filters.ean)) return false;
    if (filters.nome && !p.nome.toLowerCase().includes(filters.nome.toLowerCase())) return false;
    return true;
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const toggleAll = (v) => {
    const s = {};
    filtered.forEach(p => { s[p.id] = v; });
    setSelected(s);
  };

  const handleImport = async () => {
    const toImport = filtered.filter(p => selected[p.id]);
    const conflicts = toImport.filter(p => p._cadastro);
    const news = toImport.filter(p => !p._cadastro);

    // Processa novos direto
    for (const p of news) {
      await createProduct(p);
      logAction('importacao', 'sucesso', p, 'Produto criado.');
    }

    if (conflicts.length > 0) {
      setConflictQueue(conflicts);
      setCurrentConflict(conflicts[0]);
    } else {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
    setImporting(true);
  };

  const createProduct = async (p) => {
    await base44.entities.Product.create({
      sku: p.sku || `MP-${p.id}`,
      ean: p.ean || '',
      nome: p.nome,
      preco_venda: p.preco,
      estoque_atual: p.estoque || 0,
      ativo: p.status === 'ativo',
      origem: 'importacao',
    });
  };

  const logAction = async (tipo, status, p, mensagem) => {
    const entry = { tipo, status, marketplace: p.marketplace || 'mercado_livre', produto: p.nome, mensagem, detalhes: { sku: p.sku, ean: p.ean } };
    await base44.entities.MarketplaceLog.create(entry);
    setImportLog(prev => [{ ...entry, id: Date.now() + Math.random(), created_date: new Date().toISOString() }, ...prev]);
  };

  const resolveConflict = async (action) => {
    if (!currentConflict) return;
    if (action === 'update') {
      await base44.entities.Product.update(currentConflict._cadastro.id, {
        preco_venda: currentConflict.preco,
        estoque_atual: currentConflict.estoque || 0,
      });
      logAction('atualizacao', 'sucesso', currentConflict, 'Produto atualizado.');
      setMpProducts(prev => prev.map(p => p.id === currentConflict.id ? { ...p, _cadastro_status: 'atualizado' } : p));
    } else if (action === 'skip') {
      logAction('importacao', 'sucesso', currentConflict, 'Produto não alterado.');
      setMpProducts(prev => prev.map(p => p.id === currentConflict.id ? { ...p, _cadastro_status: 'nao_alterado' } : p));
    } else {
      // cancel — para tudo
      setConflictQueue([]);
      setCurrentConflict(null);
      return;
    }

    const remaining = conflictQueue.slice(1);
    if (remaining.length > 0) {
      setConflictQueue(remaining);
      setCurrentConflict(remaining[0]);
    } else {
      setConflictQueue([]);
      setCurrentConflict(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" /> Importar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Marketplace</label>
              <Select value={filters.marketplace} onValueChange={v => setFilters(f => ({ ...f, marketplace: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
              <Input placeholder="Filtrar por SKU" value={filters.sku} onChange={e => setFilters(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">EAN</label>
              <Input placeholder="Filtrar por EAN" value={filters.ean} onChange={e => setFilters(f => ({ ...f, ean: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input placeholder="Filtrar por nome" value={filters.nome} onChange={e => setFilters(f => ({ ...f, nome: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar Produtos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {mpProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">{filtered.length} produtos encontrados — {selectedCount} selecionados</CardTitle>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="gap-2 bg-green-600 hover:bg-green-700"
                size="sm"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Importar selecionados ({selectedCount})
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
                  <TableHead>Marketplace</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={!!selected[p.id]} onCheckedChange={v => setSelected(s => ({ ...s, [p.id]: v }))} />
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{MP_NAMES[p.marketplace]}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ean || '-'}</TableCell>
                    <TableCell className="text-sm font-medium max-w-[180px] truncate">{p.nome}</TableCell>
                    <TableCell className="text-right text-sm">{p.preco ? `R$ ${p.preco.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p._cadastro_status || (p._cadastro ? 'ja_cadastrado' : 'novo')} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Log */}
      {importLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Log de Importação</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-48 overflow-y-auto">
            {importLog.map(l => (
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
              <AlertCircle className="w-5 h-5 text-yellow-500" /> Produto já cadastrado
            </DialogTitle>
          </DialogHeader>
          {currentConflict && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Restam <strong>{conflictQueue.length}</strong> produto(s) com conflito.
              </p>
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p><strong>Nome:</strong> {currentConflict.nome}</p>
                <p><strong>SKU:</strong> {currentConflict.sku || '-'}</p>
                <p><strong>EAN:</strong> {currentConflict.ean || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => resolveConflict('cancel')}>Cancelar importação</Button>
            <Button variant="secondary" onClick={() => resolveConflict('skip')}>Não alterar produto</Button>
            <Button onClick={() => resolveConflict('update')}>Atualizar produto existente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}