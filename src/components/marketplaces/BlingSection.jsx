import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  CheckCircle2, AlertCircle, ExternalLink, LogOut, Loader2,
  RefreshCw, Package, Download, Upload, ChevronRight, ChevronDown,
  Layers, Trash2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

const BLING_CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/bling-callback';

function getBlingAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: BLING_CLIENT_ID,
    redirect_uri: BLING_REDIRECT_URI,
    state: 'bling_oauth',
  });
  return `${BLING_AUTH_URL}?${params.toString()}`;
}

async function callProxy(action, payload = {}) {
  const res = await base44.functions.invoke('blingProxy', { action, payload });
  return res.data;
}

// ── Status card ───────────────────────────────────────────────────────────────
function BlingStatusCard({ status, loading, onConnect, onDisconnect, onRefresh }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          Bling ERP
          <Badge className={`ml-auto text-xs ${status?.connected && !status?.expired
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'bg-red-100 text-red-700 border-red-200'}`}>
            {loading ? '...' : status?.connected && !status?.expired ? 'Conectado' : 'Desconectado'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status?.connected && !status?.expired && (
          <p className="text-xs text-muted-foreground mb-3">
            Token expira em: {status.expires_at ? new Date(status.expires_at).toLocaleString('pt-BR') : '?'}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {!status?.connected || status?.expired ? (
            <Button onClick={onConnect} className="gap-2 bg-orange-500 hover:bg-orange-600" disabled={loading}>
              <ExternalLink className="w-4 h-4" /> Conectar ao Bling
            </Button>
          ) : (
            <>
              <Button onClick={onRefresh} variant="outline" size="sm" className="gap-1.5" disabled={loading}>
                <RefreshCw className="w-3.5 h-3.5" /> Renovar Token
              </Button>
              <Button onClick={onDisconnect} variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={loading}>
                <LogOut className="w-3.5 h-3.5" /> Desconectar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Importar do Bling ─────────────────────────────────────────────────────────
function BlingImportSection({ company }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('idle');
  const [produtosSimples, setProdutosSimples] = useState([]);
  const [produtosPai, setProdutosPai] = useState([]);
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importResult, setImportResult] = useState(null);

  const fetchProducts = async () => {
    setStep('loading');
    setError('');
    setProdutosSimples([]); setProdutosPai([]); setSelected({}); setExpanded({});
    try {
      const result = await callProxy('listProductsFull');
      if (!result) throw new Error('Resposta vazia do servidor.');
      const simples = result.produtos_simples || [];
      const pais = result.produtos_pai || [];
      if (simples.length === 0 && pais.length === 0) throw new Error('Nenhum produto encontrado no Bling.');
      setProdutosSimples(simples);
      setProdutosPai(pais);
      const sel = {};
      simples.forEach(p => { sel[`s_${p.id}`] = true; });
      pais.forEach(p => { sel[`pai_${p.id}`] = true; });
      setSelected(sel);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('idle');
    }
  };

  function clean(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    let created = 0, errors = 0;
    setProgressLabel('Apagando produtos existentes...');
    const existing = await base44.entities.Product.list('-created_date', 2000);
    const toDelete = company?.id ? existing.filter(p => p.company_id === company.id) : existing;
    for (const p of toDelete) { try { await base44.entities.Product.delete(p.id); } catch {} }

    const simplesSelected = produtosSimples.filter(p => selected[`s_${p.id}`]);
    const paisSelected = produtosPai.filter(p => selected[`pai_${p.id}`]);
    const total = simplesSelected.length + paisSelected.length;
    let done = 0;

    for (const p of simplesSelected) {
      done++;
      setProgress(Math.round((done / total) * 100));
      setProgressLabel(`Importando ${done}/${total}: ${p.nome}`);
      try {
        const det = await callProxy('getProductDetail', { bling_id: p.id });
        const prod = det || p;
        await base44.entities.Product.create({
          bling_id: String(prod.id),
          sku: prod.codigo || `BLING-${prod.id}`,
          ean: prod.gtin || undefined,
          nome: prod.nome || '-',
          descricao: prod.descricaoCurta || undefined,
          marca: prod.marca || undefined,
          preco_venda: prod.preco ? parseFloat(prod.preco) : undefined,
          estoque_atual: parseFloat(prod.estoque?.saldoFisico || 0),
          ativo: prod.situacao === 'A',
          origem: 'importacao',
          tipo: 'simples',
          company_id: company?.id,
        });
        created++;
      } catch { errors++; }
    }

    for (const p of paisSelected) {
      done++;
      setProgress(Math.round((done / total) * 100));
      setProgressLabel(`Importando variações ${done}/${total}: ${p.nome}`);
      try {
        const det = await callProxy('getProductDetail', { bling_id: p.id });
        const prod = det || p;
        const paiCriado = await base44.entities.Product.create({
          bling_id: String(prod.id),
          sku: prod.codigo ? `PAI-${prod.codigo}` : `PAI-${prod.id}`,
          nome: prod.nome || '-',
          marca: prod.marca || undefined,
          tipo: 'pai',
          estoque_atual: 0,
          ativo: prod.situacao === 'A',
          origem: 'importacao',
          company_id: company?.id,
        });
        created++;
        for (const v of (prod.variacoes || [])) {
          try {
            const attrs = (v.atributos || []).map(a => `${a.nome}: ${a.valor}`).join(' | ');
            await base44.entities.Product.create(clean({
              bling_id: String(v.id),
              sku: v.codigo || `VAR-${v.id}`,
              ean: v.gtin || undefined,
              nome: `${prod.nome}${attrs ? ` - ${attrs}` : ''}`,
              preco_venda: v.preco ? parseFloat(v.preco) : undefined,
              estoque_atual: parseFloat(v.estoque || 0),
              tipo: 'variacao',
              ativo: prod.situacao === 'A',
              origem: 'importacao',
              produto_pai_id: paiCriado.id,
              bling_pai_id: String(prod.id),
              variacoes_atributos: attrs || undefined,
              company_id: company?.id,
            }));
            created++;
          } catch { errors++; }
        }
      } catch { errors++; }
    }

    setImportResult({ created, deleted: toDelete.length, errors, total });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setStep('done');
  };

  const totalCount = produtosSimples.length + produtosPai.length;
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const toggleAll = (val) => {
    const sel = {};
    produtosSimples.forEach(p => { sel[`s_${p.id}`] = val; });
    produtosPai.forEach(p => { sel[`pai_${p.id}`] = val; });
    setSelected(sel);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-orange-500" /> Importar Produtos do Bling
        </CardTitle>
      </CardHeader>
      <CardContent>
        {step === 'idle' && (
          <div className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              Importa produtos simples e com variações, incluindo fotos, dimensões e estoque real.
            </p>
            <Button onClick={fetchProducts} className="gap-2 bg-orange-500 hover:bg-orange-600">
              <Download className="w-4 h-4" /> Buscar Produtos do Bling
            </Button>
          </div>
        )}

        {step === 'loading' && (
          <div className="text-center py-8 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Buscando produtos no Bling...</p>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
            <p className="text-sm font-medium">{progressLabel}</p>
            <div className="max-w-xs mx-auto space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress}% concluído</p>
            </div>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h3 className="font-semibold">Importação concluída!</h3>
            <div className="flex gap-3 justify-center flex-wrap">
              <div className="bg-red-50 rounded-xl p-3 text-center min-w-[70px]">
                <p className="text-xl font-bold text-red-600">{importResult.deleted}</p>
                <p className="text-xs text-red-700">Apagados</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center min-w-[70px]">
                <p className="text-xl font-bold text-green-600">{importResult.created}</p>
                <p className="text-xs text-green-700">Importados</p>
              </div>
              {importResult.errors > 0 && (
                <div className="bg-orange-50 rounded-xl p-3 text-center min-w-[70px]">
                  <p className="text-xl font-bold text-orange-600">{importResult.errors}</p>
                  <p className="text-xs text-orange-700">Erros</p>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStep('idle'); setImportResult(null); }}>
              Nova Importação
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <Alert>
              <Trash2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Produtos existentes desta empresa serão <strong>apagados</strong> e substituídos.
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{totalCount} produtos</p>
                <Badge variant="secondary">{produtosSimples.length} simples</Badge>
                <Badge variant="outline">{produtosPai.length} com variações</Badge>
                <Badge className="bg-primary/10 text-primary border-0">{selectedCount} selecionados</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Todos</Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Nenhum</Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="w-8 p-2"><Checkbox checked={selectedCount === totalCount && totalCount > 0} onCheckedChange={toggleAll} /></th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Produto</th>
                    <th className="p-2 text-left font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                    <th className="p-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Preço</th>
                    <th className="p-2 text-center font-medium text-muted-foreground">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosSimples.map(p => (
                    <tr key={`s_${p.id}`} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(s => ({ ...s, [`s_${p.id}`]: !s[`s_${p.id}`] }))}>
                      <td className="p-2"><Checkbox checked={!!selected[`s_${p.id}`]} onCheckedChange={() => setSelected(s => ({ ...s, [`s_${p.id}`]: !s[`s_${p.id}`] }))} onClick={e => e.stopPropagation()} /></td>
                      <td className="p-2 font-medium truncate max-w-[180px]">{p.nome}</td>
                      <td className="p-2 font-mono text-xs hidden sm:table-cell">{p.codigo || '-'}</td>
                      <td className="p-2 text-right hidden sm:table-cell">{p.preco ? `R$ ${parseFloat(p.preco).toFixed(2)}` : '-'}</td>
                      <td className="p-2 text-center"><Badge variant="secondary" className="text-[10px]">Simples</Badge></td>
                    </tr>
                  ))}
                  {produtosPai.map(p => (
                    <React.Fragment key={`pai_${p.id}`}>
                      <tr className="border-t bg-orange-50/50 hover:bg-orange-50 cursor-pointer" onClick={() => setSelected(s => ({ ...s, [`pai_${p.id}`]: !s[`pai_${p.id}`] }))}>
                        <td className="p-2"><Checkbox checked={!!selected[`pai_${p.id}`]} onCheckedChange={() => setSelected(s => ({ ...s, [`pai_${p.id}`]: !s[`pai_${p.id}`] }))} onClick={e => e.stopPropagation()} /></td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); setExpanded(ex => ({ ...ex, [p.id]: !ex[p.id] })); }} className="p-0.5 rounded hover:bg-orange-200 shrink-0">
                              {expanded[p.id] ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" /> : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
                            </button>
                            <span className="font-medium text-orange-900 truncate">{p.nome}</span>
                            <span className="text-xs text-orange-500">({p.variacoes?.length || 0})</span>
                          </div>
                        </td>
                        <td className="p-2 font-mono text-xs hidden sm:table-cell text-muted-foreground">PAI-{p.id}</td>
                        <td className="p-2 text-right hidden sm:table-cell text-muted-foreground text-xs">—</td>
                        <td className="p-2 text-center"><Badge className="text-[10px] bg-orange-100 text-orange-700 border-0">Pai</Badge></td>
                      </tr>
                      {expanded[p.id] && (p.variacoes || []).map(v => (
                        <tr key={`var_${v.id}`} className="border-t bg-muted/20">
                          <td /><td className="p-2 pl-8 text-xs text-muted-foreground" colSpan={4}>{v.atributos?.map(a => `${a.nome}: ${a.valor}`).join(' | ') || v.nome}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('idle')}>Cancelar</Button>
              <Button onClick={handleImport} disabled={selectedCount === 0} className="gap-2 bg-orange-500 hover:bg-orange-600">
                <Trash2 className="w-4 h-4" /> Apagar e importar {selectedCount} produto{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Exportar para o Bling ─────────────────────────────────────────────────────
function BlingExportSection({ selectedCompany }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportLog, setExportLog] = useState([]);

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 1000);
      return base44.entities.Product.list('-created_date', 1000);
    },
  });

  const filtered = products.filter(p => p.ativo && !p.bling_id &&
    (!search || p.nome?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const toggleAll = (v) => { const s = {}; filtered.forEach(p => { s[p.id] = v; }); setSelected(s); };

  const handleExport = async () => {
    const toExport = filtered.filter(p => selected[p.id]);
    if (toExport.length === 0) return;
    setExporting(true);
    let ok = 0, fail = 0;
    for (const p of toExport) {
      try {
        await callProxy('createProduct', {
          produto: {
            nome: p.nome,
            codigo: p.sku,
            preco: p.preco_venda || 0,
            unidade: p.unidade_medida || 'UN',
            situacao: 'A',
          },
        });
        ok++;
        setExportLog(prev => [{ id: Date.now() + Math.random(), produto: p.nome, status: 'sucesso', created_date: new Date().toISOString() }, ...prev]);
      } catch {
        fail++;
        setExportLog(prev => [{ id: Date.now() + Math.random(), produto: p.nome, status: 'erro', created_date: new Date().toISOString() }, ...prev]);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast.success(`${ok} produto(s) exportados para o Bling${fail ? `, ${fail} com erro.` : '!'}`);
    setSelected({});
    setExporting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-4 h-4 text-orange-500" /> Exportar Produtos para o Bling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Produtos sem ID Bling (ainda não exportados) aparecerão aqui.</p>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} produto(s) disponíveis · {selectedCount} selecionados</p>
          <Button onClick={handleExport} disabled={selectedCount === 0 || exporting} className="gap-2 bg-orange-500 hover:bg-orange-600" size="sm">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Exportar para Bling ({selectedCount})
          </Button>
        </div>
        {filtered.length > 0 && (
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={selectedCount === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))}>
                    <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={!!selected[p.id]} onCheckedChange={v => setSelected(s => ({ ...s, [p.id]: v }))} /></TableCell>
                    <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {exportLog.length > 0 && (
          <div className="space-y-1 max-h-36 overflow-y-auto border rounded-lg p-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Log de Exportação</p>
            {exportLog.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs py-0.5">
                <Badge variant={l.status === 'sucesso' ? 'default' : 'destructive'} className="text-[9px]">{l.status}</Badge>
                <span className="truncate">{l.produto}</span>
                <span className="text-muted-foreground shrink-0">{new Date(l.created_date).toLocaleTimeString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Testar Conexão Bling ──────────────────────────────────────────────────────
function BlingConnectionTest({ status }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const data = await callProxy('status');
      if (data?.connected && !data?.expired) {
        setResult({ ok: true, text: 'Conexão com Bling funcionando corretamente!' });
        await base44.entities.MarketplaceLog.create({ tipo: 'teste_conexao', status: 'sucesso', marketplace: 'mercado_livre', mensagem: 'Bling conectado e token válido.' });
      } else {
        setResult({ ok: false, text: 'Bling não está conectado ou token expirado.' });
        await base44.entities.MarketplaceLog.create({ tipo: 'teste_conexao', status: 'erro', marketplace: 'mercado_livre', mensagem: 'Bling desconectado ou token expirado.' });
      }
    } catch (e) {
      setResult({ ok: false, text: 'Erro ao testar: ' + e.message });
    }
    setTesting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wifi className="w-4 h-4" /> Testar Conexão Bling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Verifica se o token do Bling está ativo e a integração funcionando.</p>
        <Button onClick={handleTest} disabled={testing} variant="outline" className="gap-2">
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          Testar Conexão
        </Button>
        {result && (
          <Alert className={result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            <AlertDescription className={result.ok ? 'text-green-800' : 'text-red-800'}>{result.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BlingSection({ selectedCompany }) {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const s = await callProxy('status');
      setStatus(s);
    } catch { setStatus({ connected: false }); }
    setLoadingStatus(false);
  };

  useEffect(() => { checkStatus(); }, []);

  const handleConnect = () => { window.location.href = getBlingAuthUrl(); };
  const handleDisconnect = async () => {
    setLoadingStatus(true);
    await callProxy('disconnect');
    setStatus({ connected: false });
    setLoadingStatus(false);
    toast.success('Bling desconectado.');
  };
  const handleRefresh = async () => {
    setLoadingStatus(true);
    await callProxy('refresh');
    await checkStatus();
    toast.success('Token renovado!');
  };

  const isConnected = status?.connected && !status?.expired;

  return (
    <div className="space-y-4">
      <BlingStatusCard
        status={status}
        loading={loadingStatus}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefresh={handleRefresh}
      />

      {isConnected && (
        <>
          <BlingImportSection company={null} />
          <BlingExportSection selectedCompany={selectedCompany} />
          <BlingConnectionTest status={status} />
        </>
      )}

      {!isConnected && !loadingStatus && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Conecte ao Bling para acessar as funcionalidades de importação e exportação.
          </CardContent>
        </Card>
      )}
    </div>
  );
}