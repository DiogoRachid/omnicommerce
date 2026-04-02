import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Upload, Sparkles, CheckCircle2, X, Edit3, Save, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const MARKETPLACES = ['mercado_livre', 'shopee', 'amazon', 'magalu'];
const ML_LABEL = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu' };
const ML_MAX = { mercado_livre: 60, shopee: 120, amazon: 200, magalu: 100 };

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {msg.file_urls?.length > 0 && (
          <div className="mb-2 flex items-center gap-1 text-xs opacity-70">
            <Upload className="w-3 h-3" /> {msg.file_urls.length} arquivo(s) anexado(s)
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function InlineEditField({ label, value, onChange, type = 'text', suffix }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || '');
  const inputRef = useRef();

  useEffect(() => { setLocal(value || ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const confirm = () => { onChange(local); setEditing(false); };

  return (
    <div className="flex items-center gap-1 group min-w-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            ref={inputRef}
            type={type}
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={confirm}
            onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setLocal(value || ''); setEditing(false); } }}
            className="flex-1 min-w-0 text-sm border-b border-primary bg-transparent outline-none py-0.5 px-1"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors truncate group/btn"
        >
          <span className="truncate">{value || <span className="text-muted-foreground italic">Não informado</span>}</span>
          {suffix && <span className="text-muted-foreground text-xs ml-0.5">{suffix}</span>}
          <Edit3 className="w-3 h-3 opacity-0 group-hover/btn:opacity-50 shrink-0" />
        </button>
      )}
    </div>
  );
}

function TitleField({ marketplace, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || '');
  const max = ML_MAX[marketplace] || 120;
  const len = (local || '').length;
  const color = len > max ? 'text-destructive' : len > max * 0.9 ? 'text-warning' : 'text-muted-foreground';

  useEffect(() => { setLocal(value || ''); }, [value]);

  const confirm = () => { onChange(local); setEditing(false); };

  return (
    <div>
      {editing ? (
        <div>
          <textarea
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={confirm}
            className="w-full text-sm border rounded p-2 resize-none outline-none focus:ring-1 focus:ring-primary"
            rows={2}
          />
          <div className="flex justify-between items-center mt-0.5">
            <span className={`text-xs ${color}`}>{len}/{max} chars</span>
            <button onClick={confirm} className="text-xs text-primary hover:underline">Confirmar</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm font-medium hover:text-primary transition-colors flex items-start gap-1 group"
        >
          <span className="flex-1">{value || <span className="text-muted-foreground italic">Não informado</span>}</span>
          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-50 mt-0.5 shrink-0" />
        </button>
      )}
      {!editing && value && (
        <span className={`text-xs ${(value || '').length > max ? 'text-destructive' : 'text-muted-foreground'}`}>
          {(value || '').length}/{max} chars
        </span>
      )}
    </div>
  );
}

function ConfirmCard({ product, onEdit, marketplaceSel, onToggleMarketplace }) {
  const p = product;
  const mp = p.marketplaces || {};

  const Field = ({ label, field, type, suffix }) => (
    <InlineEditField label={label} value={p[field]} onChange={v => onEdit(field, v)} type={type} suffix={suffix} />
  );

  return (
    <div className="space-y-4 text-sm">
      {/* Dados Gerais */}
      <Section title="Dados Gerais">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field label="SKU" field="sku" />
          <Field label="EAN" field="ean" />
          <Field label="Nome" field="nome" />
          <Field label="Marca" field="marca" />
          <Field label="Tipo" field="tipo_produto" />
          <Field label="NCM" field="ncm" />
          <Field label="CEST" field="cest" />
          <Field label="Unidade" field="unidade_medida" />
        </div>
      </Section>

      {/* Preços */}
      <Section title="Preços">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <Field label="Custo" field="preco_custo" type="number" suffix="R$" />
          <Field label="Margem" field="margem_padrao" type="number" suffix="%" />
          <Field label="Venda" field="preco_venda" type="number" suffix="R$" />
        </div>
      </Section>

      {/* Dimensões */}
      <Section title="Dimensões e Logística">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <Field label="Peso bruto" field="peso_bruto_kg" type="number" suffix="kg" />
          <Field label="Peso líq." field="peso_liquido_kg" type="number" suffix="kg" />
          <Field label="Altura" field="altura_cm" type="number" suffix="cm" />
          <Field label="Largura" field="largura_cm" type="number" suffix="cm" />
          <Field label="Compr." field="comprimento_cm" type="number" suffix="cm" />
        </div>
      </Section>

      {/* Campos específicos */}
      {p.campos_especificos && Object.keys(p.campos_especificos).length > 0 && (
        <Section title={`Campos do Tipo: ${p.tipo_produto || ''}`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(p.campos_especificos).map(([k, v]) => (
              <InlineEditField
                key={k}
                label={k}
                value={String(v || '')}
                onChange={val => onEdit('campos_especificos', { ...p.campos_especificos, [k]: val })}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Palavras-chave */}
      {p.palavras_chave?.length > 0 && (
        <Section title="Palavras-chave">
          <div className="flex flex-wrap gap-1">
            {p.palavras_chave.map((kw, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Anúncios */}
      <Section title="Anúncios por Marketplace">
        <div className="space-y-3">
          {MARKETPLACES.map(ml => (
            <div key={ml} className={`rounded-lg border p-3 transition-all ${marketplaceSel[ml] ? 'border-primary/40 bg-primary/5' : 'opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-xs uppercase tracking-wide">{ML_LABEL[ml]}</span>
                <button
                  onClick={() => onToggleMarketplace(ml)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${marketplaceSel[ml] ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-muted'}`}
                >
                  {marketplaceSel[ml] ? 'Incluir' : 'Excluir'}
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Título</p>
                  <TitleField
                    marketplace={ml}
                    value={mp[ml]?.titulo}
                    onChange={v => onEdit('marketplaces', { ...mp, [ml]: { ...mp[ml], titulo: v } })}
                  />
                </div>
                <InlineEditField
                  label="Categoria"
                  value={mp[ml]?.categoria}
                  onChange={v => onEdit('marketplaces', { ...mp, [ml]: { ...mp[ml], categoria: v } })}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
}

export default function ProductAIModal({ open, onClose, selectedCompany }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('chat'); // 'chat' | 'confirm' | 'success'
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [extractedProduct, setExtractedProduct] = useState(null);
  const [marketplaceSel, setMarketplaceSel] = useState({ mercado_livre: true, shopee: true, amazon: true, magalu: true });
  const [saving, setSaving] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const convRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStep('chat');
    setMessages([]);
    setExtractedProduct(null);
    setCreatedProduct(null);
    setInput('');
    setInitLoading(true);

    base44.agents.createConversation({
      agent_name: 'superagente_cadastro',
      metadata: { company_id: selectedCompany },
    }).then(conv => {
      setConversation(conv);
      convRef.current = conv;
      setInitLoading(false);
    }).catch(() => setInitLoading(false));
  }, [open, selectedCompany]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content, fileUrls = []) => {
    if (!conversation || sending) return;
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content,
        ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
      });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendMessage(`Analise este produto: ${file.name}`, [file_url]);
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const isAgentTyping = sending || (messages.length > 0 && messages[messages.length - 1]?.role === 'user');

  // Tenta extrair JSON da última mensagem do agente
  const tryExtractJSON = useCallback(() => {
    const agentMsgs = messages.filter(m => m.role === 'assistant');
    if (!agentMsgs.length) return;
    const lastMsg = agentMsgs[agentMsgs.length - 1].content || '';
    const match = lastMsg.match(/```json\s*([\s\S]*?)```/) || lastMsg.match(/\{[\s\S]*"sku"[\s\S]*\}/);
    if (!match) return;
    try {
      const json = JSON.parse(match[1] || match[0]);
      if (json.sku || json.nome) {
        setExtractedProduct(json);
      }
    } catch { /* sem JSON válido */ }
  }, [messages]);

  useEffect(() => { tryExtractJSON(); }, [messages, tryExtractJSON]);

  const handleConfirmStep = () => {
    if (!extractedProduct) {
      toast.error('Nenhum dado de produto encontrado ainda. Continue conversando com o agente.');
      return;
    }
    setStep('confirm');
  };

  const handleSave = async (draft = false) => {
    if (!extractedProduct) return;
    setSaving(true);
    try {
      const companyId = selectedCompany && selectedCompany !== 'all' ? selectedCompany : undefined;

      // 1. Salva produto no Base44
      const productData = {
        sku: extractedProduct.sku,
        ean: extractedProduct.ean || '',
        nome: extractedProduct.nome,
        marca: extractedProduct.marca || '',
        ncm: extractedProduct.ncm || '',
        cest: extractedProduct.cest || '',
        unidade_medida: extractedProduct.unidade_medida || 'UN',
        preco_custo: parseFloat(extractedProduct.preco_custo) || 0,
        margem_padrao: parseFloat(extractedProduct.margem_padrao) || 0,
        preco_venda: parseFloat(extractedProduct.preco_venda) || 0,
        peso_bruto_kg: parseFloat(extractedProduct.peso_bruto_kg) || 0,
        peso_liquido_kg: parseFloat(extractedProduct.peso_liquido_kg) || 0,
        altura_cm: parseFloat(extractedProduct.altura_cm) || 0,
        largura_cm: parseFloat(extractedProduct.largura_cm) || 0,
        comprimento_cm: parseFloat(extractedProduct.comprimento_cm) || 0,
        categoria: extractedProduct.categoria || 'outros',
        descricao: extractedProduct.descricao || '',
        atributos_extras: extractedProduct.campos_especificos || {},
        origem: 'manual',
        ativo: true,
        company_id: companyId,
      };

      const savedProduct = await base44.entities.Product.create(productData);

      // 2. Salva/atualiza ProductTemplate para o tipo
      if (extractedProduct.tipo_produto) {
        const existing = await base44.entities.ProductTemplate.filter({ tipo_produto: extractedProduct.tipo_produto });
        if (!existing?.length) {
          await base44.entities.ProductTemplate.create({
            tipo_produto: extractedProduct.tipo_produto,
            campos_especificos: Object.keys(extractedProduct.campos_especificos || {}).map(k => ({
              chave: k, label: k, tipo: 'text', obrigatorio: false
            })),
            marketplaces_categorias: {
              mercado_livre: extractedProduct.marketplaces?.mercado_livre?.categoria || '',
              shopee: extractedProduct.marketplaces?.shopee?.categoria || '',
              amazon: extractedProduct.marketplaces?.amazon?.categoria || '',
              magalu: extractedProduct.marketplaces?.magalu?.categoria || '',
            },
            palavras_chave: extractedProduct.palavras_chave || [],
            criado_por_agente: true,
            company_id: companyId,
          });
        }
      }

      // 3. Cria MarketplaceListings para os marketplaces selecionados
      if (!draft) {
        for (const ml of MARKETPLACES) {
          if (!marketplaceSel[ml]) continue;
          await base44.entities.MarketplaceListing.create({
            product_id: savedProduct.id,
            product_name: extractedProduct.nome,
            marketplace: ml,
            status: 'pendente',
            preco_anuncio: parseFloat(extractedProduct.preco_venda) || 0,
            company_id: companyId,
          });
        }

        // 4. Tenta criar no Bling se integrado
        try {
          await base44.functions.invoke('blingProxy', {
            action: 'createProduct',
            payload: {
              produto: {
                nome: extractedProduct.nome,
                codigo: extractedProduct.sku,
                preco: parseFloat(extractedProduct.preco_venda) || 0,
                precoCusto: parseFloat(extractedProduct.preco_custo) || 0,
                unidade: extractedProduct.unidade_medida || 'UN',
                gtin: extractedProduct.ean || '',
                situacao: 'A',
                tributacao: {
                  ncm: extractedProduct.ncm || '',
                  cest: extractedProduct.cest || '',
                },
              },
            },
          });
        } catch (err) {
          console.warn('Bling não integrado ou erro:', err.message);
        }
      }

      setCreatedProduct(savedProduct);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(draft ? 'Rascunho salvo!' : 'Produto cadastrado com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Cadastrar Produto com IA
            {step === 'confirm' && <Badge variant="secondary" className="ml-2">Revisão</Badge>}
            {step === 'success' && <Badge className="ml-2 bg-green-600">Concluído</Badge>}
          </DialogTitle>
          {/* Steps */}
          <div className="flex items-center gap-2 mt-2 text-xs">
            {['chat', 'confirm', 'success'].map((s, i) => (
              <React.Fragment key={s}>
                <span className={`font-medium ${step === s ? 'text-primary' : 'text-muted-foreground'}`}>
                  {i + 1}. {s === 'chat' ? 'Analisar' : s === 'confirm' ? 'Revisar' : 'Concluído'}
                </span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        {/* STEP: CHAT */}
        {step === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {initLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Sparkles className="w-10 h-10 text-primary/30 mb-2" />
                  <p className="text-muted-foreground text-sm">Envie uma foto ou descreva o produto</p>
                  <p className="text-muted-foreground text-xs mt-1">O agente vai pesquisar e montar o cadastro completo automaticamente</p>
                </div>
              ) : (
                messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
              )}
              {isAgentTyping && !initLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-muted-foreground ml-1">Pesquisando e analisando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t p-3 space-y-2 shrink-0">
              {extractedProduct && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Dados do produto detectados: <strong>{extractedProduct.nome || extractedProduct.sku}</strong></span>
                  <Button size="sm" className="ml-auto h-6 text-xs" onClick={handleConfirmStep}>
                    Revisar e Salvar →
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || initLoading}
                  className="shrink-0 h-9 w-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                  title="Enviar foto"
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.xml" className="hidden" onChange={handleFile} />
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Descreva o produto ou cole um link..."
                  disabled={sending || initLoading}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending || initLoading}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && extractedProduct && (
          <>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <ConfirmCard
                product={extractedProduct}
                onEdit={(field, value) => setExtractedProduct(prev => ({ ...prev, [field]: value }))}
                marketplaceSel={marketplaceSel}
                onToggleMarketplace={ml => setMarketplaceSel(prev => ({ ...prev, [ml]: !prev[ml] }))}
              />
            </div>
            <div className="border-t p-4 flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={() => setStep('chat')}>
                ← Voltar ao Chat
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar Rascunho
                </Button>
                <Button onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Confirmar e Publicar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP: SUCCESS */}
        {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Produto cadastrado com sucesso!</h3>
              <p className="text-muted-foreground text-sm mt-1">{extractedProduct?.nome}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">✓ Base44</Badge>
              {MARKETPLACES.filter(ml => marketplaceSel[ml]).map(ml => (
                <Badge key={ml} variant="secondary">✓ {ML_LABEL[ml]}</Badge>
              ))}
              <Badge variant="secondary">✓ Bling (tentado)</Badge>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={() => {
                setStep('chat');
                setMessages([]);
                setExtractedProduct(null);
                setConversation(null);
                setInput('');
                setInitLoading(true);
                base44.agents.createConversation({
                  agent_name: 'superagente_cadastro',
                  metadata: { company_id: selectedCompany },
                }).then(conv => { setConversation(conv); setInitLoading(false); });
              }}>
                <Sparkles className="w-4 h-4 mr-1" /> Cadastrar Outro
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}