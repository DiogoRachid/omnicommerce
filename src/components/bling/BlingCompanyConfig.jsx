import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Loader2, Info } from 'lucide-react';

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_REDIRECT_URI = `https://api.base44.com/api/apps/prod/69c847515e26f8ca005176ef/functions/blingCallback`;

export default function BlingCompanyConfig({ company }) {
  const [status, setStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    // Verifica se há code de callback na URL para esta empresa
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === `bling_${company.id}`) {
      window.history.replaceState({}, document.title, window.location.pathname);
      exchangeCode(code);
    } else {
      checkStatus();
    }
  }, [company?.id]);

  const checkStatus = async () => {
    if (!company?.id) return;
    try {
      const tokens = await base44.entities.BlingToken.filter({ company_id: company.id });
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
        : `Conectado! Token válido até ${expiresAt ? expiresAt.toLocaleString('pt-BR') : '?'} (${minutesLeft} min restantes).`
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
        company_id: company.id,
      });
      if (result.data?.success) {
        setStatus('ok');
        setStatusMsg(`Bling conectado! Token válido até ${new Date(result.data.expires_at).toLocaleString('pt-BR')}.`);
        // Atualiza empresa como integrada
        await base44.entities.Company.update(company.id, { bling_integrated: true });
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
    setStatusMsg('Renovando token...');
    try {
      const result = await base44.functions.invoke('blingOAuth', {
        action: 'refresh',
        company_id: company.id,
      });
      if (result.data?.success) {
        setStatus('ok');
        setStatusMsg(`Token renovado! Válido até ${new Date(result.data.expires_at).toLocaleString('pt-BR')}.`);
      } else {
        setStatus('error');
        setStatusMsg(`Falha: ${result.data?.error}. Reconecte ao Bling.`);
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg('Erro: ' + e.message);
    }
    setLoading(false);
  };

  const handleAuthorize = () => {
    if (!company.bling_client_id) {
      setStatus('error');
      setStatusMsg('Configure o Client ID do Bling antes de conectar.');
      return;
    }
    // Conforme documentação Bling: NÃO enviar redirect_uri na URL (é configurado no cadastro do app)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: company.bling_client_id,
      state: `bling_${company.id}`,
    });
    window.location.href = `${BLING_AUTH_URL}?${params.toString()}`;
  };

  const hasCredentials = !!(company?.bling_client_id && company?.bling_client_secret);

  return (
    <div className="space-y-3">
      {!hasCredentials && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 text-xs">
            Preencha o <strong>Client ID</strong> e <strong>Client Secret</strong> do Bling acima e salve a empresa antes de conectar.
          </AlertDescription>
        </Alert>
      )}

      {status && (
        <Alert
          variant={status === 'error' ? 'destructive' : 'default'}
          className={status === 'ok' ? 'border-green-200 bg-green-50' : ''}
        >
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status === 'error' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription className={status === 'ok' ? 'text-green-800 text-xs' : 'text-xs'}>
            {statusMsg}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={checkStatus} variant="outline" size="sm" className="gap-1.5 text-xs h-7" disabled={loading || !hasCredentials}>
          <RefreshCw className="w-3 h-3" /> Verificar
        </Button>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1.5 text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50" disabled={loading || !hasCredentials}>
          {loading && status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Renovar Token
        </Button>
        <Button onClick={handleAuthorize} size="sm" className="gap-1.5 text-xs h-7 bg-orange-500 hover:bg-orange-600" disabled={loading || !hasCredentials}>
          <ExternalLink className="w-3 h-3" /> Conectar ao Bling
        </Button>
      </div>
    </div>
  );
}