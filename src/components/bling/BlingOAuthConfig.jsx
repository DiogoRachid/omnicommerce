import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Loader2, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const BLING_AUTH_URL = 'https://www.bling.com.br/OAuth2/Auth';
const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = 'b72a3e2b6c6a3a51b2bcff6d1cddd97b60f1bf01d8ef8e82ec985fde66cef6a0';
const REDIRECT_URI = window.location.origin + '/configuracoes';

export default function BlingOAuthConfig() {
  const [status, setStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);



  const doRefresh = async (tokenRecord, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Faça uma requisição HTTP POST para renovar o token OAuth2 do Bling.

URL: https://www.bling.com.br/Api/v3/oauth/token
Método: POST
Headers:
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}
Body (form-urlencoded):
  grant_type=refresh_token
  refresh_token=${tokenRecord.refresh_token}

Retorne APENAS um JSON com os campos: access_token, refresh_token, expires_in (segundos).
Se der erro, retorne: {"error": "mensagem do erro"}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            expires_in: { type: 'number' },
            error: { type: 'string' },
          },
        },
      });

      if (result.error) throw new Error(result.error);
      if (!result.access_token) throw new Error('Resposta inválida da API do Bling.');

      const expiresAt = new Date(Date.now() + (result.expires_in || 21600) * 1000);
      await base44.entities.BlingToken.update(tokenRecord.id, {
        access_token: result.access_token,
        refresh_token: result.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
      });

      if (!silent) {
        setStatus('ok');
        setStatusMsg(`Token renovado com sucesso! Válido até ${expiresAt.toLocaleString('pt-BR')}.`);
      }
    } catch (e) {
      if (!silent) {
        setStatus('error');
        setStatusMsg('Erro ao renovar token: ' + e.message);
      }
    }
    if (!silent) setRefreshing(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatus('loading');
    setStatusMsg('Renovando token...');
    try {
      const tokens = await base44.entities.BlingToken.list();
      if (!tokens || tokens.length === 0) {
        setStatus('error');
        setStatusMsg('Nenhum token encontrado. Faça a autorização primeiro.');
        setRefreshing(false);
        return;
      }
      await doRefresh(tokens[0]);
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
      setRefreshing(false);
    }
  };

  const checkStatus = async () => {
    setStatus('loading');
    setStatusMsg('Verificando token...');
    try {
      const tokens = await base44.entities.BlingToken.list();
      if (!tokens || tokens.length === 0) {
        setStatus('error');
        setStatusMsg('Nenhum token Bling encontrado. Clique em "Autorizar / Reconectar Bling" para conectar.');
        return;
      }
      const t = tokens[0];
      const expiresAt = t.expires_at ? new Date(t.expires_at) : null;
      const expired = expiresAt && expiresAt < new Date();
      const minutesLeft = expiresAt ? Math.round((expiresAt - new Date()) / 1000 / 60) : null;
      setStatus(expired ? 'error' : 'ok');
      setStatusMsg(expired
        ? `Token expirado em ${expiresAt.toLocaleString('pt-BR')}. Clique em "Renovar Token" ou reconecte.`
        : `Conectado! Conta: ${t.account || 'N/A'}. Token válido até ${expiresAt ? expiresAt.toLocaleString('pt-BR') : 'indeterminado'}${minutesLeft !== null ? ` (${minutesLeft} min restantes)` : ''}.`
      );
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro ao verificar: ' + e.message);
    }
  };

  const handleAuthorize = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
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
            <AlertDescription className={status === 'ok' ? 'text-green-800 whitespace-pre-wrap' : ''}>
              {statusMsg}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <p className="font-medium mb-1">URL de Redirecionamento OAuth2 (configure no Bling):</p>
          <code className="break-all">{REDIRECT_URI}</code>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkStatus} variant="outline" className="gap-2" disabled={status === 'loading' || refreshing}>
            {status === 'loading'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <MessageSquare className="w-4 h-4" />}
            Verificar Status
          </Button>
          <Button onClick={handleRefresh} variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50" disabled={refreshing || status === 'loading'}>
            {refreshing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            Renovar Token
          </Button>
          <Button onClick={handleAuthorize} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <ExternalLink className="w-4 h-4" />
            Autorizar / Reconectar Bling
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Ao clicar em "Autorizar", você será redirecionado ao Bling para conceder acesso. Após autorizar, voltará automaticamente para esta página.
        </p>
      </CardContent>
    </Card>
  );
}