import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BlingCallback() {
  const [status, setStatus] = useState('loading');
  const [errorData, setErrorData] = useState(null);
  const [codePreview, setCodePreview] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setErrorData({ message: 'Parâmetro "code" não encontrado na URL.' });
      setStatus('error');
      return;
    }

    setCodePreview(code.substring(0, 10));

    base44.functions.invoke('blingExchangeToken', { code })
      .then((res) => {
        if (res.data?.success) {
          setStatus('success');
          setTimeout(() => { window.location.href = '/configuracoes'; }, 1500);
        } else {
          setErrorData(res.data);
          setStatus('error');
        }
      })
      .catch((err) => {
        const detail = err.response?.data || err.message || 'Erro inesperado.';
        setErrorData(typeof detail === 'string' ? { message: detail } : detail);
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-4">

        {/* Code preview — sempre visível para debug */}
        {codePreview && (
          <div className="rounded-lg border bg-muted/40 px-4 py-2 text-xs text-muted-foreground font-mono">
            <span className="font-semibold text-foreground">code capturado:</span> {codePreview}... ({codePreview.length}+ chars)
            <span className="ml-4 font-semibold text-foreground">redirect_uri:</span> https://classy-omni-stock-flow.base44.app/bling-callback
          </div>
        )}

        <div className="text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-lg font-medium">Autenticando...</p>
              <p className="text-muted-foreground text-sm">Trocando código pelo token com o Bling. Aguarde.</p>
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
              <p className="font-semibold text-destructive text-lg">Erro na autenticação com o Bling</p>

              <div className="text-left rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Resposta completa da backend function</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap break-all overflow-auto max-h-96">
                  {JSON.stringify(errorData, null, 2)}
                </pre>
              </div>

              <a href="/configuracoes" className="inline-block mt-2 text-primary underline text-sm">
                Voltar para Configurações
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}