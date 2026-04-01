import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BlingCallback() {
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || state !== 'bling_oauth') {
      setError('Parâmetros inválidos na URL de callback.');
      setStatus('error');
      return;
    }

    const exchange = async () => {
      try {
        const res = await base44.functions.invoke('blingProxy', {
          action: 'exchange',
          payload: {
            code,
            redirect_uri: 'https://classy-omni-stock-flow.base44.app/bling-callback',
          },
        });
        if (res.data?.success) {
          setStatus('success');
          setTimeout(() => {
            window.location.href = '/configuracoes';
          }, 2000);
        } else {
          throw new Error(res.data?.error || 'Erro ao trocar o código pelos tokens.');
        }
      } catch (err) {
        setError(err.message || 'Erro inesperado.');
        setStatus('error');
      }
    };

    exchange();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Conectando ao Bling...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Bling conectado com sucesso!</p>
            <p className="text-muted-foreground text-sm">Redirecionando para Configurações...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold text-destructive">Erro na autenticação</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <a href="/configuracoes" className="text-primary underline text-sm">
              Voltar para Configurações
            </a>
          </>
        )}
      </div>
    </div>
  );
}