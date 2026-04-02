import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Store, ExternalLink, Wifi, Download, Upload, ClipboardList } from 'lucide-react';
import ConnectionTester from '@/components/marketplaces/ConnectionTester';
import ImportProducts from '@/components/marketplaces/ImportProducts';
import ExportProducts from '@/components/marketplaces/ExportProducts';
import OperationLogs from '@/components/marketplaces/OperationLogs';
import MercadoLivrePanel from '@/components/marketplaces/MercadoLivrePanel';

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

  const activeCompanies = selectedCompany === 'all'
    ? companies
    : companies.filter(c => c.id === selectedCompany);

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

      {/* Stats cards — mantidos */}
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

      {/* Tabs com as novas funcionalidades */}
      <Tabs defaultValue="contas">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="contas" className="gap-1.5 text-xs">
            <Store className="w-3.5 h-3.5" /> Contas
          </TabsTrigger>
          <TabsTrigger value="testar" className="gap-1.5 text-xs">
            <Wifi className="w-3.5 h-3.5" /> Testar Conexão
          </TabsTrigger>
          <TabsTrigger value="importar" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Importar Produtos
          </TabsTrigger>
          <TabsTrigger value="exportar" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Exportar Produtos
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="gap-1.5 text-xs">
            <Store className="w-3.5 h-3.5" /> Anúncios
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Contas — mantido */}
        <TabsContent value="contas" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mercado Livre</CardTitle>
              </CardHeader>
              <CardContent>
                <MercadoLivrePanel />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Integrações por Empresa</CardTitle>
              </CardHeader>
              <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure as integrações dos marketplaces em cada empresa na página de{' '}
                <a href="/empresas" className="text-primary underline">Empresas</a>.
              </p>
              {activeCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa selecionada</p>
              ) : (
                <div className="space-y-3">
                  {activeCompanies.map((c) => (
                    <div key={c.id} className="p-4 border rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">{c.nome_fantasia || c.razao_social}</h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={c.bling_integrated ? 'default' : 'secondary'} className="text-[10px]">
                          Bling: {c.bling_integrated ? 'Conectado' : 'Desconectado'}
                        </Badge>
                        <Badge variant={c.marketplaces_config?.mercado_livre?.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          ML: {c.marketplaces_config?.mercado_livre?.enabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant={c.marketplaces_config?.shopee?.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          Shopee: {c.marketplaces_config?.shopee?.enabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant={c.marketplaces_config?.amazon?.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          Amazon: {c.marketplaces_config?.amazon?.enabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Testar Conexão */}
        <TabsContent value="testar" className="mt-4">
          <ConnectionTester companies={activeCompanies} />
        </TabsContent>

        {/* Importar Produtos */}
        <TabsContent value="importar" className="mt-4">
          <ImportProducts companies={activeCompanies} />
        </TabsContent>

        {/* Exportar Produtos */}
        <TabsContent value="exportar" className="mt-4">
          <ExportProducts companies={activeCompanies} selectedCompany={selectedCompany} />
        </TabsContent>

        {/* Anúncios — mantido */}
        <TabsContent value="anuncios" className="mt-4">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Nenhum anúncio encontrado. Exporte produtos para criar anúncios.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Anúncios</CardTitle>
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
                      <TableHead className="w-10"></TableHead>
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
                          {l.url_anuncio && (
                            <a href={l.url_anuncio} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <OperationLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}