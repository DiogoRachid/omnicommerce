import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, ChevronDown, Save, Loader2, Package, Layers, Palette, Hash } from 'lucide-react';
import ProductPhotos from '@/components/products/ProductPhotos';
import { toast } from 'sonner';

// Agrupa variações pelo primeiro atributo (Cor)
function groupByPrimary(variacoes) {
  const map = {};
  variacoes.forEach(v => {
    const attrs = (v.variacoes_atributos || '').split('|').map(s => s.trim());
    const key = attrs[0] || v.nome;
    if (!map[key]) map[key] = [];
    map[key].push(v);
  });
  return map;
}

// Campos editáveis com labels
const PRICE_FIELDS = [
  { key: 'preco_custo', label: 'Preço de Custo (R$)', type: 'number' },
  { key: 'margem_padrao', label: 'Margem (%)', type: 'number' },
  { key: 'preco_venda', label: 'Preço de Venda (R$)', type: 'number' },
];

const INFO_FIELDS = [
  { key: 'nome', label: 'Nome', type: 'text' },
  { key: 'marca', label: 'Marca', type: 'text' },
  { key: 'sku', label: 'SKU', type: 'text' },
  { key: 'ean', label: 'EAN', type: 'text' },
];

const DIM_FIELDS = [
  { key: 'peso_bruto_kg', label: 'Peso Bruto (kg)', type: 'number' },
  { key: 'peso_liquido_kg', label: 'Peso Líquido (kg)', type: 'number' },
  { key: 'altura_cm', label: 'Altura (cm)', type: 'number' },
  { key: 'largura_cm', label: 'Largura (cm)', type: 'number' },
  { key: 'comprimento_cm', label: 'Comprimento (cm)', type: 'number' },
];

function FieldsGrid({ fields, values, onChange, disabled }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {fields.map(f => (
        <div key={f.key}>
          <Label className="text-xs">{f.label}</Label>
          <Input
            type={f.type}
            step={f.type === 'number' ? '0.01' : undefined}
            value={values[f.key] ?? ''}
            onChange={e => onChange(f.key, e.target.value)}
            disabled={disabled}
            className="h-8 text-sm mt-1"
          />
        </div>
      ))}
    </div>
  );
}

// Painel de edição de um único produto/grupo
function EditPanel({ title, subtitle, icon: Icon, iconColor, items, onSave, saving }) {
  const firstItem = items[0] || {};
  const [form, setForm] = useState({
    nome: firstItem.nome || '',
    marca: firstItem.marca || '',
    sku: items.length === 1 ? (firstItem.sku || '') : '',
    ean: items.length === 1 ? (firstItem.ean || '') : '',
    preco_custo: firstItem.preco_custo || '',
    margem_padrao: firstItem.margem_padrao || '',
    preco_venda: firstItem.preco_venda || '',
    peso_bruto_kg: firstItem.peso_bruto_kg || '',
    peso_liquido_kg: firstItem.peso_liquido_kg || '',
    altura_cm: firstItem.altura_cm || '',
    largura_cm: firstItem.largura_cm || '',
    comprimento_cm: firstItem.comprimento_cm || '',
    fotos: firstItem.fotos || [],
  });

  const updateField = (key, value) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      if ((key === 'preco_custo' || key === 'margem_padrao') && updated.preco_custo && updated.margem_padrao) {
        const custo = parseFloat(updated.preco_custo);
        const margem = parseFloat(updated.margem_padrao);
        if (custo > 0 && margem > 0 && margem < 100) {
          updated.preco_venda = parseFloat((custo / (1 - margem / 100)).toFixed(2));
        }
      }
      return updated;
    });
  };

  const handleSave = () => {
    // Monta apenas os campos preenchidos
    const data = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) {
        if (['preco_custo', 'margem_padrao', 'preco_venda', 'peso_bruto_kg', 'peso_liquido_kg', 'altura_cm', 'largura_cm', 'comprimento_cm'].includes(k)) {
          data[k] = parseFloat(v) || undefined;
        } else {
          data[k] = v;
        }
      }
    });
    onSave(items.map(i => i.id), data);
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {items.length > 1 && (
          <Badge variant="outline" className="ml-auto text-xs">{items.length} produtos</Badge>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList className="h-7 text-xs">
          <TabsTrigger value="info" className="text-xs px-2 h-6">Informações</TabsTrigger>
          <TabsTrigger value="preco" className="text-xs px-2 h-6">Preços</TabsTrigger>
          <TabsTrigger value="dim" className="text-xs px-2 h-6">Dimensões</TabsTrigger>
          <TabsTrigger value="fotos" className="text-xs px-2 h-6">Fotos</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-3">
          {items.length > 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
              ⚠️ Campos em branco não serão alterados. SKU e EAN só podem ser editados individualmente.
            </p>
          )}
          <FieldsGrid
            fields={items.length === 1 ? INFO_FIELDS : INFO_FIELDS.filter(f => !['sku', 'ean'].includes(f.key))}
            values={form}
            onChange={updateField}
            disabled={saving}
          />
        </TabsContent>

        <TabsContent value="preco" className="pt-3">
          {items.length > 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
              ⚠️ O preço será aplicado em todos os {items.length} produtos do grupo.
            </p>
          )}
          <FieldsGrid fields={PRICE_FIELDS} values={form} onChange={updateField} disabled={saving} />
        </TabsContent>

        <TabsContent value="dim" className="pt-3">
          <FieldsGrid fields={DIM_FIELDS} values={form} onChange={updateField} disabled={saving} />
        </TabsContent>

        <TabsContent value="fotos" className="pt-3">
          {items.length > 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
              ⚠️ As fotos serão aplicadas em todos os {items.length} produtos do grupo.
            </p>
          )}
          <ProductPhotos fotos={form.fotos || []} onChange={f => setForm(prev => ({ ...prev, fotos: f }))} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : `Salvar${items.length > 1 ? ` (${items.length} produtos)` : ''}`}
        </Button>
      </div>
    </div>
  );
}

export default function BulkEditVariationsModal({ open, onClose, pai, variacoes }) {
  const queryClient = useQueryClient();
  const [savingGroup, setSavingGroup] = useState(null); // null | 'pai' | cor string | 'ind_<id>'
  const [expandedCors, setExpandedCors] = useState({});

  const grouped = useMemo(() => groupByPrimary(variacoes), [variacoes]);

  const handleSave = async (ids, data, groupKey) => {
    setSavingGroup(groupKey);
    try {
      const cleanData = {};
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') cleanData[k] = v;
      });

      for (const id of ids) {
        await base44.entities.Product.update(id, cleanData);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${ids.length > 1 ? `${ids.length} produtos atualizados` : 'Produto atualizado'} com sucesso!`);
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSavingGroup(null);
  };

  const toggleCor = (cor) => setExpandedCors(prev => ({ ...prev, [cor]: !prev[cor] }));

  if (!pai) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            Editar Variações — {pai.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Editar TODOS (produto pai inteiro) */}
          <EditPanel
            title="Editar todo o produto"
            subtitle={`Aplica em todas as ${variacoes.length} variações`}
            icon={Layers}
            iconColor="bg-orange-100 text-orange-600"
            items={variacoes}
            onSave={(ids, data) => handleSave(ids, data, 'pai')}
            saving={savingGroup === 'pai'}
          />

          {/* Por cor */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" /> Editar por Cor
            </p>
            {Object.entries(grouped).map(([cor, vars]) => (
              <div key={cor} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                  onClick={() => toggleCor(cor)}
                >
                  {expandedCors[cor] ? <ChevronDown className="w-4 h-4 text-orange-600" /> : <ChevronRight className="w-4 h-4 text-orange-600" />}
                  <span className="font-semibold text-sm text-orange-800">🎨 {cor}</span>
                  <Badge variant="outline" className="text-[10px] ml-1">{vars.length} numerações</Badge>
                </button>

                {expandedCors[cor] && (
                  <div className="p-3 space-y-3">
                    {/* Editar toda a cor */}
                    <EditPanel
                      title={`Toda a cor ${cor}`}
                      subtitle={`Aplica em todas as ${vars.length} numerações`}
                      icon={Palette}
                      iconColor="bg-orange-100 text-orange-600"
                      items={vars}
                      onSave={(ids, data) => handleSave(ids, data, `cor_${cor}`)}
                      saving={savingGroup === `cor_${cor}`}
                    />

                    {/* Editar individual */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" /> Editar Numeração Individual
                      </p>
                      {vars.map(v => {
                        const attrs = (v.variacoes_atributos || '').split('|').map(s => s.trim());
                        const numeracao = attrs.length > 1 ? attrs.filter(a => a !== cor).join(' | ') : attrs[0];
                        return (
                          <EditPanel
                            key={v.id}
                            title={numeracao || v.nome}
                            subtitle={`SKU: ${v.sku || '-'}`}
                            icon={Package}
                            iconColor="bg-slate-100 text-slate-600"
                            items={[v]}
                            onSave={(ids, data) => handleSave(ids, data, `ind_${v.id}`)}
                            saving={savingGroup === `ind_${v.id}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}