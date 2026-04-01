import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bot, Send, Loader2, Wand2, RefreshCw,
  Package, ArrowRight, Layers, Tag
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  'Analise todos os produtos e identifique variações (pai/filho)',
  'Extraia atributos como cor, tamanho e voltagem das descrições',
  'Quais produtos têm informações de cor ou tamanho no nome?',
  'Mostre um resumo dos produtos que precisam ser organizados',
];

export default function ProductOrganizer() {
  const { selectedCompany } = useOutletContext();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    setInitializing(true);
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'product_organizer',
        metadata: { name: 'Organização de Produtos' },
      });
      setConversation(conv);

      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });

      // Mensagem inicial automática com contexto da empresa
      const companyContext = selectedCompany && selectedCompany !== 'all'
        ? `Olá! Vou analisar os produtos da empresa com ID: ${selectedCompany}. Por favor, use esse company_id ao filtrar os produtos.`
        : 'Olá! Vou analisar todos os produtos cadastrados no sistema.';

      await base44.agents.addMessage(conv, {
        role: 'user',
        content: companyContext + ' Me dê uma visão geral dos produtos cadastrados e identifique quais precisam de organização (detecção de variações e extração de atributos).',
      });

      return () => unsubscribe();
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading || !conversation) return;
    setInput('');
    setLoading(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = async () => {
    setMessages([]);
    setConversation(null);
    await initConversation();
  };

  const isWaiting = messages.length > 0 && messages[messages.length - 1]?.role === 'user';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Organizador de Catálogo</h1>
            <p className="text-xs text-muted-foreground">
              IA analisa descrições e organiza variações automaticamente
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={resetConversation} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Nova análise
        </Button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 flex-shrink-0">
        {[
          { icon: Layers, label: 'Detecta pai/filho', desc: 'Agrupa variações de um mesmo produto' },
          { icon: Tag, label: 'Extrai atributos', desc: 'Cor, tamanho, voltagem e mais' },
          { icon: Package, label: 'Organiza SKUs', desc: 'Estrutura hierárquica correta' },
          { icon: ArrowRight, label: 'Aplica mudanças', desc: 'Com sua confirmação' },
        ].map(({ icon: Icon, label, desc }) => (
          <Card key={label} className="border bg-card">
            <CardContent className="p-3 flex items-start gap-2">
              <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {initializing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Iniciando análise dos produtos...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {(loading || isWaiting) && (
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && !initializing && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap border-t pt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Instrua o agente (ex: aplique as mudanças sugeridas)..."
            disabled={loading || initializing}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || initializing}
            size="icon"
            className="flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'items-end flex flex-col' : ''}`}>
        {message.content && (
          <div className={`rounded-2xl px-4 py-2.5 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'}`}>
            {isUser ? (
              <p className="text-sm">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5 text-sm">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                  h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
                  code: ({ children }) => <code className="px-1 py-0.5 rounded bg-background text-xs font-mono">{children}</code>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.tool_calls?.length > 0 && (
          <div className="mt-1 space-y-1">
            {message.tool_calls.map((tc, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className={`w-1.5 h-1.5 rounded-full ${tc.status === 'completed' ? 'bg-green-400' : 'bg-orange-400 animate-pulse'}`} />
                <span>{tc.name?.split('.').reverse().join(' ')}</span>
                {tc.status === 'completed' && <Badge variant="outline" className="text-[9px] h-3 px-1">✓</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}