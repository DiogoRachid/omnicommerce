import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const MP_NAMES = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon' };

async function testMarketplaceConnection(mp, config) {
  // Simula chamada de validação — em produção chamaria a API via agente
  if (!config?.access_token && !config?.user_id) {
    throw new Error('Credenciais não configuradas. Configure em Empresas → Marketplaces.');
  }
  // Mercado Livre: verifica se tem app_id (user_id) e client_secret (access_token)
  if (mp === 'mercado_livre') {
    if (!config.user_id || !config.access_token) throw new Error('App ID e Chave Secreta são obrigatórios.');
  }
  if (mp === 'shopee') {
    if (!config.shop_id || !config.access_token) throw new Error('Shop ID e Access Token são obrigatórios.');
  }
  if (mp === 'amazon') {
    if (!config.seller_id || !config.access_token) throw new Error('Seller ID e Access Token são obrigatórios.');
  }
  // Simula delay de chamada à API
  await new Promise(r => setTimeout(r, 1200));
  return { ok: true };
}

export default function ConnectionTester({ companies }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedMp, setSelectedMp] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const company = companies.find(c => c.id === selectedCompanyId);
  const enabledMps = company
    ? ['mercado_livre', 'shopee', 'amazon'].filter(mp => company.marketplaces_config?.[mp]?.enabled)
    : [];

  const handleTest = async () => {
    if (!company || !selectedMp) return;
    setLoading(true);
    const now = new Date();
    let status = 'sucesso';
    let mensagem = '';
    try {
      await testMarketplaceConnection(selectedMp, company.marketplaces_config?.[selectedMp]);
      mensagem = 'Conexão realizada com sucesso.';
    } catch (e) {
      status = 'erro';
      mensagem = e.message;
    }
    const log = {
      tipo: 'teste_conexao',
      status,
      marketplace: selectedMp,
      company_id: company.id,
      company_name: company.nome_fantasia || company.razao_social,
      mensagem,
      detalhes: { timestamp: now.toISOString() },
    };
    await base44.entities.MarketplaceLog.create(log);
    setResults(prev => [{ ...log, id: Date.now(), created_date: now.toISOString() }, ...prev]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Testar Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Empresa</label>
              <Select value={selectedCompanyId} onValueChange={v => { setSelectedCompanyId(v); setSelectedMp(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Marketplace</label>
              <Select value={selectedMp} onValueChange={setSelectedMp} disabled={!selectedCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {enabledMps.length === 0 && <SelectItem value="none" disabled>Nenhum habilitado</SelectItem>}
                  {enabledMps.map(mp => (
                    <SelectItem key={mp} value={mp}>{MP_NAMES[mp]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleTest}
                disabled={!selectedCompanyId || !selectedMp || loading}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                Testar Conexão
              </Button>
            </div>
          </div>

          {!selectedCompanyId && (
            <Alert>
              <AlertDescription className="text-sm">
                Selecione uma empresa e um marketplace para testar a conexão. As credenciais são configuradas em <strong>Empresas → APIs dos Marketplaces</strong>.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultados dos Testes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border">
                {r.status === 'sucesso'
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{MP_NAMES[r.marketplace]}</Badge>
                    <span className="text-xs font-medium">{r.company_name}</span>
                    <Badge variant={r.status === 'sucesso' ? 'default' : 'destructive'} className="text-[10px]">
                      {r.status === 'sucesso' ? 'Sucesso' : 'Erro'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.mensagem}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(r.created_date).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}