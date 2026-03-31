import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Loader2, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const REDIRECT_URI = window.location.origin + '/configuracoes';

export default function BlingOAuthConfig() {
  const [status, setStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Ao montar, verifica se há um "code" na URL (callback do Bling)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'bling_oauth') {
      // Remove o code da URL sem reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      exchangeCode(code);
    } else {
      // Só verifica status passivo
      checkStatus();
    }
  }, []);

  const checkStatus = async () => {
    try {
      const tokens = await base44.entities.BlingToken.list();
      if (!tokens || tokens.length === 0) {
        setStatus('error');
        setStatusMsg('Não conectado. Clique em "Conectar ao Bling" para autorizar.');
        return;
      }
      const t = tokens[0];
      const expiresAt = t.expires_at ? new Date(t.expires_at) : null;
      const expired = expiresAt && expiresAt < new Date();
      const minutesLeft = expiresAt ? Math.round((expiresAt - new Date()) / 1000 / 60) : null;
      setStatus(expired ? 'error' : 'ok');
      setStatusMsg(expired
        ? `Token expirado em ${expiresAt.toLocaleString('pt-BR')}. Clique em "Renovar Token".`
        : `Conectado! Conta: ${t.account || 'N/A'} · Token válido até ${expiresAt ? expiresAt.toLocaleString('pt-BR') : '?'} (${minutesLeft} min restantes).`
      );
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro ao verificar: ' + e.message);
    }
  };

  const exchangeCode = async (code) => {
    setLoading(true);
    setStatus('loading');
    setStatusMsg('Trocando código de autorização por tokens...');
    try {
      const result = await base44.functions.invoke('blingOAuth', {
        action: 'exchange_code',
        code,
        redirect_uri: REDIRECT_URI,
        account: 'bling',
      });
      if (result.data?.success) {
        setStatus('ok');
        setStatusMsg(`Bling conectado com sucesso! Token válido até ${new Date(result.data.expires_at).toLocaleString('pt-BR')}.`);
      } else {
        setStatus('error');
        setStatusMsg('Erro ao conectar: ' + (result.data?.error || 'Resposta inválida'));
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setStatus('loading');
    setStatusMsg('Renovando token via servidor...');
    try {
      const result = await base44.functions.invoke('blingOAuth', { action: 'refresh' });
      if (result.data?.success) {
        setStatus('ok');
        setStatusMsg(`Token renovado! Válido até ${new Date(result.data.expires_at).toLocaleString('pt-BR')}.`);
      } else {
        setStatus('error');
        setStatusMsg(`Falha: ${result.data?.error}. Se expirou, clique em "Conectar ao Bling" para reautorizar.`);
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
    }
    setLoading(false);
  };

  const handleAuthorize = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      state: 'bling_oauth',
    });
    window.location.href = `${BLING_AUTH_URL}?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">B</span>
          </div>
          Integração Bling
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 ml-auto text-xs">
            OAuth2
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {status && (
          <Alert
            variant={status === 'error' ? 'destructive' : 'default'}
            className={status === 'ok' ? 'border-green-200 bg-green-50' : ''}
          >
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {status === 'error' && <AlertCircle className="h-4 w-4" />}
            <AlertDescription className={status === 'ok' ? 'text-green-800' : ''}>
              {statusMsg}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-0.5">URL de Redirecionamento (configure no Bling):</p>
            <code className="break-all">{REDIRECT_URI}</code>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkStatus} variant="outline" size="sm" className="gap-2" disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Verificar Status
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50" disabled={loading}>
            {loading && status === 'loading'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Renovar Token
          </Button>
          <Button onClick={handleAuthorize} size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600" disabled={loading}>
            <ExternalLink className="w-3.5 h-3.5" />
            Conectar ao Bling
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Ao clicar em "Conectar ao Bling" você será redirecionado para autorizar o acesso. Após autorizar, voltará automaticamente e o token será salvo.
        </p>
      </CardContent>
    </Card>
  );
}