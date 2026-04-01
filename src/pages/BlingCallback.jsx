import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BlingCallback() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('Parâmetro "code" não encontrado na URL.');
      setStatus('error');
      return;
    }

    base44.functions.invoke('blingExchangeToken', { code })
      .then((res) => {
        if (res.data?.success) {
          setStatus('success');
          setTimeout(() => { window.location.href = '/configuracoes'; }, 1500);
        } else {
          setError(res.data?.error || 'Erro ao processar autenticação.');
          setStatus('error');
        }
      })
      .catch((err) => {
        setError(err.message || 'Erro inesperado.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">Autenticando...</p>
            <p className="text-muted-foreground text-sm">Conectando sua conta ao Bling</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Bling conectado com sucesso!</p>
            <p className="text-muted-foreground text-sm">Redirecionando...</p>
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