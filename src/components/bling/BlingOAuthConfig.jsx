import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Loader2, MessageSquare, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const BLING_AUTH_URL = 'https://www.bling.com.br/OAuth2/Auth';
const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = 'b72a3e2b6c6a3a51b2bcff6d1cddd97b60f1bf01d8ef8e82ec985fde66cef6a0';
const REDIRECT_URI = window.location.origin + '/configuracoes';

export default function BlingOAuthConfig() {
  const [status, setStatus] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const [showAgent, setShowAgent] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatus('loading');
    setStatusMsg('Agente renovando token...');
    setAgentMessages([]);
    setShowAgent(true);

    try {
      const tokens = await base44.entities.BlingToken.list();
      if (!tokens || tokens.length === 0) {
        setStatus('error');
        setStatusMsg('Nenhum token encontrado. Faça a autorização primeiro.');
        setRefreshing(false);
        return;
      }

      const tokenRecord = tokens[0];
      const conv = await base44.agents.createConversation({ agent_name: 'bling_integration' });

      const result = await new Promise((resolve, reject) => {
        let resolved = false;
        const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
          setAgentMessages(data.messages || []);
          const last = (data.messages || []).slice(-1)[0];
          if (last?.role === 'assistant' && last?.content && !resolved) {
            const hasRunning = (last.tool_calls || []).some(
              tc => tc.status === 'running' || tc.status === 'in_progress'
            );
            if (!hasRunning) {
              resolved = true;
              unsubscribe();
              resolve(last.content);
            }
          }
        });

        base44.agents.addMessage(conv, {
          role: 'user',
          content: `Renove o token OAuth2 do Bling.
Faça uma requisição HTTP POST para https://www.bling.com.br/Api/v3/oauth/token com:
- Header: Authorization: Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}
- Header: Content-Type: application/x-www-form-urlencoded
- Body: grant_type=refresh_token&refresh_token=${tokenRecord.refresh_token}

Se obtiver novos tokens (access_token e refresh_token), atualize o registro BlingToken (id: ${tokenRecord.id}) com os novos valores.
Informe o resultado: se foi bem-sucedido ou qual erro ocorreu.`,
        }).catch(reject);

        setTimeout(() => {
          if (!resolved) { resolved = true; unsubscribe(); reject(new Error('Timeout: agente não respondeu.')); }
        }, 120000);
      });

      // Verifica se houve sucesso lendo o token atualizado
      const updated = await base44.entities.BlingToken.list();
      const t = updated[0];
      if (t && t.access_token !== tokenRecord.access_token) {
        setStatus('ok');
        setStatusMsg('Token renovado com sucesso pelo agente!');
      } else {
        setStatus('error');
        setStatusMsg('O agente não conseguiu renovar o token. Veja o log acima ou reconecte o Bling.');
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
    }
    setRefreshing(false);
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

        {/* Chat do agente durante renovação */}
        {showAgent && agentMessages.length > 0 && (
          <div className="border rounded-lg bg-muted/20 max-h-56 overflow-y-auto p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Bot className="w-3.5 h-3.5" /> Log do agente Bling
            </p>
            {agentMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.content && (
                  <div className={`max-w-[90%] rounded-lg px-3 py-1.5 text-xs ${
                    msg.role === 'user'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-white border border-border text-foreground'
                  }`}>
                    {msg.role === 'assistant'
                      ? <ReactMarkdown className="prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{msg.content}</ReactMarkdown>
                      : <p>{msg.content}</p>
                    }
                  </div>
                )}
              </div>
            ))}
            {refreshing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Agente processando...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

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