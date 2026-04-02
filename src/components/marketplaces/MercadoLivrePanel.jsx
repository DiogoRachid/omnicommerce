import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, Loader2, LogOut, ShoppingBag, User } from 'lucide-react';

const ML_APP_ID = import.meta.env.VITE_ML_APP_ID || '';
const REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/ml-callback';
const AUTH_URL = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

export default function MercadoLivrePanel() {
  const [status, setStatus] = useState(null); // null | { connected, valid, user_id }
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
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

  useEffect(() => { fetchStatus(); }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await base44.functions.invoke('mlProxy', { action: 'disconnect' });
      setStatus({ connected: false });
      setSeller(null);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Verificando conexão...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-lg font-bold text-black shrink-0">
          ML
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Mercado Livre</h3>
            {status?.connected ? (
              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Desconectado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Integração OAuth2 com sua conta vendedor</p>
        </div>
      </div>

      {/* Desconectado */}
      {!status?.connected && (
        <Button
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold gap-2"
          onClick={() => window.location.href = AUTH_URL}
        >
          <ShoppingBag className="w-4 h-4" />
          Conectar Mercado Livre
        </Button>
      )}

      {/* Conectado */}
      {status?.connected && (
        <div className="space-y-3">
          {seller && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{seller.nickname || seller.first_name || 'Vendedor'}</span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                ID: {seller.id} · {seller.email}
              </p>
              {seller.seller_reputation?.level_id && (
                <p className="text-xs text-muted-foreground pl-6 capitalize">
                  Reputação: {seller.seller_reputation.level_id.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => window.open(`https://www.mercadolivre.com.br/vendas`, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver meus anúncios
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Desconectar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}