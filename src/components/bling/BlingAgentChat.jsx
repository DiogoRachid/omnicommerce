import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'bling_integration';

const QUICK_ACTIONS = [
  { label: 'Status da conexão', prompt: 'Verifique o status da conexão com o Bling e informe se está tudo ok.' },
  { label: 'Listar produtos', prompt: 'Liste os primeiros 10 produtos ativos do Bling com nome, SKU e preço.' },
  { label: 'Exportar produto', prompt: 'Como posso exportar um produto para o Bling? Explique o processo.' },
  { label: 'Verificar estoque', prompt: 'Consulte o estoque dos produtos no Bling e me mostre os 5 com menor quantidade.' },
];

export default function BlingAgentChat() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async () => {
    setIsStarting(true);
    const conv = await base44.agents.createConversation({ agent_name: AGENT_NAME });
    setConversation(conv);

    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      const last = (data.messages || []).slice(-1)[0];
      if (last?.role === 'assistant') {
        const running = (last.tool_calls || []).some(
          tc => tc.status === 'running' || tc.status === 'in_progress'
        );
        if (!running) setIsLoading(false);
      }
    });

    setIsStarting(false);
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    const msg = text.trim();
    setInput('');

    let conv = conversation;
    if (!conv) {
      setIsStarting(true);
      conv = await base44.agents.createConversation({ agent_name: AGENT_NAME });
      setConversation(conv);
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
        const last = (data.messages || []).slice(-1)[0];
        if (last?.role === 'assistant') {
          const running = (last.tool_calls || []).some(
            tc => tc.status === 'running' || tc.status === 'in_progress'
          );
          if (!running) setIsLoading(false);
        }
      });
      setIsStarting(false);
    }

    setIsLoading(true);
    await base44.agents.addMessage(conv, { role: 'user', content: msg });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          Assistente Bling
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 ml-auto text-xs">
            Superagent
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((qa) => (
            <Button
              key={qa.label}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              disabled={isLoading || isStarting}
              onClick={() => sendMessage(qa.prompt)}
            >
              {qa.label}
            </Button>
          ))}
        </div>

        {/* Chat window */}
        <div className="border rounded-lg bg-muted/20 h-72 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <MessageSquare className="w-8 h-8 opacity-40" />
              <p>Use os atalhos acima ou escreva uma mensagem para interagir com o Bling via agente.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-orange-600" />
                </div>
              )}
              {msg.content && (
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white border border-border'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              )}
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="bg-white border border-border rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte ao agente Bling..."
            disabled={isLoading || isStarting}
            className="text-sm"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || isStarting}
            size="icon"
            className="bg-orange-500 hover:bg-orange-600 shrink-0"
          >
            {isLoading || isStarting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}