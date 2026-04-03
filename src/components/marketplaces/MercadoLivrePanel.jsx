import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ExternalLink, LogOut, Loader2, Copy, RefreshCw } from 'lucide-react';

const REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/ml-callback';
const ML_APP_ID = '510111497386242';

function getMlAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: ML_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'offline_access read write',
  });
  return `https://auth.mercadolivre.com.br/authorization?${params.toString()}`;
}

export default function MercadoLivrePanel() {
  const [status, setStatus] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [copied, setCopied] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('mlProxy', { action: 'status' });
      const st = res.data;
      setStatus(st);
      if (st?.connected) {
        const userRes = await base44.functions.invoke('mlProxy', { action: 'getUser' });
        setSeller(userRes.data);
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const handleConnect = () => {
    window.location.href = getMlAuthUrl();
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
    navigator.clipboard.writeText(REDIRECT_URI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
      </div>
    );
  }

  const isConnected = status?.connected;

  return (
    <div className="space-y-4">
      {/* Header com status */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center shrink-0">
          <span className="text-black text-[9px] font-bold">ML</span>
        </div>
        <span className="font-semibold text-base">Integração Mercado Livre (OAuth2)</span>
        <Badge className={`ml-auto text-xs ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </div>

      {msg && (
        <Alert className={msgType === 'success' ? 'border-green-200 bg-green-50' : ''}>
          {msgType === 'success'
            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
            : <AlertCircle className="h-4 w-4" />}
          <AlertDescription className={msgType === 'success' ? 'text-green-800' : ''}>{msg}</AlertDescription>
        </Alert>
      )}

      {/* Campos de informação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">App ID (ID do Aplicativo)</Label>
          <Input value={ML_APP_ID} readOnly className="mt-1 font-mono text-sm bg-muted" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Chave Secreta (Client Secret)</Label>
          <Input value="Hx4Uth2MPZ581djD8K9AxxQtNjTqLHID" readOnly className="mt-1 font-mono text-sm bg-muted" type="password" />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Link de Redirecionamento (configure no Mercado Livre Developers)</Label>
        <div className="flex gap-2 mt-1">
          <Input value={REDIRECT_URI} readOnly className="font-mono text-xs bg-muted flex-1" />
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Cole este valor no campo "URLs de redirect" no seu aplicativo do{' '}
          <a href="https://developers.mercadolivre.com.br/pt_br/aplicacoes" target="_blank" rel="noopener noreferrer" className="underline">
            Mercado Livre Developers
          </a>.
        </p>
      </div>

      {/* Status da Conexão */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Status da Conexão</p>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center shrink-0">
            <span className="text-black text-[9px] font-bold">ML</span>
          </div>
          <span className="font-semibold text-sm">Integração Mercado Livre</span>
          <Badge className={`ml-auto text-xs ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>

        {isConnected && status && (
          <p className="text-xs text-muted-foreground">
            Token expira em: {status.expires_at ? new Date(status.expires_at).toLocaleString('pt-BR') : '?'}
            {seller && <> · Vendedor: {seller.nickname || seller.first_name} (ID: {seller.id})</>}
            {seller?.email && <> · {seller.email}</>}
          </p>
        )}

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
    </div>
  );
}