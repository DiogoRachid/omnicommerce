import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2, Plus, Check, X, Copy, CheckCheck,
  ExternalLink, LogOut, Loader2, RefreshCw, CheckCircle2, AlertCircle, Save, Download,
} from 'lucide-react';
import BlingImportDialog from '@/components/bling/BlingImportDialog';

// ── Constantes ────────────────────────────────────────────────────────────────
const BLING_CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/bling-callback';
const ML_REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/ml-callback';

function getBlingAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: BLING_CLIENT_ID,
    redirect_uri: BLING_REDIRECT_URI,
    state: 'bling_oauth',
  });
  return `${BLING_AUTH_URL}?${params.toString()}`;
}

function getMlAuthUrl(appId) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appId,
    redirect_uri: ML_REDIRECT_URI,
    scope: 'offline_access read write',
  });
  return `https://auth.mercadolivre.com.br/authorization?${params.toString()}`;
}

async function callBlingProxy(action, payload = {}) {
  const res = await base44.functions.invoke('blingProxy', { action, payload });
  return res.data;
}

// ── Painel Bling (dentro do dialog) ──────────────────────────────────────────
function BlingConnectionPanel({ company }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const s = await callBlingProxy('status');
      setStatus(s);
    } catch { setStatus({ connected: false }); }
    setLoading(false);
  };

  const handleConnect = () => { window.location.href = getBlingAuthUrl(); };

  const handleDisconnect = async () => {
    setLoading(true);
    await callBlingProxy('disconnect');
    setStatus({ connected: false });
    setMsg('Bling desconectado.');
    setMsgType('info');
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMsg('');
    try {
      await callBlingProxy('refresh');
      setMsg('Token renovado com sucesso!');
      setMsgType('success');
      await checkStatus();
    } catch (err) {
      setMsg(`Falha ao renovar token: ${err?.message || 'Erro desconhecido'}. Tente reconectar o Bling.`);
      setMsgType('error');
    }
    setRefreshing(false);
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>;

  const isConnected = status?.connected && !status?.expired;
  const hasToken = status?.connected; // token existe, pode estar expirado

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center shrink-0">
          <span className="text-white text-[9px] font-bold">B</span>
        </div>
        <span className="font-medium text-sm">Status da conexão Bling</span>
        <Badge className={`ml-auto text-xs ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>

      {msg && (
        <Alert className={msgType === 'success' ? 'border-green-200 bg-green-50' : ''}>
          {msgType === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription className={msgType === 'success' ? 'text-green-800' : ''}>{msg}</AlertDescription>
        </Alert>
      )}

      {status?.connected && (
        <div className="text-xs space-y-0.5">
          <p className="text-muted-foreground">
            Token expira em: <span className={status.expired ? 'text-destructive font-medium' : ''}>
              {status.expires_at ? new Date(status.expires_at).toLocaleString('pt-BR') : '?'}
            </span>
          </p>
          {status.expired && (
            <p className="text-destructive font-medium">⚠ Token expirado — clique em &quot;Renovar Token&quot;</p>
          )}
          {status.scope && <p className="text-muted-foreground">Escopo: {status.scope}</p>}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleConnect} className="gap-2 bg-orange-500 hover:bg-orange-600" size="sm">
          <ExternalLink className="w-4 h-4" /> {isConnected ? 'Reconectar' : 'Conectar ao Bling'}
        </Button>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className={`gap-1.5 ${status?.expired ? 'border-orange-400 text-orange-700 hover:bg-orange-50 font-semibold' : ''}`}
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {status?.expired ? '⚠ Renovar Token (Expirado)' : 'Renovar Token'}
        </Button>
        {hasToken && (
          <Button onClick={handleDisconnect} variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
            <LogOut className="w-3.5 h-3.5" /> Desconectar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Painel Mercado Livre (dentro do dialog) ───────────────────────────────────
function MlConnectionPanel({ mlConfig }) {
  const [status, setStatus] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [copied, setCopied] = useState(false);

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('mlProxy', { action: 'status' });
      setStatus(res.data);
      if (res.data?.connected) {
        const userRes = await base44.functions.invoke('mlProxy', { action: 'getUser' });
        setSeller(userRes.data);
      }
    } catch { setStatus({ connected: false }); }
    setLoading(false);
  };

  const handleConnect = () => {
    const appId = mlConfig?.ml_app_id?.trim();
    if (!appId) { setMsg('Salve o App ID antes de conectar.'); setMsgType('error'); return; }
    window.location.href = getMlAuthUrl(appId);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    await base44.functions.invoke('mlProxy', { action: 'disconnect' });
    setStatus({ connected: false });
    setSeller(null);
    setMsg('Mercado Livre desconectado.');
    setMsgType('info');
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ML_REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-yellow-500" /></div>;

  const isConnected = status?.connected;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center shrink-0">
          <span className="text-black text-[9px] font-bold">ML</span>
        </div>
        <span className="font-medium text-sm">Status da conexão Mercado Livre</span>
        <Badge className={`ml-auto text-xs ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>

      {msg && (
        <Alert className={msgType === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {msgType === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={msgType === 'success' ? 'text-green-800' : 'text-red-800'}>{msg}</AlertDescription>
        </Alert>
      )}

      {isConnected && status && (
        <p className="text-xs text-muted-foreground">
          Token expira em: {status.expires_at ? new Date(status.expires_at).toLocaleString('pt-BR') : '?'}
          {seller && <> · Vendedor: {seller.nickname || seller.first_name} (ID: {seller.id})</>}
        </p>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">URL de redirecionamento (configure no ML Developers)</Label>
        <div className="flex gap-2 mt-1">
          <Input value={ML_REDIRECT_URI} readOnly className="font-mono text-xs bg-muted flex-1" />
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {!isConnected ? (
          <Button onClick={handleConnect} className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold">
            <ExternalLink className="w-4 h-4" /> Conectar ao Mercado Livre
          </Button>
        ) : (
          <>
            <Button onClick={checkStatus} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Verificar Token
            </Button>
            <Button onClick={handleDisconnect} variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
              <LogOut className="w-3.5 h-3.5" /> Desconectar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Formulário principal ──────────────────────────────────────────────────────
const emptyMarketplace = { enabled: false, ml_app_id: '', ml_secret_key: '', access_token: '', user_id: '', shop_id: '', seller_id: '' };

const emptyCompany = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
  regime_tributario: 'simples_nacional', telefone: '', email: '',
  bling_client_id: '', bling_client_secret: '',
  bling_integrated: false, status: 'ativa',
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
  marketplaces_config: {
    mercado_livre: { ...emptyMarketplace },
    shopee: { ...emptyMarketplace },
    amazon: { ...emptyMarketplace },
    magalu: { ...emptyMarketplace },
  },
};

export default function Companies() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState(emptyCompany);
  const [activeTab, setActiveTab] = useState('dados');
  const [copiedBling, setCopiedBling] = useState(false);
  const [blingImportCompany, setBlingImportCompany] = useState(null);
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingCompany
      ? base44.entities.Company.update(editingCompany.id, data)
      : base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowDialog(false);
      setEditingCompany(null);
      setForm(emptyCompany);
    },
  });

  const openNew = () => {
    setEditingCompany(null);
    setForm(emptyCompany);
    setActiveTab('dados');
    setShowDialog(true);
  };

  const openEdit = (company) => {
    setEditingCompany(company);
    setForm({
      ...emptyCompany,
      ...company,
      endereco: { ...emptyCompany.endereco, ...(company.endereco || {}) },
      marketplaces_config: {
        mercado_livre: { ...emptyMarketplace, ...(company.marketplaces_config?.mercado_livre || {}) },
        shopee: { ...emptyMarketplace, ...(company.marketplaces_config?.shopee || {}) },
        amazon: { ...emptyMarketplace, ...(company.marketplaces_config?.amazon || {}) },
        magalu: { ...emptyMarketplace, ...(company.marketplaces_config?.magalu || {}) },
      },
    });
    setActiveTab('dados');
    setShowDialog(true);
  };

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateEndereco = (key, value) => setForm(prev => ({ ...prev, endereco: { ...prev.endereco, [key]: value } }));
  const updateMarketplace = (mp, key, value) => setForm(prev => ({
    ...prev,
    marketplaces_config: { ...prev.marketplaces_config, [mp]: { ...prev.marketplaces_config[mp], [key]: value } },
  }));

  const handleSave = () => saveMutation.mutate(form);

  const handleCopyBling = () => {
    navigator.clipboard.writeText(BLING_REDIRECT_URI);
    setCopiedBling(true);
    setTimeout(() => setCopiedBling(false), 2000);
  };

  // Conta marketplaces ativos
  const countActive = (c) =>
    ['mercado_livre', 'shopee', 'amazon', 'magalu'].filter(mp => c.marketplaces_config?.[mp]?.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas empresas, conexões e APIs</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova Empresa
        </Button>
      </div>

      {companies.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma empresa cadastrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre sua primeira empresa para começar</p>
          <Button className="mt-4" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Cadastrar Empresa</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {companies.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(c)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{c.nome_fantasia || c.razao_social}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                    </p>
                  </div>
                </div>
                <Badge variant={c.status === 'ativa' ? 'default' : 'secondary'} className="text-[10px]">
                  {c.status === 'ativa' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] gap-1 ${c.bling_integrated ? 'border-orange-300 text-orange-700' : ''}`}>
                  {c.bling_integrated ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  Bling
                </Badge>
                {c.marketplaces_config?.mercado_livre?.enabled && (
                  <Badge variant="outline" className="text-[10px] border-yellow-300 text-yellow-700">ML</Badge>
                )}
                {c.marketplaces_config?.shopee?.enabled && (
                  <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">Shopee</Badge>
                )}
                {c.marketplaces_config?.amazon?.enabled && (
                  <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-800">Amazon</Badge>
                )}
                {c.marketplaces_config?.magalu?.enabled && (
                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">Magalu</Badge>
                )}
                {c.bling_integrated && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-6 text-[10px] px-2 gap-1"
                    onClick={(e) => { e.stopPropagation(); setBlingImportCompany(c); }}
                  >
                    <Download className="w-3 h-3" /> Importar
                  </Button>
                )}
                {countActive(c) === 0 && !c.bling_integrated && (
                  <span className="text-[10px] text-muted-foreground">Sem integrações ativas</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BlingImportDialog
        company={blingImportCompany}
        open={!!blingImportCompany}
        onClose={() => setBlingImportCompany(null)}
      />

      {/* ── Dialog de edição ── */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) { setShowDialog(false); setEditingCompany(null); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? `Editar — ${editingCompany.nome_fantasia || editingCompany.razao_social}` : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1 text-xs">Dados</TabsTrigger>
              <TabsTrigger value="bling" className="flex-1 text-xs">Bling</TabsTrigger>
              <TabsTrigger value="mercado_livre" className="flex-1 text-xs">Mercado Livre</TabsTrigger>
              <TabsTrigger value="outros" className="flex-1 text-xs">Outros MP</TabsTrigger>
            </TabsList>

            {/* ── ABA DADOS ── */}
            <TabsContent value="dados" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Razão Social *</Label>
                  <Input value={form.razao_social} onChange={e => updateField('razao_social', e.target.value)} />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={e => updateField('nome_fantasia', e.target.value)} />
                </div>
                <div>
                  <Label>CNPJ *</Label>
                  <Input value={form.cnpj} onChange={e => updateField('cnpj', e.target.value)} placeholder="00000000000000" />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.inscricao_estadual} onChange={e => updateField('inscricao_estadual', e.target.value)} />
                </div>
                <div>
                  <Label>Regime Tributário</Label>
                  <Select value={form.regime_tributario} onValueChange={v => updateField('regime_tributario', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={e => updateField('telefone', e.target.value)} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={e => updateField('email', e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => updateField('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Endereço</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Logradouro</Label>
                    <Input value={form.endereco.logradouro} onChange={e => updateEndereco('logradouro', e.target.value)} />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input value={form.endereco.numero} onChange={e => updateEndereco('numero', e.target.value)} />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input value={form.endereco.complemento} onChange={e => updateEndereco('complemento', e.target.value)} />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={form.endereco.bairro} onChange={e => updateEndereco('bairro', e.target.value)} />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={form.endereco.cidade} onChange={e => updateEndereco('cidade', e.target.value)} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input value={form.endereco.uf} onChange={e => updateEndereco('uf', e.target.value)} maxLength={2} />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input value={form.endereco.cep} onChange={e => updateEndereco('cep', e.target.value)} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── ABA BLING ── */}
            <TabsContent value="bling" className="space-y-4 pt-2">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Configure as credenciais OAuth2 do Bling para esta empresa.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Client ID</Label>
                    <Input
                      value={form.bling_client_id}
                      onChange={e => updateField('bling_client_id', e.target.value)}
                      placeholder="Client ID do aplicativo Bling"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Client Secret</Label>
                    <Input
                      type="password"
                      value={form.bling_client_secret}
                      onChange={e => updateField('bling_client_secret', e.target.value)}
                      placeholder="Client Secret do aplicativo Bling"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">URL de redirecionamento (configure no Bling)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={BLING_REDIRECT_URI} readOnly className="font-mono text-xs bg-muted flex-1" />
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopyBling}>
                        {copiedBling ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedBling ? 'Copiado!' : 'Copiar'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cole este valor em <strong>Central de Extensões → Área do Integrador</strong> no Bling.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={!!form.bling_integrated}
                    onCheckedChange={v => updateField('bling_integrated', v)}
                  />
                  <Label className="text-sm cursor-pointer">Bling integrado</Label>
                </div>

                {editingCompany?.id ? (
                  <div className="border rounded-lg p-4 bg-muted/20 mt-2">
                    <BlingConnectionPanel company={editingCompany} />
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription className="text-xs">Salve a empresa primeiro para poder conectar ao Bling.</AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            {/* ── ABA MERCADO LIVRE ── */}
            <TabsContent value="mercado_livre" className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Configure o App ID e conecte via OAuth2.</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Habilitado</Label>
                  <Switch
                    checked={!!form.marketplaces_config.mercado_livre.enabled}
                    onCheckedChange={v => updateMarketplace('mercado_livre', 'enabled', v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">App ID (ID do Aplicativo)</Label>
                  <Input
                    placeholder="Ex: 510111497386242"
                    value={form.marketplaces_config.mercado_livre.ml_app_id}
                    onChange={e => updateMarketplace('mercado_livre', 'ml_app_id', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Chave Secreta (Client Secret)</Label>
                  <Input
                    type="password"
                    placeholder="Chave secreta do aplicativo ML"
                    value={form.marketplaces_config.mercado_livre.ml_secret_key}
                    onChange={e => updateMarketplace('mercado_livre', 'ml_secret_key', e.target.value)}
                  />
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  Salve as credenciais antes de conectar. A URL de redirecionamento está na aba Mercado Livre.
                </AlertDescription>
              </Alert>

              {editingCompany?.id ? (
                <div className="border rounded-lg p-4 bg-muted/20">
                  <MlConnectionPanel mlConfig={form.marketplaces_config.mercado_livre} />
                </div>
              ) : (
                <Alert>
                  <AlertDescription className="text-xs">Salve a empresa primeiro para poder conectar ao Mercado Livre.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* ── ABA OUTROS MARKETPLACES ── */}
            <TabsContent value="outros" className="space-y-4 pt-2">

              {/* Shopee */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-white">S</span>
                    </div>
                    <span className="font-medium text-sm">Shopee</span>
                  </div>
                  <Switch
                    checked={!!form.marketplaces_config.shopee.enabled}
                    onCheckedChange={v => updateMarketplace('shopee', 'enabled', v)}
                  />
                </div>
                {form.marketplaces_config.shopee.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Shop ID</Label>
                      <Input
                        placeholder="ID da loja Shopee"
                        value={form.marketplaces_config.shopee.shop_id}
                        onChange={e => updateMarketplace('shopee', 'shop_id', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Access Token</Label>
                      <Input
                        type="password"
                        placeholder="Token de acesso Shopee"
                        value={form.marketplaces_config.shopee.access_token}
                        onChange={e => updateMarketplace('shopee', 'access_token', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Amazon */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-amber-900 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-white">A</span>
                    </div>
                    <span className="font-medium text-sm">Amazon</span>
                  </div>
                  <Switch
                    checked={!!form.marketplaces_config.amazon.enabled}
                    onCheckedChange={v => updateMarketplace('amazon', 'enabled', v)}
                  />
                </div>
                {form.marketplaces_config.amazon.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Seller ID</Label>
                      <Input
                        placeholder="ID do vendedor Amazon"
                        value={form.marketplaces_config.amazon.seller_id}
                        onChange={e => updateMarketplace('amazon', 'seller_id', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Access Token (SP-API)</Label>
                      <Input
                        type="password"
                        placeholder="Token de acesso Amazon"
                        value={form.marketplaces_config.amazon.access_token}
                        onChange={e => updateMarketplace('amazon', 'access_token', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Magalu */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-white">M</span>
                    </div>
                    <span className="font-medium text-sm">Magalu</span>
                  </div>
                  <Switch
                    checked={!!form.marketplaces_config.magalu?.enabled}
                    onCheckedChange={v => updateMarketplace('magalu', 'enabled', v)}
                  />
                </div>
                {form.marketplaces_config.magalu?.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Seller ID</Label>
                      <Input
                        placeholder="ID do vendedor Magalu"
                        value={form.marketplaces_config.magalu?.seller_id || ''}
                        onChange={e => updateMarketplace('magalu', 'seller_id', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Access Token</Label>
                      <Input
                        type="password"
                        placeholder="Token de acesso Magalu"
                        value={form.marketplaces_config.magalu?.access_token || ''}
                        onChange={e => updateMarketplace('magalu', 'access_token', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}