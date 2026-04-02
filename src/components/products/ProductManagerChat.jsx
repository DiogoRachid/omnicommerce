import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, Package, TrendingUp, Tag, AlertCircle, Image, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  { icon: AlertCircle, label: 'Estoque zerado', text: 'Quais produtos estão com estoque zerado?' },
  { icon: TrendingUp, label: 'Ajustar margem', text: 'Quero ajustar a margem de lucro de uma categoria' },
  { icon: Tag, label: 'Atualizar preços', text: 'Como posso atualizar preços em lote?' },
  { icon: Package, label: 'Produtos inativos', text: 'Mostre todos os produtos inativos' },
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  if (msg.role === 'tool') return null;

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
            {msg.content}
          </ReactMarkdown>
        )}
        {msg.tool_calls?.filter(t => t.status === 'completed' && t.name).map((t, i) => (
          <div key={i} className="mt-1.5 text-xs opacity-70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {t.name.replace(/_/g, ' ')}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductManagerChat({ open, onClose, selectedCompany }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Paste de imagens (Ctrl+V)
  useEffect(() => {
    if (!open) return;
    const handlePaste = async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) await addFileToQueue(file);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, conversation]);

  const addFileToQueue = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setPendingFiles(prev => [...prev, { url: file_url, name: file.name, preview }]);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) addFileToQueue(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput('');
    setPendingFiles([]);
    setInitLoading(true);
    base44.agents.createConversation({
      agent_name: 'product_manager',
      metadata: { company_id: selectedCompany },
    }).then(conv => {
      setConversation(conv);
      setInitLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }).catch(() => setInitLoading(false));
  }, [open, selectedCompany]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, data => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text) => {
    const msg = text || input;
    if ((!msg.trim() && pendingFiles.length === 0) || !conversation || sending) return;
    setInput('');
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    setSending(true);
    try {
      const payload = { role: 'user', content: msg || 'Analise esta imagem' };
      if (filesToSend.length > 0) payload.file_urls = filesToSend.map(f => f.url);
      await base44.agents.addMessage(conversation, payload);
    } finally {
      setSending(false);
    }
  };

  const isTyping = sending || (messages.length > 0 && messages[messages.length - 1]?.role === 'user');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            Assistente de Produtos
            <Badge variant="secondary" className="ml-1 text-[10px]">IA</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consulte, edite e gerencie seus produtos por chat
          </p>
        </DialogHeader>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {initLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">Como posso ajudar?</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Pergunte sobre seus produtos, faça alterações em lote ou defina padrões de cadastro
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map(s => (
                  <button key={s.label} onClick={() => handleSend(s.text)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left hover:bg-muted transition-colors text-xs">
                    <s.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
          )}

          {isTyping && messages.length > 0 && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3 shrink-0 space-y-2">
          {/* Preview de arquivos pendentes */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative group">
                  {f.preview ? (
                    <img src={f.preview} alt="" className="h-14 w-14 object-cover rounded-lg border" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground text-center px-1 overflow-hidden">
                      {f.name}
                    </div>
                  )}
                  <button
                    onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || initLoading || uploading}
              title="Enviar imagem ou arquivo (ou cole com Ctrl+V)"
              className="shrink-0 h-9 w-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Image className="w-4 h-4 text-muted-foreground" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.xlsx,.csv" className="hidden" onChange={handleFileInput} />
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ex: quais produtos estão com estoque baixo? (Ctrl+V para colar print)"
              disabled={sending || initLoading}
              className="flex-1"
            />
            <Button size="icon" onClick={() => handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || sending || initLoading || uploading}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}