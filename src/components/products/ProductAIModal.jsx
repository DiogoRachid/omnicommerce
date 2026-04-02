import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Upload, Sparkles, CheckCircle2, Edit3, Save, ChevronRight, Image, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const MARKETPLACES = ['mercado_livre', 'shopee', 'amazon', 'magalu'];
const ML_LABEL = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu' };
const ML_MAX = { mercado_livre: 60, shopee: 120, amazon: 200, magalu: 100 };

// ── Sub-componentes de UI ─────────────────────────────────────────────────────

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
          <div className="mb-2 flex flex-wrap gap-1">
            {msg.file_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-16 w-16 object-cover rounded border" onError={e => e.target.style.display='none'} />
            ))}
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
  const [local, setLocal] = useState(value ?? '');
  const inputRef = useRef();
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const confirm = () => { onChange(local); setEditing(false); };
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      {editing ? (
        <input ref={inputRef} type={type} value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={confirm}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setLocal(value ?? ''); setEditing(false); } }}
          className="flex-1 min-w-0 text-sm border-b border-primary bg-transparent outline-none py-0.5 px-1"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors truncate group/btn">
          <span className="truncate">{value || <span className="text-muted-foreground italic">—</span>}</span>
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
  const color = len > max ? 'text-destructive' : len > max * 0.9 ? 'text-orange-500' : 'text-muted-foreground';
  useEffect(() => { setLocal(value || ''); }, [value]);
  const confirm = () => { onChange(local); setEditing(false); };
  return (
    <div>
      {editing ? (
        <div>
          <textarea value={local} onChange={e => setLocal(e.target.value)} onBlur={confirm}
            className="w-full text-sm border rounded p-2 resize-none outline-none focus:ring-1 focus:ring-primary" rows={2} />
          <div className="flex justify-between mt-0.5">
            <span className={`text-xs ${color}`}>{len}/{max}</span>
            <button onClick={confirm} className="text-xs text-primary hover:underline">OK</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="w-full text-left text-sm font-medium hover:text-primary flex items-start gap-1 group">
          <span className="flex-1">{value || <span className="text-muted-foreground italic">—</span>}</span>
          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-50 mt-0.5 shrink-0" />
        </button>
      )}
      {!editing && value && <span className={`text-xs ${(value||'').length > max ? 'text-destructive' : 'text-muted-foreground'}`}>{(value||'').length}/{max}</span>}
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

function MarketplacesSection({ mp, onEdit, marketplaceSel, onToggleMarketplace }) {
  return (
    <Section title="Anúncios por Marketplace">
      <div className="space-y-3">
        {MARKETPLACES.map(ml => (
          <div key={ml} className={`rounded-lg border p-3 transition-all ${marketplaceSel[ml] ? 'border-primary/40 bg-primary/5' : 'opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-xs uppercase tracking-wide">{ML_LABEL[ml]}</span>
              <button onClick={() => onToggleMarketplace(ml)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${marketplaceSel[ml] ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-muted'}`}>
                {marketplaceSel[ml] ? 'Ativo' : 'Inativo'}
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Título</p>
                <TitleField marketplace={ml} value={mp[ml]?.titulo}
                  onChange={v => onEdit('marketplaces', { ...mp, [ml]: { ...mp[ml], titulo: v } })} />
              </div>
              <InlineEditField label="Categoria" value={mp[ml]?.categoria}
                onChange={v => onEdit('marketplaces', { ...mp, [ml]: { ...mp[ml], categoria: v } })} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Tela de confirmação SIMPLES ───────────────────────────────────────────────
function ConfirmSimples({ product, onEdit, marketplaceSel, onToggleMarketplace }) {
  const mp = product.marketplaces || {};
  const F = ({ label, field, type, suffix }) => (
    <InlineEditField label={label} value={product[field]} onChange={v => onEdit(field, v)} type={type} suffix={suffix} />
  );
  return (
    <div className="space-y-4 text-sm">
      <Section title="Dados Gerais">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <F label="SKU" field="sku" /><F label="EAN" field="ean" />
          <F label="Nome" field="nome" /><F label="Marca" field="marca" />
          <F label="Tipo" field="tipo_produto" /><F label="NCM" field="ncm" />
          <F label="CEST" field="cest" /><F label="Unidade" field="unidade_medida" />
        </div>
      </Section>
      <Section title="Preços">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <F label="Custo" field="preco_custo" type="number" suffix="R$" />
          <F label="Margem" field="margem_padrao" type="number" suffix="%" />
          <F label="Venda" field="preco_venda" type="number" suffix="R$" />
        </div>
      </Section>
      <Section title="Dimensões">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <F label="Peso bruto" field="peso_bruto_kg" type="number" suffix="kg" />
          <F label="Peso líq." field="peso_liquido_kg" type="number" suffix="kg" />
          <F label="Altura" field="altura_cm" type="number" suffix="cm" />
          <F label="Largura" field="largura_cm" type="number" suffix="cm" />
          <F label="Compr." field="comprimento_cm" type="number" suffix="cm" />
        </div>
      </Section>
      {product.campos_especificos && Object.keys(product.campos_especificos).length > 0 && (
        <Section title={`Atributos — ${product.tipo_produto || ''}`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(product.campos_especificos).map(([k, v]) => (
              <InlineEditField key={k} label={k} value={String(v || '')}
                onChange={val => onEdit('campos_especificos', { ...product.campos_especificos, [k]: val })} />
            ))}
          </div>
        </Section>
      )}
      {product.palavras_chave?.length > 0 && (
        <Section title="Palavras-chave">
          <div className="flex flex-wrap gap-1">
            {product.palavras_chave.map((kw, i) => <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>)}
          </div>
        </Section>
      )}
      <MarketplacesSection mp={mp} onEdit={onEdit} marketplaceSel={marketplaceSel} onToggleMarketplace={onToggleMarketplace} />
    </div>
  );
}

// ── Tela de confirmação PAI COM VARIAÇÕES ─────────────────────────────────────
function ConfirmPaiVariacoes({ product, onEdit, marketplaceSel, onToggleMarketplace }) {
  const mp = product.marketplaces || {};
  const variacoes = product.variacoes || [];

  const updateVariacao = (idx, field, val) => {
    const updated = variacoes.map((v, i) => i === idx ? { ...v, [field]: val } : v);
    onEdit('variacoes', updated);
  };

  return (
    <div className="space-y-4 text-sm">
      <Section title="Produto Pai">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <InlineEditField label="SKU Pai" value={product.sku_pai} onChange={v => onEdit('sku_pai', v)} />
          <InlineEditField label="Nome" value={product.nome} onChange={v => onEdit('nome', v)} />
          <InlineEditField label="Marca" value={product.marca} onChange={v => onEdit('marca', v)} />
          <InlineEditField label="Tipo" value={product.tipo_produto} onChange={v => onEdit('tipo_produto', v)} />
          <InlineEditField label="NCM" value={product.ncm} onChange={v => onEdit('ncm', v)} />
          <InlineEditField label="CEST" value={product.cest} onChange={v => onEdit('cest', v)} />
        </div>
        <div className="mt-2">
          <InlineEditField label="Dimensões (por variação)" value={`${product.peso_bruto_kg || 0}kg | ${product.altura_cm||0}×${product.largura_cm||0}×${product.comprimento_cm||0}cm`} onChange={() => {}} />
        </div>
      </Section>

      <Section title={`Variações (${variacoes.length}) — atributos: ${(product.atributos_variacao || []).join(', ')}`}>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {variacoes.map((v, idx) => (
            <div key={idx} className="border rounded-lg p-2 bg-muted/30">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <InlineEditField label="SKU" value={v.sku} onChange={val => updateVariacao(idx, 'sku', val)} />
                {Object.entries(v.atributos || {}).map(([atrib, val]) => (
                  <InlineEditField key={atrib} label={atrib} value={val}
                    onChange={nv => updateVariacao(idx, 'atributos', { ...v.atributos, [atrib]: nv })} />
                ))}
                <InlineEditField label="Custo" value={v.preco_custo} onChange={val => updateVariacao(idx, 'preco_custo', val)} type="number" suffix="R$" />
                <InlineEditField label="Venda" value={v.preco_venda} onChange={val => updateVariacao(idx, 'preco_venda', val)} type="number" suffix="R$" />
                <InlineEditField label="Estoque" value={v.estoque_inicial} onChange={val => updateVariacao(idx, 'estoque_inicial', val)} type="number" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {product.palavras_chave?.length > 0 && (
        <Section title="Palavras-chave">
          <div className="flex flex-wrap gap-1">
            {product.palavras_chave.map((kw, i) => <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>)}
          </div>
        </Section>
      )}
      <MarketplacesSection mp={mp} onEdit={onEdit} marketplaceSel={marketplaceSel} onToggleMarketplace={onToggleMarketplace} />
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ProductAIModal({ open, onClose, selectedCompany }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('chat');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [extractedProduct, setExtractedProduct] = useState(null);
  const [marketplaceSel, setMarketplaceSel] = useState({ mercado_livre: true, shopee: true, amazon: true, magalu: true });
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    setStep('chat');
    setMessages([]);
    setExtractedProduct(null);
    setInput('');
    setInitLoading(true);
    base44.agents.createConversation({
      agent_name: 'superagente_cadastro',
      metadata: { company_id: selectedCompany },
    }).then(conv => { setConversation(conv); setInitLoading(false); })
      .catch(() => setInitLoading(false));
  }, [open, selectedCompany]);

  // Subscribe real-time
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

  // Paste de imagens (screenshot) no input
  useEffect(() => {
    if (!open) return;
    const handlePaste = async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      await uploadAndSend(file, 'Print de tela colado — analise este produto');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, conversation, sending]);

  const uploadAndSend = async (file, label) => {
    if (!conversation || sending) return;
    setSending(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: label || `Analise este produto: ${file.name}`,
        file_urls: [file_url],
      });
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !conversation || sending) return;
    const msg = input;
    setInput('');
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } finally { setSending(false); }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSend(file, `Analise este produto: ${file.name}`);
  };

  // Detecta JSON na última mensagem do agente
  const tryExtractJSON = useCallback(() => {
    const agentMsgs = messages.filter(m => m.role === 'assistant');
    if (!agentMsgs.length) return;
    const lastMsg = agentMsgs[agentMsgs.length - 1].content || '';
    const match = lastMsg.match(/```json\s*([\s\S]*?)```/);
    if (!match) return;
    try {
      const json = JSON.parse(match[1]);
      if (json.modo || json.sku || json.sku_pai || json.nome) setExtractedProduct(json);
    } catch { /* sem JSON válido */ }
  }, [messages]);

  useEffect(() => { tryExtractJSON(); }, [messages, tryExtractJSON]);

  const isTyping = sending || (messages.length > 0 && messages[messages.length - 1]?.role === 'user');
  const modo = extractedProduct?.modo || 'simples';

  // Faz download real das URLs de imagem e re-hospeda no storage
  const uploadImages = async (fotos) => {
    if (!Array.isArray(fotos) || fotos.length === 0) return [];
    try {
      const res = await base44.functions.invoke('downloadAndUploadImage', { urls: fotos });
      return res.data?.uploaded || [];
    } catch {
      return [];
    }
  };

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const handleSave = async (draft = false) => {
    if (!extractedProduct) return;
    setSaving(true);
    const companyId = selectedCompany && selectedCompany !== 'all' ? selectedCompany : undefined;

    try {
      // Faz upload real das imagens antes de salvar
      const fotosUploadadas = await uploadImages(extractedProduct.fotos);

      if (modo === 'pai_com_variacoes') {
        // Cria produto PAI
        const pai = await base44.entities.Product.create({
          sku: extractedProduct.sku_pai,
          nome: extractedProduct.nome,
          marca: extractedProduct.marca || '',
          ncm: extractedProduct.ncm || '',
          cest: extractedProduct.cest || '',
          unidade_medida: extractedProduct.unidade_medida || 'UN',
          categoria: extractedProduct.categoria || '',
          preco_custo: parseFloat(extractedProduct.preco_custo_base) || 0,
          margem_padrao: parseFloat(extractedProduct.margem_padrao) || 0,
          preco_venda: 0,
          peso_bruto_kg: parseFloat(extractedProduct.peso_bruto_kg) || 0,
          peso_liquido_kg: parseFloat(extractedProduct.peso_liquido_kg) || 0,
          altura_cm: parseFloat(extractedProduct.altura_cm) || 0,
          largura_cm: parseFloat(extractedProduct.largura_cm) || 0,
          comprimento_cm: parseFloat(extractedProduct.comprimento_cm) || 0,
          descricao: extractedProduct.descricao || '',
          fotos: fotosUploadadas,
          atributos_extras: extractedProduct.campos_especificos || {},
          tipo: 'pai',
          origem: 'manual',
          ativo: true,
          company_id: companyId,
        });

        // Cria variações
        for (const v of (extractedProduct.variacoes || [])) {
          await base44.entities.Product.create({
            sku: v.sku,
            ean: v.ean || '',
            nome: `${extractedProduct.nome} - ${Object.values(v.atributos || {}).join(' ')}`,
            marca: extractedProduct.marca || '',
            ncm: extractedProduct.ncm || '',
            cest: extractedProduct.cest || '',
            unidade_medida: extractedProduct.unidade_medida || 'UN',
            preco_custo: parseFloat(v.preco_custo) || 0,
            margem_padrao: parseFloat(extractedProduct.margem_padrao) || 0,
            preco_venda: parseFloat(v.preco_venda) || 0,
            estoque_atual: parseInt(v.estoque_inicial) || 0,
            atributos_extras: v.atributos || {},
            tipo: 'variacao',
            produto_pai_id: pai.id,
            bling_pai_id: extractedProduct.sku_pai,
            variacoes_atributos: Object.values(v.atributos || {}).join(' | '),
            origem: 'manual',
            ativo: true,
            company_id: companyId,
          });
        }

        if (!draft) {
          for (const ml of MARKETPLACES) {
            if (!marketplaceSel[ml]) continue;
            await base44.entities.MarketplaceListing.create({
              product_id: pai.id,
              product_name: extractedProduct.nome,
              marketplace: ml,
              status: 'pendente',
              preco_anuncio: parseFloat(extractedProduct.variacoes?.[0]?.preco_venda) || 0,
              company_id: companyId,
            });
          }
          tryBling(extractedProduct, companyId);
        }

      } else {
        // Simples
        const saved = await base44.entities.Product.create({
          sku: extractedProduct.sku,
          ean: extractedProduct.ean || '',
          nome: extractedProduct.nome,
          marca: extractedProduct.marca || '',
          ncm: extractedProduct.ncm || '',
          cest: extractedProduct.cest || '',
          unidade_medida: extractedProduct.unidade_medida || 'UN',
          categoria: extractedProduct.categoria || '',
          preco_custo: parseFloat(extractedProduct.preco_custo) || 0,
          margem_padrao: parseFloat(extractedProduct.margem_padrao) || 0,
          preco_venda: parseFloat(extractedProduct.preco_venda) || 0,
          peso_bruto_kg: parseFloat(extractedProduct.peso_bruto_kg) || 0,
          peso_liquido_kg: parseFloat(extractedProduct.peso_liquido_kg) || 0,
          altura_cm: parseFloat(extractedProduct.altura_cm) || 0,
          largura_cm: parseFloat(extractedProduct.largura_cm) || 0,
          comprimento_cm: parseFloat(extractedProduct.comprimento_cm) || 0,
          descricao: extractedProduct.descricao || '',
          fotos: fotosUploadadas,
          atributos_extras: extractedProduct.campos_especificos || {},
          tipo: 'simples',
          origem: 'manual',
          ativo: true,
          company_id: companyId,
        });

        if (!draft) {
          for (const ml of MARKETPLACES) {
            if (!marketplaceSel[ml]) continue;
            await base44.entities.MarketplaceListing.create({
              product_id: saved.id,
              product_name: extractedProduct.nome,
              marketplace: ml,
              status: 'pendente',
              preco_anuncio: parseFloat(extractedProduct.preco_venda) || 0,
              company_id: companyId,
            });
          }
          tryBling(extractedProduct, companyId);
        }
      }

      // Salva ProductTemplate
      if (extractedProduct.tipo_produto) {
        const existing = await base44.entities.ProductTemplate.filter({ tipo_produto: extractedProduct.tipo_produto });
        if (!existing?.length) {
          await base44.entities.ProductTemplate.create({
            tipo_produto: extractedProduct.tipo_produto,
            campos_especificos: Object.keys(extractedProduct.campos_especificos || {}).map(k => ({ chave: k, label: k, tipo: 'text', obrigatorio: false })),
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

      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(draft ? 'Rascunho salvo!' : 'Produto cadastrado com sucesso!');
      setStep('success');
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tryBling = async (product, companyId) => {
    try {
      await base44.functions.invoke('blingProxy', {
        action: 'createProduct',
        payload: {
          produto: {
            nome: product.nome,
            codigo: product.sku || product.sku_pai,
            preco: parseFloat(product.preco_venda || product.variacoes?.[0]?.preco_venda) || 0,
            precoCusto: parseFloat(product.preco_custo || product.preco_custo_base) || 0,
            unidade: product.unidade_medida || 'UN',
            situacao: 'A',
            tributacao: { ncm: product.ncm || '', cest: product.cest || '' },
          },
        },
      });
    } catch { /* Bling opcional */ }
  };

  const resetAndNew = () => {
    setStep('chat');
    setMessages([]);
    setExtractedProduct(null);
    setInput('');
    setInitLoading(true);
    base44.agents.createConversation({
      agent_name: 'superagente_cadastro',
      metadata: { company_id: selectedCompany },
    }).then(conv => { setConversation(conv); setInitLoading(false); });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Cadastrar Produto com IA
            {step === 'confirm' && <Badge variant="secondary" className="ml-2">Revisão</Badge>}
            {step === 'success' && <Badge className="ml-2 bg-green-600 text-white">Concluído</Badge>}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1.5 text-xs">
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

        {/* ── STEP: CHAT ── */}
        {step === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {initLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                  <Sparkles className="w-10 h-10 text-primary/30" />
                  <p className="text-muted-foreground text-sm font-medium">Como deseja cadastrar?</p>
                  <p className="text-muted-foreground text-xs max-w-sm">
                    Envie uma <strong>foto</strong>, um <strong>print de tela</strong> (Ctrl+V), descreva o produto, ou informe se é <strong>produto simples</strong> ou <strong>pai com variações</strong>
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap justify-center">
                    {['Produto simples', 'Pai com variações (cores, tamanhos)', 'Variações individuais'].map(s => (
                      <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                        className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
              )}
              {isTyping && !initLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">Pesquisando e analisando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t p-3 space-y-2 shrink-0">
              {extractedProduct && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="flex-1">
                    {modo === 'pai_com_variacoes'
                      ? <><strong>{extractedProduct.nome}</strong> · <strong>{extractedProduct.variacoes?.length || 0} variações</strong></>
                      : <><strong>{extractedProduct.nome || extractedProduct.sku}</strong></>
                    }
                    {extractedProduct.ean && <span className="ml-2 text-green-600">· EAN: {extractedProduct.ean}</span>}
                    {extractedProduct.categoria && <span className="ml-2 text-green-600">· {extractedProduct.categoria}</span>}
                    {Array.isArray(extractedProduct.fotos) && extractedProduct.fotos.length > 0 && (
                      <span className="ml-2 text-green-600">· {extractedProduct.fotos.length} imagens</span>
                    )}
                  </span>
                  <Button size="sm" className="ml-auto h-6 text-xs shrink-0" onClick={() => setStep('confirm')}>
                    Revisar →
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || initLoading}
                  title="Enviar foto ou print (ou cole com Ctrl+V)"
                  className="shrink-0 h-9 w-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50">
                  <Image className="w-4 h-4 text-muted-foreground" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Descreva o produto, cole um link ou pressione Ctrl+V para colar print..."
                  disabled={sending || initLoading} className="flex-1" />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending || initLoading}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                💡 Dica: Cole um print com <kbd className="bg-muted px-1 rounded text-xs">Ctrl+V</kbd> para analisar automaticamente
              </p>
            </div>
          </>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'confirm' && extractedProduct && (
          <>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {modo === 'pai_com_variacoes' ? (
                <ConfirmPaiVariacoes
                  product={extractedProduct}
                  onEdit={(f, v) => setExtractedProduct(p => ({ ...p, [f]: v }))}
                  marketplaceSel={marketplaceSel}
                  onToggleMarketplace={ml => setMarketplaceSel(p => ({ ...p, [ml]: !p[ml] }))}
                />
              ) : (
                <ConfirmSimples
                  product={extractedProduct}
                  onEdit={(f, v) => setExtractedProduct(p => ({ ...p, [f]: v }))}
                  marketplaceSel={marketplaceSel}
                  onToggleMarketplace={ml => setMarketplaceSel(p => ({ ...p, [ml]: !p[ml] }))}
                />
              )}
            </div>
            <div className="border-t p-4 flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={() => setStep('chat')}>← Voltar</Button>
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

        {/* ── STEP: SUCCESS ── */}
        {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Produto cadastrado com sucesso!</h3>
              <p className="text-muted-foreground text-sm mt-1">{extractedProduct?.nome}</p>
              {modo === 'pai_com_variacoes' && (
                <p className="text-muted-foreground text-xs mt-1">{extractedProduct?.variacoes?.length || 0} variações criadas</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">✓ Base44</Badge>
              {MARKETPLACES.filter(ml => marketplaceSel[ml]).map(ml => (
                <Badge key={ml} variant="secondary">✓ {ML_LABEL[ml]}</Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={resetAndNew}><Sparkles className="w-4 h-4 mr-1" /> Cadastrar Outro</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}