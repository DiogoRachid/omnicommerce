import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Upload, Search, Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { askBlingAgentJSON } from '@/lib/blingAgent';

// ── helpers hierarquia ────────────────────────────────────────────────────────
function parseCT(v) {
  const parts = (v.variacoes_atributos || '').split('|').map(s => s.trim());
  return { cor: parts[0] || '', tamanho: parts[1] || '' };
}
function groupByCor(variacoes) {
  const map = {};
  variacoes.forEach(v => {
    const { cor } = parseCT(v);
    const key = cor || v.nome;
    if (!map[key]) map[key] = [];
    map[key].push(v);
  });
  return map;
}

// ── Buscar produtos do Bling ──────────────────────────────────────────────────
function BlingImport({ localProducts }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ sku: '', ean: '', nome: '' });
  const [blingProducts, setBlingProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [conflictQueue, setConflictQueue] = useState([]);
  const [currentConflict, setCurrentConflict] = useState(null);

  const handleSearch = async () => {
    setLoading(true);
    setBlingProducts([]);
    setSelected({});
    try {
      const products = await askBlingAgentJSON(
        `Liste os produtos ativos do Bling. Retorne um array JSON com: id, nome, codigo (SKU), gtin (EAN), preco, situacao, marca, unidade. Máximo 200 produtos.`
      );
      const mapped = (Array.isArray(products) ? products : []).map(p => ({
        id: String(p.id),
        nome: p.nome || '',
        sku: p.codigo || '',
        ean: p.gtin || '',
        preco: p.preco ? parseFloat(p.preco) : 0,
        status: p.situacao === 'A' ? 'ativo' : 'inativo',
      })).map(p => ({
        ...p,
        _local: localProducts.find(lp => (lp.ean && lp.ean === p.ean) || (lp.sku && lp.sku === p.sku)) || null,
      }));
      setBlingProducts(mapped);
    } catch (e) {
      toast.error('Erro ao buscar produtos do Bling: ' + e.message);
    }
    setLoading(false);
  };

  const filtered = blingProducts.filter(p => {
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

  const logAction = (tipo, status, p, mensagem) => {
    setImportLog(prev => [{ id: Date.now() + Math.random(), tipo, status, produto: p.nome, mensagem, created_date: new Date().toISOString() }, ...prev]);
  };

  const createProduct = async (p) => {
    await base44.entities.Product.create({
      sku: p.sku || `BLING-${p.id}`,
      ean: p.ean || '',
      nome: p.nome,
      preco_venda: p.preco,
      ativo: p.status === 'ativo',
      origem: 'importacao',
    });
  };

  const handleImport = async () => {
    const toImport = filtered.filter(p => selected[p.id]);
    const conflicts = toImport.filter(p => p._local);
    const news = toImport.filter(p => !p._local);

    setImporting(true);
    for (const p of news) {
      await createProduct(p);
      logAction('importacao', 'sucesso', p, 'Produto importado do Bling.');
    }
    if (conflicts.length > 0) {
      setConflictQueue(conflicts);
      setCurrentConflict(conflicts[0]);
    } else {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setImporting(false);
    }
  };

  const resolveConflict = async (action) => {
    if (!currentConflict) return;
    if (action === 'update') {
      await base44.entities.Product.update(currentConflict._local.id, {
        preco_venda: currentConflict.preco,
      });
      logAction('atualizacao', 'sucesso', currentConflict, 'Produto atualizado com dados do Bling.');
    } else if (action === 'skip') {
      logAction('importacao', 'sucesso', currentConflict, 'Produto não alterado.');
    } else {
      setConflictQueue([]); setCurrentConflict(null); setImporting(false); return;
    }
    const remaining = conflictQueue.slice(1);
    if (remaining.length > 0) {
      setConflictQueue(remaining); setCurrentConflict(remaining[0]);
    } else {
      setConflictQueue([]); setCurrentConflict(null); setImporting(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" /> Buscar Produtos no Bling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          <Button onClick={handleSearch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Buscando...' : 'Buscar no Bling'}
          </Button>
        </CardContent>
      </Card>

      {blingProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">{filtered.length} produtos — {selectedCount} selecionados</CardTitle>
              <Button onClick={handleImport} disabled={selectedCount === 0 || importing} className="gap-2 bg-green-600 hover:bg-green-700" size="sm">
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
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro Local</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={!!selected[p.id]} onCheckedChange={v => setSelected(s => ({ ...s, [p.id]: v }))} />
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{p.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ean || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{p.preco ? `R$ ${p.preco.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p._local
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">Já cadastrado</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Novo</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {importLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Log de Importação</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-40 overflow-y-auto">
            {importLog.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                <Badge variant={l.status === 'sucesso' ? 'default' : 'destructive'} className="text-[9px]">{l.status}</Badge>
                <span className="font-medium truncate">{l.produto}</span>
                <span className="text-muted-foreground flex-1">{l.mensagem}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!currentConflict} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" /> Produto já cadastrado
            </DialogTitle>
          </DialogHeader>
          {currentConflict && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Restam <strong>{conflictQueue.length}</strong> produto(s) com conflito.</p>
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p><strong>Nome:</strong> {currentConflict.nome}</p>
                <p><strong>SKU:</strong> {currentConflict.sku || '-'}</p>
                <p><strong>EAN:</strong> {currentConflict.ean || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => resolveConflict('cancel')}>Cancelar</Button>
            <Button variant="secondary" onClick={() => resolveConflict('skip')}>Não alterar</Button>
            <Button onClick={() => resolveConflict('update')}>Atualizar produto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Exportar produtos para o Bling ────────────────────────────────────────────
function BlingExport({ selectedCompany }) {
  const [filters, setFilters] = useState({ nome: '', sku: '', ean: '' });
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [exporting, setExporting] = useState(false);
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

  const variacoesPorPai = useMemo(() => {
    const map = {};
    products.filter(p => p.tipo === 'variacao').forEach(v => {
      if (!map[v.produto_pai_id]) map[v.produto_pai_id] = [];
      map[v.produto_pai_id].push(v);
    });
    return map;
  }, [products]);

  const rootProducts = products.filter(p => p.tipo !== 'variacao' && p.ativo);
  const filtered = rootProducts.filter(p => {
    if (filters.nome && !p.nome.toLowerCase().includes(filters.nome.toLowerCase())) return false;
    if (filters.sku && !(p.sku || '').toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.ean && !(p.ean || '').includes(filters.ean)) return false;
    return true;
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggleAll = (v) => {
    const s = {};
    filtered.forEach(p => {
      s[p.id] = v;
      (variacoesPorPai[p.id] || []).forEach(va => { s[va.id] = v; });
    });
    setSelected(s);
  };

  const togglePai = (p, v) => {
    setSelected(s => {
      const next = { ...s, [p.id]: v };
      (variacoesPorPai[p.id] || []).forEach(va => { next[va.id] = v; });
      return next;
    });
  };

  const toggleCor = (vars, v) => {
    setSelected(s => {
      const next = { ...s };
      vars.forEach(va => { next[va.id] = v; });
      return next;
    });
  };

  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const handleExport = async () => {
    const toExport = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => products.find(p => p.id === id))
      .filter(Boolean);

    setExporting(true);
    const log = [];
    for (const p of toExport) {
      try {
        await askBlingAgentJSON(
          `Crie o produto no Bling com os seguintes dados:
Nome: ${p.nome}
Código (SKU): ${p.sku || ''}
GTIN (EAN): ${p.ean || ''}
Preço: ${p.preco_venda || 0}
Unidade: ${p.unidade_medida || 'UN'}
Situação: Ativo
Retorne apenas {"success": true} se criado com sucesso.`
        );
        log.push({ id: Date.now() + Math.random(), produto: p.nome, status: 'sucesso', mensagem: 'Exportado para o Bling.' });
      } catch (e) {
        log.push({ id: Date.now() + Math.random(), produto: p.nome, status: 'erro', mensagem: e.message });
      }
    }
    setExportLog(log);
    setExporting(false);
    toast.success(`${log.filter(l => l.status === 'sucesso').length} produto(s) exportado(s) para o Bling.`);
  };

  const renderPaiRow = (p) => {
    const variacoes = variacoesPorPai[p.id] || [];
    const isPai = p.tipo === 'pai' && variacoes.length > 0;
    const isExp = !!expanded[p.id];

    return (
      <React.Fragment key={p.id}>
        <TableRow
          className={`cursor-pointer ${isExp ? 'bg-orange-50/60' : ''} hover:bg-accent/40`}
          onClick={() => togglePai(p, !selected[p.id])}
        >
          <TableCell onClick={e => e.stopPropagation()}>
            <Checkbox checked={!!selected[p.id]} onCheckedChange={v => togglePai(p, v)} />
          </TableCell>
          <TableCell className="font-medium text-sm">
            <div className="flex items-center gap-1.5">
              {isPai && (
                <button className="p-0.5 rounded hover:bg-orange-200 transition-colors shrink-0"
                  onClick={e => { e.stopPropagation(); toggleExpand(p.id); }}>
                  {isExp ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
                </button>
              )}
              <span className="truncate max-w-[160px]">{p.nome}</span>
              {isPai && <Badge variant="outline" className="text-[9px] px-1 shrink-0">Pai</Badge>}
            </div>
          </TableCell>
          <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
          <TableCell className="font-mono text-xs">{p.ean || '-'}</TableCell>
          <TableCell className="text-right text-sm">{p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : '-'}</TableCell>
          <TableCell className="text-right text-sm">{isPai ? <span className="text-muted-foreground">—</span> : (p.estoque_atual ?? 0)}</TableCell>
          <TableCell>
            <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px]">{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
          </TableCell>
        </TableRow>

        {isPai && isExp && (() => {
          const grouped = groupByCor(variacoes);
          return Object.entries(grouped).map(([cor, vars]) => {
            const corKey = `${p.id}-cor-${cor}`;
            const isExpCor = !!expanded[corKey];
            const hasTamanho = vars.some(v => parseCT(v).tamanho);
            return (
              <React.Fragment key={corKey}>
                <TableRow className="bg-orange-50/40 hover:bg-orange-100/50 cursor-pointer"
                  onClick={() => hasTamanho && toggleExpand(corKey)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={vars.every(v => !!selected[v.id])} onCheckedChange={v => toggleCor(vars, v)} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2 pl-8 text-xs font-semibold text-orange-700">
                      {hasTamanho && (isExpCor ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
                      <span>🎨 {cor}</span>
                      <span className="font-normal text-orange-500">({vars.length})</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs py-1.5">{vars[0]?.sku || '-'}</TableCell>
                  <TableCell className="font-mono text-xs py-1.5">{vars[0]?.ean || '-'}</TableCell>
                  <TableCell className="text-right text-xs py-1.5">{vars[0]?.preco_venda ? `R$ ${vars[0].preco_venda.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-right text-xs py-1.5 text-muted-foreground">{vars.reduce((s, v) => s + (v.estoque_atual || 0), 0)}</TableCell>
                  <TableCell className="py-1.5" />
                </TableRow>

                {hasTamanho && isExpCor && vars.map(v => {
                  const { tamanho } = parseCT(v);
                  return (
                    <TableRow key={v.id} className="bg-slate-50/40 hover:bg-slate-100/50 cursor-pointer"
                      onClick={() => setSelected(s => ({ ...s, [v.id]: !s[v.id] }))}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={!!selected[v.id]} onCheckedChange={val => setSelected(s => ({ ...s, [v.id]: val }))} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1.5 pl-16 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                          {tamanho || v.nome}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs py-1.5">{v.sku || '-'}</TableCell>
                      <TableCell className="font-mono text-xs py-1.5">{v.ean || '-'}</TableCell>
                      <TableCell className="text-right text-xs py-1.5">{v.preco_venda ? `R$ ${v.preco_venda.toFixed(2)}` : '-'}</TableCell>
                      <TableCell className="text-right text-xs py-1.5">{v.estoque_atual ?? 0}</TableCell>
                      <TableCell className="py-1.5" />
                    </TableRow>
                  );
                })}
              </React.Fragment>
            );
          });
        })()}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Exportar Produtos para o Bling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <Button onClick={handleExport} disabled={selectedCount === 0 || exporting} className="gap-2" size="sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Exportar para Bling ({selectedCount})
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produto ativo encontrado.</TableCell>
                </TableRow>
              )}
              {filtered.map(p => renderPaiRow(p))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {exportLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Log de Exportação</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-40 overflow-y-auto">
            {exportLog.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                <Badge variant={l.status === 'sucesso' ? 'default' : 'destructive'} className="text-[9px]">{l.status}</Badge>
                <span className="font-medium truncate">{l.produto}</span>
                <span className="text-muted-foreground flex-1">{l.mensagem}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BlingProducts({ companies, selectedCompany }) {
  const { data: localProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 1000),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">B</span>
        </div>
        <div>
          <h2 className="text-base font-semibold">Integração Bling</h2>
          <p className="text-xs text-muted-foreground">Busque produtos do Bling ou exporte produtos para o Bling</p>
        </div>
      </div>

      <Tabs defaultValue="buscar">
        <TabsList>
          <TabsTrigger value="buscar" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Buscar do Bling
          </TabsTrigger>
          <TabsTrigger value="exportar" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Exportar para Bling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buscar" className="mt-4">
          <BlingImport localProducts={localProducts} />
        </TabsContent>

        <TabsContent value="exportar" className="mt-4">
          <BlingExport selectedCompany={selectedCompany} />
        </TabsContent>
      </Tabs>
    </div>
  );
}