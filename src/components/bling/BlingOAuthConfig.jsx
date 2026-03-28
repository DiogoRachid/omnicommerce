import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, Save, Eye, EyeOff, RefreshCw, Loader2 } from 'lucide-react';

const BLING_AUTH_URL = 'https://www.bling.com.br/OAuth2/Auth';
const REDIRECT_URI = window.location.origin + '/configuracoes';

export default function BlingOAuthConfig() {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('cc8b8d56d863328ccef20525abc2e7649d03b4fe');
  const [clientSecret, setClientSecret] = useState('5717f3608cd49d9a3b0bfd04aa63d44812778b57c58b7958e4552672ec9f');
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState(null); // null | 'exchanging' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  const { data: tokens = [] } = useQuery({
    queryKey: ['bling-tokens'],
    queryFn: () => base44.entities.BlingToken.list('-created_date', 10),
  });

  const activeToken = tokens[0] || null;

  const saveTokenMutation = useMutation({
    mutationFn: async (data) => {
      if (activeToken) {
        return base44.entities.BlingToken.update(activeToken.id, data);
      }
      return base44.entities.BlingToken.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bling-tokens'] }),
  });

  // Captura código OAuth2 do redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'bling_oauth') {
      // Limpar URL
      window.history.replaceState({}, '', window.location.pathname);
      exchangeCode(code);
    }
  }, []);

  const exchangeCode = async (code) => {
    setStatus('exchanging');
    setStatusMsg('Trocando código por tokens...');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Faça uma requisição HTTP POST para https://www.bling.com.br/Api/v3/oauth/token com os seguintes parâmetros:
- URL: https://www.bling.com.br/Api/v3/oauth/token
- Método: POST
- Headers: Content-Type: application/x-www-form-urlencoded, Authorization: Basic ${btoa(clientId + ':' + clientSecret)}
- Body (form-urlencoded): grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}

Retorne EXATAMENTE o JSON da resposta sem modificações.`,
        response_json_schema: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            expires_in: { type: 'number' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          }
        }
      });

      if (result?.access_token) {
        const expiresAt = new Date(Date.now() + (result.expires_in || 3600) * 1000).toISOString();
        await saveTokenMutation.mutateAsync({
          account: 'principal',
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: expiresAt,
        });
        setStatus('ok');
        setStatusMsg('Conectado com sucesso ao Bling!');
      } else {
        throw new Error(result?.error_description || result?.error || 'Falha na troca de tokens');
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
    }
  };

  const handleAuthorize = () => {
    if (!clientId || !clientSecret) {
      setStatus('error');
      setStatusMsg('Informe o Client ID e o Client Secret antes de autorizar.');
      return;
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state: 'bling_oauth',
    });
    window.location.href = `${BLING_AUTH_URL}?${params.toString()}`;
  };

  const handleRefreshToken = async () => {
    if (!activeToken?.refresh_token) return;
    setStatus('exchanging');
    setStatusMsg('Renovando token...');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Faça uma requisição HTTP POST para https://www.bling.com.br/Api/v3/oauth/token com os seguintes parâmetros:
- Método: POST
- Headers: Content-Type: application/x-www-form-urlencoded, Authorization: Basic ${btoa(clientId + ':' + clientSecret)}
- Body (form-urlencoded): grant_type=refresh_token&refresh_token=${activeToken.refresh_token}

Retorne EXATAMENTE o JSON da resposta.`,
        response_json_schema: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            expires_in: { type: 'number' },
            error: { type: 'string' },
          }
        }
      });

      if (result?.access_token) {
        const expiresAt = new Date(Date.now() + (result.expires_in || 3600) * 1000).toISOString();
        await saveTokenMutation.mutateAsync({
          account: 'principal',
          access_token: result.access_token,
          refresh_token: result.refresh_token || activeToken.refresh_token,
          expires_at: expiresAt,
        });
        setStatus('ok');
        setStatusMsg('Token renovado com sucesso!');
      } else {
        throw new Error(result?.error || 'Falha ao renovar token');
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro ao renovar: ' + e.message);
    }
  };

  const isExpired = activeToken?.expires_at
    ? new Date(activeToken.expires_at) < new Date()
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">B</span>
          </div>
          Integração Bling OAuth2
          {activeToken && !isExpired && (
            <Badge className="bg-green-100 text-green-700 border-green-200 ml-auto text-xs">Conectado</Badge>
          )}
          {activeToken && isExpired && (
            <Badge variant="destructive" className="ml-auto text-xs">Token expirado</Badge>
          )}
          {!activeToken && (
            <Badge variant="secondary" className="ml-auto text-xs">Não conectado</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {(status === 'ok' || status === 'error' || status === 'exchanging') && (
          <Alert variant={status === 'error' ? 'destructive' : 'default'}
            className={status === 'ok' ? 'border-green-200 bg-green-50' : ''}>
            {status === 'exchanging' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {status === 'error' && <AlertCircle className="h-4 w-4" />}
            <AlertDescription className={status === 'ok' ? 'text-green-800' : ''}>
              {statusMsg}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">Client ID</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID do app Bling"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Client Secret</Label>
            <div className="relative mt-1">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret do app Bling"
                className="font-mono text-xs pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="font-medium mb-1">URL de Redirecionamento (configure no Bling):</p>
          <code className="break-all">{REDIRECT_URI}</code>
        </div>

        {activeToken && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            <p><strong>Conta:</strong> {activeToken.account}</p>
            <p><strong>Expira em:</strong> {activeToken.expires_at
              ? new Date(activeToken.expires_at).toLocaleString('pt-BR')
              : 'Desconhecido'}</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAuthorize} className="gap-2 bg-orange-500 hover:bg-orange-600" disabled={status === 'exchanging'}>
            <ExternalLink className="w-4 h-4" />
            {activeToken ? 'Reconectar Bling' : 'Conectar com Bling'}
          </Button>
          {activeToken && (
            <Button variant="outline" onClick={handleRefreshToken} disabled={status === 'exchanging'} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Renovar Token
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Ao clicar em "Conectar", você será redirecionado ao Bling para autorizar o acesso. Após autorizar, voltará automaticamente para esta página.
        </p>
      </CardContent>
    </Card>
  );
}