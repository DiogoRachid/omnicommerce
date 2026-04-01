import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2, AlertCircle, ExternalLink, LogOut,
  Loader2, RefreshCw, Package, ShoppingCart, Plus,
} from 'lucide-react';

// Client ID é público (usado apenas para montar a URL de autorização OAuth no browser)
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

// Todas as chamadas ao Bling passam pelo backend
async function callProxy(action, payload = {}) {
  const res = await base44.functions.invoke('blingProxy', { action, payload });
  return res.data;
}

export default function BlingPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');

  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ nome: '', codigo: '', preco: '', unidade: 'UN' });
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'bling_oauth') {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleExchangeCode(code);
    } else {
      checkStatus();
    }
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    const s = await callProxy('status');
    setStatus(s);
    setLoading(false);
  };

  const handleExchangeCode = async (code) => {
    setLoading(true);
    setMsg('Conectando ao Bling...');
    setMsgType('info');
    // O exchange agora é feito pela página BlingCallback — este bloco não deve ser atingido
    await callProxy('exchange', { code, redirect_uri: BLING_REDIRECT_URI });
    setMsg('Bling conectado com sucesso!');
    setMsgType('success');
    await checkStatus();
  };

  const handleConnect = () => {
    window.location.href = getBlingAuthUrl();
  };

  const handleDisconnect = async () => {
    setLoading(true);
    await callProxy('disconnect');
    setStatus({ connected: false });
    setMsg('Bling desconectado.');
    setMsgType('info');
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setMsg('Renovando token...');
    await callProxy('refresh');
    setMsg('Token renovado!');
    setMsgType('success');
    await checkStatus();
  };

  const handleListarProdutos = async () => {
    setLoadingProdutos(true);
    const data = await callProxy('listProducts');
    setProdutos(data?.data || []);
    setLoadingProdutos(false);
  };

  const handleListarPedidos = async () => {
    setLoadingPedidos(true);
    const data = await callProxy('listOrders');
    setPedidos(data?.data || []);
    setLoadingPedidos(false);
  };

  const handleCadastrarProduto = async () => {
    setCadastrando(true);
    await callProxy('createProduct', {
      produto: {
        nome: novoProduto.nome,
        codigo: novoProduto.codigo,
        preco: parseFloat(novoProduto.preco) || 0,
        unidade: novoProduto.unidade,
      },
    });
    setNovoProduto({ nome: '', codigo: '', preco: '', unidade: 'UN' });
    setMsg('Produto cadastrado no Bling!');
    setMsgType('success');
    setCadastrando(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">B</span>
            </div>
            Integração Bling
            <Badge className={`ml-auto text-xs ${status?.connected && !status?.expired ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
              {status?.connected && !status?.expired ? 'Conectado' : 'Desconectado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && (
            <Alert className={msgType === 'success' ? 'border-green-200 bg-green-50' : ''}>
              {msgType === 'success'
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <AlertCircle className="h-4 w-4" />}
              <AlertDescription className={msgType === 'success' ? 'text-green-800' : ''}>{msg}</AlertDescription>
            </Alert>
          )}

          {status?.connected && (
            <p className="text-xs text-muted-foreground">
              Token expira em: {status.expires_at ? new Date(status.expires_at).toLocaleString('pt-BR') : '?'}
              {status.scope && <> · Escopo: {status.scope}</>}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {!status?.connected ? (
              <Button onClick={handleConnect} className="gap-2 bg-orange-500 hover:bg-orange-600">
                <ExternalLink className="w-4 h-4" /> Conectar ao Bling
              </Button>
            ) : (
              <>
                <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Renovar Token
                </Button>
                <Button onClick={handleDisconnect} variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <LogOut className="w-3.5 h-3.5" /> Desconectar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {status?.connected && !status?.expired && (
        <Tabs defaultValue="produtos">
          <TabsList>
            <TabsTrigger value="produtos" className="gap-2"><Package className="w-4 h-4" /> Produtos</TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2"><ShoppingCart className="w-4 h-4" /> Pedidos</TabsTrigger>
            <TabsTrigger value="cadastrar" className="gap-2"><Plus className="w-4 h-4" /> Cadastrar Produto</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Button onClick={handleListarProdutos} disabled={loadingProdutos} variant="outline" className="gap-2">
                  {loadingProdutos ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Buscar Produtos
                </Button>
                {produtos.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium text-muted-foreground">Nome</th>
                          <th className="p-2 text-left font-medium text-muted-foreground">Código</th>
                          <th className="p-2 text-right font-medium text-muted-foreground">Preço</th>
                          <th className="p-2 text-center font-medium text-muted-foreground">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtos.map((p) => (
                          <tr key={p.id} className="border-t hover:bg-muted/30">
                            <td className="p-2 font-medium">{p.nome}</td>
                            <td className="p-2 font-mono text-xs">{p.codigo}</td>
                            <td className="p-2 text-right">R$ {parseFloat(p.preco || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <Badge variant={p.situacao === 'A' ? 'default' : 'secondary'} className="text-[10px]">
                                {p.situacao === 'A' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pedidos">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Button onClick={handleListarPedidos} disabled={loadingPedidos} variant="outline" className="gap-2">
                  {loadingPedidos ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Buscar Pedidos
                </Button>
                {pedidos.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium text-muted-foreground">Número</th>
                          <th className="p-2 text-left font-medium text-muted-foreground">Data</th>
                          <th className="p-2 text-right font-medium text-muted-foreground">Total</th>
                          <th className="p-2 text-center font-medium text-muted-foreground">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidos.map((p) => (
                          <tr key={p.id} className="border-t hover:bg-muted/30">
                            <td className="p-2 font-mono text-xs">#{p.numero}</td>
                            <td className="p-2 text-xs">{p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}</td>
                            <td className="p-2 text-right">R$ {parseFloat(p.totalVenda || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <Badge variant="outline" className="text-[10px]">{p.situacao?.value || '-'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cadastrar">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={novoProduto.nome} onChange={e => setNovoProduto(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do produto" />
                  </div>
                  <div>
                    <Label>Código (SKU)</Label>
                    <Input value={novoProduto.codigo} onChange={e => setNovoProduto(p => ({ ...p, codigo: e.target.value }))} placeholder="SKU" />
                  </div>
                  <div>
                    <Label>Preço</Label>
                    <Input type="number" value={novoProduto.preco} onChange={e => setNovoProduto(p => ({ ...p, preco: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Input value={novoProduto.unidade} onChange={e => setNovoProduto(p => ({ ...p, unidade: e.target.value }))} placeholder="UN" />
                  </div>
                </div>
                <Button onClick={handleCadastrarProduto} disabled={cadastrando || !novoProduto.nome} className="gap-2 bg-orange-500 hover:bg-orange-600">
                  {cadastrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar no Bling
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}