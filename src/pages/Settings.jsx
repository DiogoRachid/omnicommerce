import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Store, RefreshCw, Loader2, Search, Download, ExternalLink,
  AlertCircle, CheckCircle2, Package, Upload, PauseCircle, PlayCircle,
} from 'lucide-react';
import { askBlingAgentJSON } from '@/lib/blingAgent';

// ── helpers ───────────────────────────────────────────────────────────────────

const MP_LABELS = {
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  magalu: 'Magalu',
  bling: 'Bling',
};

const STATUS_COLORS = {
  ativo: 'default',
  pausado: 'secondary',
  inativo: 'outline',
  pendente: 'secondary',
  erro: 'destructive',
};

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <Package className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Tabela planilha Bling ─────────────────────────────────────────────────────
function BlingProductsTab({ company }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(null); // id do produto sendo importado
  const [msg, setMsg] = useState(null);
  const queryClient = useQueryClient();

  const { data: localProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 5000),
  });

  const handleSearch = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await askBlingAgentJSON(
        `Liste os produtos do Bling. Retorne um array JSON com os campos: id, nome, codigo, gtin, preco, custo, situacao, unidade, marca, categoria, estoque (saldo atual), peso_bruto, largura_cm, altura_cm, comprimento_cm, imagem_url. Máximo 200 produtos.`
      );
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao buscar produtos do Bling: ' + e.message });
    }
    setLoading(false);
  };

  const isImported = (p) => localProducts.some(lp => lp.bling_id === String(p.id) || lp.sku === p.codigo || (p.gtin && lp.ean === p.gtin));

  const handleImport = async (p) => {
    setImporting(p.id);
    setMsg(null);
    try {
      await base44.entities.Product.create({
        nome: p.nome,
        sku: p.codigo || `BLING-${p.id}`,
        ean: p.gtin || '',
        marca: p.marca || '',
        preco_custo: parseFloat(p.custo) || 0,
        preco_venda: parseFloat(p.preco) || 0,
        estoque_atual: parseFloat(p.estoque) || 0,
        unidade_medida: p.unidade || 'UN',
        peso_bruto_kg: parseFloat(p.peso_bruto) || 0,
        largura_cm: parseFloat(p.largura_cm) || 0,
        altura_cm: parseFloat(p.altura_cm) || 0,
        comprimento_cm: parseFloat(p.comprimento_cm) || 0,
        fotos: p.imagem_url ? [p.imagem_url] : [],
        ativo: p.situacao === 'A',
        origem: 'importacao',
        bling_id: String(p.id),
        company_id: company?.id,
        marketplace_fields: {
          bling: {
            id: String(p.id),
            situacao: p.situacao,
            categoria: p.categoria || '',
            unidade: p.unidade || '',
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setMsg({ type: 'success', text: `"${p.nome}" importado com sucesso!` });
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao importar: ' + e.message });
    }
    setImporting(null);
  };

  const filtered = products.filter(p =>
    !search ||
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    p.gtin?.includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, SKU ou EAN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="gap-2 bg-orange-500 hover:bg-orange-600">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Buscando...' : 'Buscar produtos'}
        </Button>
      </div>

      {msg && (
        <Alert className={msg.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={msg.type === 'success' ? 'text-green-800' : 'text-red-800'}>{msg.text}</AlertDescription>
        </Alert>
      )}

      {products.length === 0 && !loading && <EmptyState message="Clique em Buscar produtos para carregar os produtos do Bling." />}

      {filtered.length > 0 && (
        <div className="rounded-lg border overflow-x-auto shadow-sm">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                {['ID Bling', 'Nome', 'SKU', 'EAN/GTIN', 'Marca', 'Categoria', 'Preço', 'Custo', 'Estoque', 'Unidade', 'Peso (kg)', 'Larg.', 'Alt.', 'Comp.', 'Situação', 'Cadastrado', 'Ação'].map(h => (
                  <th key={h} className="border border-border px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card">
              {filtered.map(p => {
                const imported = isImported(p);
                return (
                  <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                    <td className="border border-border px-2 py-1.5 font-mono">{p.id}</td>
                    <td className="border border-border px-2 py-1.5 font-medium max-w-[200px] truncate">{p.nome}</td>
                    <td className="border border-border px-2 py-1.5 font-mono">{p.codigo || '-'}</td>
                    <td className="border border-border px-2 py-1.5 font-mono">{p.gtin || '-'}</td>
                    <td className="border border-border px-2 py-1.5">{p.marca || '-'}</td>
                    <td className="border border-border px-2 py-1.5">{p.categoria || '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">R$ {parseFloat(p.preco || 0).toFixed(2)}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.custo ? `R$ ${parseFloat(p.custo).toFixed(2)}` : '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.estoque ?? '-'}</td>
                    <td className="border border-border px-2 py-1.5">{p.unidade || '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.peso_bruto || '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.largura_cm || '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.altura_cm || '-'}</td>
                    <td className="border border-border px-2 py-1.5 text-right">{p.comprimento_cm || '-'}</td>
                    <td className="border border-border px-2 py-1.5">
                      <Badge variant={p.situacao === 'A' ? 'default' : 'secondary'} className="text-[9px]">
                        {p.situacao === 'A' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="border border-border px-2 py-1.5 text-center">
                      {imported
                        ? <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">Sim</Badge>
                        : <Badge variant="outline" className="text-[9px]">Não</Badge>
                      }
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      {!imported ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 gap-1"
                          disabled={importing === p.id}
                          onClick={() => handleImport(p)}
                        >
                          {importing === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Importar
                        </Button>
                      ) : (
                        <span className="text-[10px] text-green-600 font-medium">✓ Importado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
            {filtered.length} produto(s) encontrado(s)
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabela planilha Mercado Livre ─────────────────────────────────────────────
function MercadoLivreProductsTab({ company }) {
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  const [syncStockDialog, setSyncStockDialog] = useState(null);
  const [syncStockForm, setSyncStockForm] = useState({ price: '', quantity: '' });
  const [syncingStock, setSyncingStock] = useState(false);
  const queryClient = useQueryClient();

  const { data: listings = [], refetch } = useQuery({
    queryKey: ['ml-listings-page'],
    queryFn: () => base44.entities.MarketplaceListing.filter({ marketplace: 'mercado_livre' }, '-ultima_sync', 500),
  });

  const { data: localProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 5000),
  });

  const handleSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke('mlProxy', { action: 'syncListings' });
      if (res.data?.success) {
        setMsg({ type: 'success', text: `${res.data.synced} anúncio(s) sincronizado(s).` });
        refetch();
        queryClient.invalidateQueries({ queryKey: ['listings'] });
      } else throw new Error(res.data?.error || 'Erro ao sincronizar');
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSyncing(false);
  };

  const handlePause = async (l) => {
    try {
      await base44.functions.invoke('mlProxy', { action: 'pauseListing', item_id: l.marketplace_item_id });
      refetch();
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao pausar: ' + e.message });
    }
  };

  const handleReactivate = async (l) => {
    try {
      await base44.functions.invoke('mlProxy', { action: 'reactivateListing', item_id: l.marketplace_item_id });
      refetch();
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao reativar: ' + e.message });
    }
  };

  const handleSyncStock = async () => {
    setSyncingStock(true);
    try {
      await base44.functions.invoke('mlProxy', {
        action: 'syncStock',
        item_id: syncStockDialog.marketplace_item_id,
        price: Number(syncStockForm.price),
        available_quantity: Number(syncStockForm.quantity),
      });
      setSyncStockDialog(null);
      refetch();
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao atualizar: ' + e.message });
    }
    setSyncingStock(false);
  };

  const handleImport = async (l) => {
    try {
      await base44.entities.Product.create({
        nome: l.product_name,
        sku: l.marketplace_item_id,
        preco_venda: l.preco_anuncio || 0,
        ativo: l.status === 'ativo',
        origem: 'importacao',
        company_id: company?.id,
        marketplace_fields: {
          mercado_livre: {
            item_id: l.marketplace_item_id,
            status: l.status,
            url: l.url_anuncio,
            preco_anuncio: l.preco_anuncio,
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setMsg({ type: 'success', text: `"${l.product_name}" importado com sucesso!` });
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao importar: ' + e.message });
    }
  };

  const isImported = (l) => localProducts.some(p =>
    p.marketplace_fields?.mercado_livre?.item_id === l.marketplace_item_id ||
    p.sku === l.marketplace_item_id
  );

  const filtered = listings.filter(l =>
    !search ||
    l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.marketplace_item_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por título ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Sincronizando...' : 'Sincronizar do ML'}
        </Button>
      </div>

      {msg && (
        <Alert className={msg.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={msg.type === 'success' ? 'text-green-800' : 'text-red-800'}>{msg.text}</AlertDescription>
        </Alert>
      )}

      {listings.length === 0 && !syncing && (
        <EmptyState message="Clique em Sincronizar do ML para carregar seus anúncios." />
      )}

      {filtered.length > 0 && (
        <div className="rounded-lg border overflow-x-auto shadow-sm">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                {['ID ML', 'Título', 'Preço', 'Status', 'Última Sync', 'Cadastrado', 'Link', 'Ações'].map(h => (
                  <th key={h} className="border border-border px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card">
              {filtered.map(l => {
                const imported = isImported(l);
                return (
                  <tr key={l.id} className="hover:bg-accent/30 transition-colors">
                    <td className="border border-border px-2 py-1.5 font-mono">{l.marketplace_item_id || '-'}</td>
                    <td className="border border-border px-2 py-1.5 font-medium max-w-[220px] truncate">{l.product_name}</td>
                    <td className="border border-border px-2 py-1.5 text-right">
                      {l.preco_anuncio ? `R$ ${Number(l.preco_anuncio).toFixed(2)}` : '-'}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      <Badge variant={STATUS_COLORS[l.status] || 'secondary'} className="text-[9px] capitalize">{l.status}</Badge>
                    </td>
                    <td className="border border-border px-2 py-1.5 text-muted-foreground">
                      {l.ultima_sync ? new Date(l.ultima_sync).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="border border-border px-2 py-1.5 text-center">
                      {imported
                        ? <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">Sim</Badge>
                        : <Badge variant="outline" className="text-[9px]">Não</Badge>
                      }
                    </td>
                    <td className="border border-border px-2 py-1.5 text-center">
                      {l.url_anuncio && (
                        <a href={l.url_anuncio} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                    </td>
                    <td className="border border-border px-2 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {!imported && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleImport(l)}>
                            <Download className="w-3 h-3" /> Importar
                          </Button>
                        )}
                        <Button
                          size="sm" variant="outline"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => { setSyncStockDialog(l); setSyncStockForm({ price: l.preco_anuncio || '', quantity: '' }); }}
                        >
                          <RefreshCw className="w-3 h-3" /> Estoque
                        </Button>
                        {l.status === 'ativo' && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 text-yellow-700" onClick={() => handlePause(l)}>
                            <PauseCircle className="w-3 h-3" /> Pausar
                          </Button>
                        )}
                        {l.status === 'pausado' && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 text-green-700" onClick={() => handleReactivate(l)}>
                            <PlayCircle className="w-3 h-3" /> Reativar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
            {filtered.length} anúncio(s)
          </div>
        </div>
      )}

      {/* Dialog atualizar estoque/preço */}
      <Dialog open={!!syncStockDialog} onOpenChange={(v) => { if (!v) setSyncStockDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Atualizar estoque / preço</DialogTitle>
          </DialogHeader>
          {syncStockDialog && (
            <div className="space-y-3 py-1">
              <p className="text-xs text-muted-foreground truncate">{syncStockDialog.product_name}</p>
              <div>
                <Label className="text-xs">Preço (R$)</Label>
                <Input type="number" min="0" step="0.01" value={syncStockForm.price} onChange={e => setSyncStockForm(f => ({ ...f, price: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Quantidade disponível</Label>
                <Input type="number" min="0" value={syncStockForm.quantity} onChange={e => setSyncStockForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncStockDialog(null)}>Cancelar</Button>
            <Button onClick={handleSyncStock} disabled={syncingStock} className="gap-2">
              {syncingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Aba placeholder para outros marketplaces ──────────────────────────────────
function PlaceholderTab({ name }) {
  return (
    <EmptyState message={`Integração com ${name} em desenvolvimento. Configure as credenciais em Empresas.`} />
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Marketplaces() {
  const { selectedCompany } = useOutletContext();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['listings', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.MarketplaceListing.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.MarketplaceListing.list('-created_date', 200);
    },
  });

  const activeCompanies = selectedCompany === 'all'
    ? companies
    : companies.filter(c => c.id === selectedCompany);

  const company = activeCompanies[0];

  // Descobre quais marketplaces estão ativos
  const activeMps = company
    ? ['mercado_livre', 'shopee', 'amazon', 'magalu'].filter(mp => company.marketplaces_config?.[mp]?.enabled)
    : [];

  // Stats por marketplace
  const mpStats = ['mercado_livre', 'shopee', 'amazon'].map(mp => {
    const mpListings = listings.filter(l => l.marketplace === mp);
    return {
      id: mp,
      name: MP_LABELS[mp],
      total: mpListings.length,
      active: mpListings.filter(l => l.status === 'ativo').length,
      errors: mpListings.filter(l => l.status === 'erro').length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplaces</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Visualize e importe produtos dos seus marketplaces e do Bling
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mpStats.map(mp => (
          <Card key={mp.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{mp.name}</h3>
                <Store className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{mp.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{mp.active}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-destructive">{mp.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aviso se nenhuma empresa selecionada */}
      {!company && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione uma empresa no topo para visualizar os produtos dos marketplaces ativos.
          </AlertDescription>
        </Alert>
      )}

      {/* Abas dinâmicas por marketplace */}
      <Tabs defaultValue="bling">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="bling" className="gap-1.5 text-xs">
            <div className="w-3.5 h-3.5 rounded bg-orange-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[6px] font-bold">B</span>
            </div>
            Bling
          </TabsTrigger>

          {activeMps.includes('mercado_livre') && (
            <TabsTrigger value="mercado_livre" className="gap-1.5 text-xs">
              <div className="w-3.5 h-3.5 rounded bg-yellow-400 flex items-center justify-center shrink-0">
                <span className="text-black text-[6px] font-bold">ML</span>
              </div>
              Mercado Livre
            </TabsTrigger>
          )}

          {activeMps.includes('shopee') && (
            <TabsTrigger value="shopee" className="gap-1.5 text-xs">
              <div className="w-3.5 h-3.5 rounded bg-orange-500 flex items-center justify-center shrink-0">
                <span className="text-white text-[6px] font-bold">S</span>
              </div>
              Shopee
            </TabsTrigger>
          )}

          {activeMps.includes('amazon') && (
            <TabsTrigger value="amazon" className="gap-1.5 text-xs">
              <div className="w-3.5 h-3.5 rounded bg-amber-900 flex items-center justify-center shrink-0">
                <span className="text-white text-[6px] font-bold">A</span>
              </div>
              Amazon
            </TabsTrigger>
          )}

          {activeMps.includes('magalu') && (
            <TabsTrigger value="magalu" className="gap-1.5 text-xs">
              <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[6px] font-bold">M</span>
              </div>
              Magalu
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bling" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center shrink-0">
                  <span className="text-white text-[7px] font-bold">B</span>
                </div>
                Produtos no Bling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BlingProductsTab company={company} />
            </CardContent>
          </Card>
        </TabsContent>

        {activeMps.includes('mercado_livre') && (
          <TabsContent value="mercado_livre" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-400 flex items-center justify-center shrink-0">
                    <span className="text-black text-[7px] font-bold">ML</span>
                  </div>
                  Anúncios no Mercado Livre
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MercadoLivreProductsTab company={company} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {activeMps.includes('shopee') && (
          <TabsContent value="shopee" className="mt-4">
            <Card><CardContent className="pt-6"><PlaceholderTab name="Shopee" /></CardContent></Card>
          </TabsContent>
        )}

        {activeMps.includes('amazon') && (
          <TabsContent value="amazon" className="mt-4">
            <Card><CardContent className="pt-6"><PlaceholderTab name="Amazon" /></CardContent></Card>
          </TabsContent>
        )}

        {activeMps.includes('magalu') && (
          <TabsContent value="magalu" className="mt-4">
            <Card><CardContent className="pt-6"><PlaceholderTab name="Magalu" /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
