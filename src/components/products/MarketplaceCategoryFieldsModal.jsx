import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const MARKETPLACES = [
  { key: 'mercado_livre', label: 'Mercado Livre', emoji: '🛒', color: 'text-yellow-700' },
  { key: 'shopee',        label: 'Shopee',         emoji: '🟠', color: 'text-orange-700' },
  { key: 'amazon',        label: 'Amazon',          emoji: '📦', color: 'text-blue-700' },
  { key: 'magalu',        label: 'Magalu',          emoji: '🔵', color: 'text-purple-700' },
];

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

function MarketplaceTab({ mp, fields, savedValues, onValuesChange }) {
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
      {/* Progresso */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.round((preenchidos / fields.length) * 100)}%` }}
          />
        </div>
        <span>{preenchidos}/{fields.length} preenchidos</span>
      </div>

      {/* Campos obrigatórios */}
      {obrigatorios.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1">
            <span className="text-destructive">*</span> Obrigatórios
          </h4>
          {obrigatorios.map(field => (
            <div key={field.id} className="grid grid-cols-[130px_1fr] gap-3 items-center">
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

      {/* Campos opcionais */}
      {opcionais.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">Opcionais</h4>
          {opcionais.map(field => (
            <div key={field.id} className="grid grid-cols-[130px_1fr] gap-3 items-center">
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
  const [values, setValues] = useState({}); // { mp_key: { field_id: value } }
  const [saving, setSaving] = useState(false);

  // Busca a categoria selecionada do produto
  const { data: categories = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => base44.entities.ProductCategory.list('-created_date', 200),
    enabled: open,
  });

  // Busca campos já salvos deste produto
  const { data: existingFields = [] } = useQuery({
    queryKey: ['productCustomFields', product?.id],
    queryFn: () => base44.entities.ProductCustomFields.filter({ product_id: product.id }),
    enabled: open && !!product?.id,
  });

  // Encontra a categoria do produto pelo nome/slug
  const productCategory = categories.find(c =>
    c.nome?.toLowerCase() === product?.categoria?.toLowerCase() ||
    c.id === product?.categoria
  );

  // Inicializa valores com dados já salvos
  useEffect(() => {
    if (!open) return;
    const init = {};
    MARKETPLACES.forEach(mp => {
      const saved = existingFields.find(f => f.marketplace === mp.key);
      init[mp.key] = saved?.campos || {};
    });
    setValues(init);
  }, [open, existingFields]);

  const handleSave = async () => {
    if (!product?.id) return;
    setSaving(true);
    try {
      for (const mp of MARKETPLACES) {
        const mpValues = values[mp.key] || {};
        const hasValues = Object.values(mpValues).some(v => v?.trim());
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

  // Conta campos obrigatórios faltando por marketplace
  const getMissingCount = (mpKey) => {
    const mpCategory = productCategory?.campos_marketplace?.[mpKey] || [];
    const obrigatorios = mpCategory.filter(f => f.obrigatorio);
    const filled = values[mpKey] || {};
    return obrigatorios.filter(f => !filled[f.id]?.trim()).length;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            🏪 Campos por Marketplace
          </DialogTitle>
          {productCategory ? (
            <p className="text-sm text-muted-foreground">
              Categoria: <strong>{productCategory.icone} {productCategory.nome}</strong> · {product?.nome}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-orange-600">
              <AlertCircle className="w-4 h-4" />
              Nenhuma categoria configurada encontrada para "{product?.categoria}".
              Selecione uma categoria válida no produto.
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="mercado_livre" className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 shrink-0 flex-wrap h-auto gap-1">
              {MARKETPLACES.map(mp => {
                const missing = getMissingCount(mp.key);
                const fields = productCategory?.campos_marketplace?.[mp.key] || [];
                return (
                  <TabsTrigger key={mp.key} value={mp.key} className="gap-1.5 text-xs relative">
                    <span>{mp.emoji}</span> {mp.label}
                    {fields.length > 0 && missing === 0 && (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    )}
                    {missing > 0 && (
                      <span className="ml-1 bg-destructive text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
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