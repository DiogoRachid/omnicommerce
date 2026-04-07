import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Store, Wifi, Download, Upload, ClipboardList, PauseCircle, PlayCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import ConnectionTester from '@/components/marketplaces/ConnectionTester';
import ImportProducts from '@/components/marketplaces/ImportProducts';
import ExportProducts from '@/components/marketplaces/ExportProducts';
import OperationLogs from '@/components/marketplaces/OperationLogs';
import BlingSection from '@/components/marketplaces/BlingSection';

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

export default function Marketplaces() {
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState({}); // { [listingId_action]: true }
  const [syncingAll, setSyncingAll] = useState(false);
  const [stockDialog, setStockDialog] = useState(null); // listing object
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  const setLoading = (id, action, val) =>
    setLoadingAction(prev => ({ ...prev, [`${id}_${action}`]: val }));

  const handlePause = async (l) => {
    setLoading(l.id, 'pause', true);
    try {
      await base44.functions.invoke('mlProxy', { action: 'pauseListing', item_id: l.marketplace_item_id });
      await queryClient.invalidateQueries({ queryKey: ['listings', selectedCompany] });
      toast.success('Anúncio pausado com sucesso.');
    } catch (e) {
      toast.error('Erro ao pausar: ' + e.message);
    } finally {
      setLoading(l.id, 'pause', false);
    }
  };

  const handleReactivate = async (l) => {
    setLoading(l.id, 'reactivate', true);
    try {
      await base44.functions.invoke('mlProxy', { action: 'reactivateListing', item_id: l.marketplace_item_id });
      await queryClient.invalidateQueries({ queryKey: ['listings', selectedCompany] });
      toast.success('Anúncio reativado com sucesso.');
    } catch (e) {
      toast.error('Erro ao reativar: ' + e.message);
    } finally {
      setLoading(l.id, 'reactivate', false);
    }
  };

  const openStockDialog = (l) => {
    setNewPrice(l.preco_anuncio ?? '');
    setNewQty('');
    setStockDialog(l);
  };

  const handleSaveStock = async () => {
    if (!stockDialog) return;
    setSavingStock(true);
    try {
      await base44.functions.invoke('mlProxy', {
        action: 'syncStock',
        item_id: stockDialog.marketplace_item_id,
        price: parseFloat(newPrice),
        available_quantity: parseInt(newQty),
      });
      await queryClient.invalidateQueries({ queryKey: ['listings', selectedCompany] });
      toast.success('Estoque/preço atualizado com sucesso.');
      setStockDialog(null);
    } catch (e) {
      toast.error('Erro ao atualizar: ' + e.message);
    } finally {
      setSavingStock(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await base44.functions.invoke('mlProxy', { action: 'syncListings' });
      await queryClient.invalidateQueries({ queryKey: ['listings', selectedCompany] });
      const count = res.data?.synced ?? res.data?.count ?? '?';
      toast.success(`${count} anúncio(s) sincronizado(s) com sucesso.`);
    } catch (e) {
      toast.error('Erro ao sincronizar: ' + e.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const { data: listings = [] } = useQuery({
    queryKey: ['listings', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.MarketplaceListing.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.MarketplaceListing.list('-created_date', 200);
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
  });

  const { data: blingProducts = [] } = useQuery({
    queryKey: ['bling-products'],
    queryFn: () => base44.entities.Product.filter({ origem: 'importacao' }, '-created_date', 50),
  });

  const marketplaceStats = ['mercado_livre', 'shopee', 'amazon'].map(mp => {
    const mpListings = listings.filter(l => l.marketplace === mp);
    return {
      id: mp,
      name: marketplaceNames[mp],
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
          Gerencie integrações e anúncios nos marketplaces
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Bling card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">B</span>
                </div>
                <h3 className="font-semibold">Bling ERP</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{blingProducts.filter(p => p.tipo !== 'variacao').length}</p>
                <p className="text-xs text-muted-foreground">Produtos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">{blingProducts.filter(p => p.tipo === 'variacao').length}</p>
                <p className="text-xs text-muted-foreground">Variações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Marketplaces stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {marketplaceStats.map((mp) => (
          <Card key={mp.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{mp.name}</h3>
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

      {/* Tabs */}
      <Tabs defaultValue="buscar">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="bling" className="gap-1.5 text-xs">
            <div className="w-3.5 h-3.5 rounded bg-orange-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[8px] font-bold">B</span>
            </div>
            Bling
          </TabsTrigger>
          <TabsTrigger value="buscar" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Buscar Produtos
          </TabsTrigger>
          <TabsTrigger value="exportar" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Exportar Produtos
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="gap-1.5 text-xs">
            <Store className="w-3.5 h-3.5" /> Anúncios
          </TabsTrigger>
          <TabsTrigger value="testar" className="gap-1.5 text-xs">
            <Wifi className="w-3.5 h-3.5" /> Testar Conexão
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Bling */}
        <TabsContent value="bling" className="mt-4">
          <BlingSection selectedCompany={selectedCompany} />
        </TabsContent>

        {/* Testar Conexão */}
        <TabsContent value="testar" className="mt-4">
          <ConnectionTester companies={companies} />
        </TabsContent>

        {/* Buscar Produtos */}
        <TabsContent value="buscar" className="mt-4">
          <ImportProducts companies={companies} />
        </TabsContent>

        {/* Exportar Produtos */}
        <TabsContent value="exportar" className="mt-4">
          <ExportProducts companies={companies} selectedCompany={selectedCompany} />
        </TabsContent>

        {/* Anúncios */}
        <TabsContent value="anuncios" className="mt-4">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Nenhum anúncio encontrado. Exporte produtos para criar anúncios.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Anúncios</CardTitle>
                <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={syncingAll} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  {syncingAll ? 'Sincronizando...' : 'Sincronizar todos'}
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Marketplace</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última Sync</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm font-medium">{l.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {marketplaceNames[l.marketplace] || l.marketplace}
                          </Badge>
                        </TableCell>
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
                                onClick={() => handlePause(l)}
                                title="Pausar anúncio">
                                <PauseCircle className={`w-3.5 h-3.5 ${loadingAction[`${l.id}_pause`] ? 'animate-pulse' : ''}`} />
                              </Button>
                            )}
                            {l.status === 'pausado' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50"
                                disabled={!!loadingAction[`${l.id}_reactivate`]}
                                onClick={() => handleReactivate(l)}
                                title="Reativar anúncio">
                                <PlayCircle className={`w-3.5 h-3.5 ${loadingAction[`${l.id}_reactivate`] ? 'animate-pulse' : ''}`} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => openStockDialog(l)}
                              title="Atualizar estoque/preço">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Dialog Atualizar Estoque/Preço */}
          <Dialog open={!!stockDialog} onOpenChange={() => setStockDialog(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Atualizar Estoque / Preço</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">{stockDialog?.product_name}</p>
                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Quantidade disponível</Label>
                  <Input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="0" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStockDialog(null)}>Cancelar</Button>
                <Button onClick={handleSaveStock} disabled={savingStock}>
                  {savingStock ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <OperationLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}