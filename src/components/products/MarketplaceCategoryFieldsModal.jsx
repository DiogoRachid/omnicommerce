import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const MARKETPLACES = [
  { key: 'mercado_livre', label: 'Mercado Livre', emoji: '🛒' },
  { key: 'shopee',        label: 'Shopee',         emoji: '🟠' },
  { key: 'amazon',        label: 'Amazon',          emoji: '📦' },
  { key: 'magalu',        label: 'Magalu',          emoji: '🔵' },
];

// Matching fuzzy: encontra categoria pelo nome do produto ou campo categoria
function findCategory(categories, product) {
  if (!product) return null;
  const catValue = (product.categoria || '').toLowerCase().trim();
  const prodNome = (product.nome || '').toLowerCase().trim();

  // 1. Match exato por id
  let found = categories.find(c => c.id === product.categoria);
  if (found) return found;

  // 2. Match exato por nome
  found = categories.find(c => c.nome?.toLowerCase().trim() === catValue);
  if (found) return found;

  // 3. Match parcial: nome da categoria contém o valor ou vice-versa
  found = categories.find(c => {
    const cn = c.nome?.toLowerCase().trim() || '';
    return cn.includes(catValue) || catValue.includes(cn.split(' ')[0]);
  });
  if (found) return found;

  // 4. Match por palavras-chave do nome do produto
  found = categories.find(c => {
    const cn = c.nome?.toLowerCase() || '';
    const words = prodNome.split(' ');
    return words.some(w => w.length > 3 && cn.includes(w));
  });
  return found || null;
}

function FieldInput({ field, value, onChange }) {
  if (field.tipo === 'lista' && field.opcoes?.length > 0) {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {field.opcoes.map(op => (
            <SelectItem key={op} value={op}>{op}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.obrigatorio ? 'Obrigatório' : 'Opcional'}
      className="h-8 text-sm"
    />
  );
}

function MarketplaceTab({ mp, fields, savedValues, onValuesChange, autoFilling }) {
  if (!fields || fields.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhum campo configurado para {mp.label} nesta categoria.
        <p className="text-xs mt-1">Configure os campos na página de Categorias.</p>
      </div>
    );
  }

  const obrigatorios = fields.filter(f => f.obrigatorio);
  const opcionais = fields.filter(f => !f.obrigatorio);
  const preenchidos = fields.filter(f => savedValues[f.id]?.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: fields.length ? `${Math.round((preenchidos / fields.length) * 100)}%` : '0%' }}
          />
        </div>
        <span>{preenchidos}/{fields.length} preenchidos</span>
      </div>

      {autoFilling && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Preenchendo automaticamente com IA...
        </div>
      )}

      {obrigatorios.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1">
            <span className="text-destructive">*</span> Obrigatórios
          </h4>
          {obrigatorios.map(field => (
            <div key={field.id} className="grid grid-cols-[140px_1fr] gap-3 items-center">
              <div>
                <label className="text-xs font-medium text-foreground">{field.nome}</label>
                <p className="text-[10px] text-muted-foreground font-mono">{field.id}</p>
              </div>
              <FieldInput
                field={field}
                value={savedValues[field.id]}
                onChange={v => onValuesChange({ ...savedValues, [field.id]: v })}
              />
            </div>
          ))}
        </div>
      )}

      {opcionais.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">Opcionais</h4>
          {opcionais.map(field => (
            <div key={field.id} className="grid grid-cols-[140px_1fr] gap-3 items-center">
              <div>
                <label className="text-xs font-medium text-foreground">{field.nome}</label>
                <p className="text-[10px] text-muted-foreground font-mono">{field.id}</p>
              </div>
              <FieldInput
                field={field}
                value={savedValues[field.id]}
                onChange={v => onValuesChange({ ...savedValues, [field.id]: v })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplaceCategoryFieldsModal({ open, onClose, product }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [activeTab, setActiveTab] = useState('mercado_livre');

  const { data: categories = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => base44.entities.ProductCategory.list('-created_date', 200),
    enabled: open,
  });

  const { data: existingFields = [] } = useQuery({
    queryKey: ['productCustomFields', product?.id],
    queryFn: () => base44.entities.ProductCustomFields.filter({ product_id: product.id }),
    enabled: open && !!product?.id,
  });

  const productCategory = findCategory(categories, product);

  useEffect(() => {
    if (!open) return;
    const init = {};
    MARKETPLACES.forEach(mp => {
      const saved = existingFields.find(f => f.marketplace === mp.key);
      init[mp.key] = saved?.campos || {};
    });
    setValues(init);
  }, [open, existingFields]);

  // ── Preencher automaticamente com IA ─────────────────────────────────────
  const handleAutoFill = async () => {
    if (!productCategory) return;
    setAutoFilling(true);

    const allFields = productCategory.campos_marketplace || {};
    const newValues = { ...values };

    try {
      for (const mp of MARKETPLACES) {
        const fields = allFields[mp.key] || [];
        if (fields.length === 0) continue;

        const fieldsList = fields.map(f => `- ${f.nome} (id: ${f.id}, tipo: ${f.tipo}${f.opcoes?.length ? `, opções: ${f.opcoes.join('/')}` : ''}${f.obrigatorio ? ', obrigatório' : ''})`).join('\n');

        const prompt = `Você é um especialista em marketplaces brasileiros.

Produto: "${product.nome}"
Marca: "${product.marca || 'não informada'}"
Categoria: "${productCategory.nome}"
Descrição: "${product.descricao || 'não informada'}"
Marketplace: ${mp.label}

Preencha os seguintes campos para anunciar este produto no ${mp.label}:
${fieldsList}

Responda APENAS com um JSON no formato: { "id_do_campo": "valor", ... }
Use valores realistas e adequados para o produto.
Para campos de lista, use exatamente uma das opções disponíveis.
Se não tiver certeza de um campo opcional, omita-o.`;

        const result = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        });

        if (result && typeof result === 'object') {
          newValues[mp.key] = { ...(newValues[mp.key] || {}), ...result };
        }
      }

      setValues(newValues);
      toast.success('Campos preenchidos automaticamente!');
    } catch (e) {
      toast.error('Erro ao preencher automaticamente: ' + e.message);
    }

    setAutoFilling(false);
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!product?.id) return;
    setSaving(true);
    try {
      for (const mp of MARKETPLACES) {
        const mpValues = values[mp.key] || {};
        const hasValues = Object.values(mpValues).some(v => v?.trim?.());
        if (!hasValues) continue;

        const existing = existingFields.find(f => f.marketplace === mp.key);
        const record = {
          product_id: product.id,
          category_id: productCategory?.id || '',
          marketplace: mp.key,
          campos: mpValues,
          preenchido_por_ia: false,
          ultima_atualizacao: new Date().toISOString().split('T')[0],
        };

        if (existing) {
          await base44.entities.ProductCustomFields.update(existing.id, record);
        } else {
          await base44.entities.ProductCustomFields.create(record);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['productCustomFields', product.id] });
      toast.success('Campos salvos com sucesso!');
      onClose();
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  const getMissingCount = (mpKey) => {
    const fields = productCategory?.campos_marketplace?.[mpKey] || [];
    const obrigatorios = fields.filter(f => f.obrigatorio);
    const filled = values[mpKey] || {};
    return obrigatorios.filter(f => !filled[f.id]?.trim?.()).length;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                🏪 Campos por Marketplace
              </DialogTitle>
              {productCategory ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Categoria: <strong>{productCategory.icone} {productCategory.nome}</strong> · {product?.nome}
                </p>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-orange-600 mt-0.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Categoria "{product?.categoria}" não encontrada. Verifique as categorias cadastradas.</span>
                </div>
              )}
            </div>
            {productCategory && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoFill}
                disabled={autoFilling}
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5 shrink-0"
              >
                {autoFilling
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
                {autoFilling ? 'Preenchendo...' : 'Preencher Automaticamente'}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 shrink-0 flex-wrap h-auto gap-1">
              {MARKETPLACES.map(mp => {
                const missing = getMissingCount(mp.key);
                const fields = productCategory?.campos_marketplace?.[mp.key] || [];
                return (
                  <TabsTrigger key={mp.key} value={mp.key} className="gap-1.5 text-xs">
                    <span>{mp.emoji}</span> {mp.label}
                    {fields.length > 0 && missing === 0 && (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    )}
                    {missing > 0 && (
                      <span className="ml-0.5 bg-destructive text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {missing}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {MARKETPLACES.map(mp => (
                <TabsContent key={mp.key} value={mp.key} className="mt-0">
                  <MarketplaceTab
                    mp={mp}
                    fields={productCategory?.campos_marketplace?.[mp.key] || []}
                    savedValues={values[mp.key] || {}}
                    onValuesChange={v => setValues(prev => ({ ...prev, [mp.key]: v }))}
                    autoFilling={autoFilling}
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !productCategory} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Campos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}