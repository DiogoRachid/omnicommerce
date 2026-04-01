import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, FileText, MessageCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

export default function NFeImportAgent() {
  const navigate = useNavigate();
  const { selectedCompany } = useOutletContext();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const initConversation = async () => {
      try {
        const conv = await base44.agents.createConversation({
          agent_name: 'nfe_import',
          metadata: {
            name: 'Importação NF-e',
            company_id: selectedCompany,
          },
        });
        setConversation(conv);
      } catch (err) {
        console.error('Erro ao criar conversa:', err);
      } finally {
        setLoading(false);
      }
    };

    initConversation();
  }, [selectedCompany]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversation || sending) return;

    setSending(true);
    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: input,
      });
      setInput('');
      
      // Recarrega conversa para pegar a resposta
      const updated = await base44.agents.getConversation(conversation.id);
      setConversation(updated);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    setSending(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: `Importar nota fiscal. Arquivo XML: ${file.name}`,
        file_urls: [file_url],
      });
      
      const updated = await base44.agents.getConversation(conversation.id);
      setConversation(updated);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/notas-fiscais')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importador IA de NF-e</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Importe e categorize notas fiscais com assistência de IA</p>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Chat com Assistente</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {!conversation?.messages || conversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground mb-4">Envie um arquivo XML ou descreva o que deseja fazer</p>
            </div>
          ) : (
            conversation.messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.file_urls && msg.file_urls.length > 0 && (
                    <div className="mb-2 text-xs opacity-75">
                      📎 {msg.file_urls.length} arquivo(s) anexado(s)
                    </div>
                  )}
                  <div className="text-sm">
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <ReactMarkdown className="prose prose-sm max-w-none">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <label className="flex-1">
          <Input
            type="file"
            accept=".xml"
            onChange={handleUploadFile}
            disabled={sending}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={(e) => e.currentTarget.parentElement.querySelector('input[type=file]').click()}
            disabled={sending}
            className="w-full h-10"
          >
            📎 Anexar XML
          </Button>
        </label>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()} size="icon">
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}