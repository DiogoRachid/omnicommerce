import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REDIRECT_URI = 'https://classy-omni-stock-flow.base44.app/ml-callback';

export default function MlCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setErrorMsg(`Autorização negada: ${error}`);
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMsg('Código de autorização não encontrado na URL.');
      setStatus('error');
      return;
    }

    base44.functions.invoke('mlProxy', { action: 'exchange', code, redirect_uri: REDIRECT_URI })
      .then((res) => {
        if (res.data?.success) {
          setStatus('success');
          setTimeout(() => navigate('/marketplaces'), 2000);
        } else {
          throw new Error(res.data?.error || 'Falha ao trocar o código');
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Erro inesperado durante a autenticação.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h2 className="text-lg font-semibold">Conectando ao Mercado Livre...</h2>
            <p className="text-muted-foreground text-sm">Aguarde enquanto validamos sua autorização.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold">Conectado com sucesso!</h2>
            <p className="text-muted-foreground text-sm">Redirecionando para Marketplaces...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold">Erro na conexão</h2>
            <p className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3 font-mono">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate('/marketplaces')}>
              Voltar para Marketplaces
            </Button>
          </>
        )}
      </div>
    </div>
  );
}