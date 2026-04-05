import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Edit, Save, Loader2, CheckCircle2, AlertCircle, Tag } from 'lucide-react';

// ── Campos por marketplace ────────────────────────────────────────────────────
const MP_FIELDS = {
  bling: [
    { key: 'id', label: 'ID Bling', readOnly: true },
    { key: 'situacao', label: 'Situação', type: 'select', options: ['A', 'I'], optionLabels: { A: 'Ativo', I: 'Inativo' } },
    { key: 'categoria', label: 'Categoria Bling' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'ncm', label: 'NCM' },
    { key: 'origem', label: 'Origem Fiscal' },
  ],
  mercado_livre: [
    { key: 'item_id', label: 'ID do Anúncio', readOnly: true },
    { key: 'titulo', label: 'Título do Anúncio' },
    { key: 'category_id', label: 'ID da Categoria ML' },
    { key: 'category_name', label: 'Nome da Categoria ML', readOnly: true },
    { key: 'listing_type_id', label: 'Tipo de Anúncio', type: 'select', options: ['gold_special', 'gold_pro', 'free'], optionLabels: { gold_special: 'Clássico', gold_pro: 'Premium', free: 'Grátis' } },
    { key: 'condition', label: 'Condição', type: 'select', options: ['new', 'used'], optionLabels: { new: 'Novo', used: 'Usado' } },
    { key: 'preco_anuncio', label: 'Preço no ML', type: 'number' },
    { key: 'status', label: 'Status', readOnly: true },
    { key: 'url', label: 'URL do Anúncio', readOnly: true },
  ],
  shopee: [
    { key: 'item_id', label: 'ID do Produto Shopee', readOnly: true },
    { key: 'nome_shopee', label: 'Nome no Shopee' },
    { key: 'category_id', label: 'ID da Categoria Shopee' },
    { key: 'preco_shopee', label: 'Preço na Shopee', type: 'number' },
    { key: 'status', label: 'Status', readOnly: true },
  ],
  amazon: [
    { key: 'asin', label: 'ASIN', readOnly: true },
    { key: 'seller_sku', label: 'Seller SKU' },
    { key: 'title', label: 'Título na Amazon' },
    { key: 'category', label: 'Categoria Amazon' },
    { key: 'preco_amazon', label: 'Preço na Amazon', type: 'number' },
    { key: 'status', label: 'Status', readOnly: true },
  ],
  magalu: [
    { key: 'sku_magalu', label: 'SKU Magalu', readOnly: true },
    { key: 'titulo_magalu', label: 'Título no Magalu' },
    { key: 'category_id', label: 'ID da Categoria Magalu' },
    { key: 'preco_magalu', label: 'Preço no Magalu', type: 'number' },
    { key: 'status', label: 'Status', readOnly: true },
  ],
};

const MP_LABELS = {
  bling: 'Bling',
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  magalu: 'Magalu',
};

const MP_COLORS = {
  bling: 'bg-orange-500',
  mercado_livre: 'bg-yellow-400',
  shopee: 'bg-orange-500',
  amazon: 'bg-amber-900',
  magalu: 'bg-blue-600',
};

const MP_TEXT = {
  bling: 'text-white',
  mercado_livre: 'text-black',
  shopee: 'text-white',
  amazon: 'text-white',
  magalu: 'text-white',
};

// ── Componente de edição de campos de um produto ──────────────────────────────
function FieldEditor({ product, marketplace, onClose, onSave }) {
  const fields = MP_FIELDS[marketplace] || [];
  const existing = product.marketplace_fields?.[marketplace] || {};
  const [form, setForm] = useState({ ...existing });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await base44.entities.Product.update(product.id, {
        marketplace_fields: {
          ...(product.marketplace_fields || {}),
          [marketplace]: form,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['products-mf'] });
      setMsg({ type: 'success', text: 'Campos salvos com sucesso!' });
      setTimeout(() => { onSave(); onClose(); }, 1000);
    } catch (e) {
      setMsg({ type: 'error', text: 'Erro ao salvar: ' + e.message });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className={`w-5 h-5 rounded ${MP_COLORS[marketplace]} flex items-center justify-center shrink-0`}>
              <span className={`text-[7px] font-bold ${MP_TEXT[marketplace]}`}>{MP_LABELS[marketplace].slice(0, 2).toUpperCase()}</span>
            </div>
            Campos {MP_LABELS[marketplace]} — {product.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {msg && (
            <Alert className={msg.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              <AlertDescription className={msg.type === 'success' ? 'text-green-800' : 'text-red-800'}>{msg.text}</AlertDescription>
            </Alert>
          )}

          {fields.map(f => (
            <div key={f.key}>
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              {f.readOnly ? (
                <div className="mt-1 h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-xs text-muted-foreground">
                  {form[f.key] || <span className="opacity-40">—</span>}
                </div>
              ) : f.type === 'select' ? (
                <Select value={form[f.key] || ''} onValueChange={v => setForm(prev => ({ ...prev, [f.key]: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => (
                      <SelectItem key={o} value={o}>{f.optionLabels?.[o] || o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1"
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tabela por marketplace ────────────────────────────────────────────────────
function MarketplaceTable({ products, marketplace, onEdit }) {
  const fields = MP_FIELDS[marketplace] || [];
  const [search, setSearch] = useState('');

  const filtered = products.filter(p =>
    !search ||
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  // Só mostra produtos que têm algum campo preenchido OU todos
  const hasFields = (p) => {
    const mf = p.marketplace_fields?.[marketplace];
    return mf && Object.values(mf).some(v => v);
  };

  const withFields = filtered.filter(hasFields);
  const withoutFields = filtered.filter(p => !hasFields(p));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline" className="text-xs self-center">
          {withFields.length} com campos · {withoutFields.length} sem campos
        </Badge>
      </div>

      <div className="rounded-lg border overflow-x-auto shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">Produto</th>
              <th className="border border-border px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">SKU</th>
              {fields.map(f => (
                <th key={f.key} className="border border-border px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              <th className="border border-border px-2 py-1.5 text-center font-semibold text-muted-foreground">Editar</th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={fields.length + 3} className="border border-border px-4 py-8 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {filtered.map(p => {
              const mf = p.marketplace_fields?.[marketplace] || {};
              const filled = hasFields(p);
              return (
                <tr key={p.id} className={`hover:bg-accent/30 transition-colors ${!filled ? 'opacity-60' : ''}`}>
                  <td className="border border-border px-2 py-1.5 font-medium max-w-[180px] truncate">{p.nome}</td>
                  <td className="border border-border px-2 py-1.5 font-mono text-muted-foreground">{p.sku || '-'}</td>
                  {fields.map(f => (
                    <td key={f.key} className="border border-border px-2 py-1.5 max-w-[140px] truncate">
                      {f.type === 'select'
                        ? f.optionLabels?.[mf[f.key]] || mf[f.key] || <span className="text-muted-foreground">—</span>
                        : mf[f.key] || <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  ))}
                  <td className="border border-border px-2 py-1.5 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 gap-1"
                      onClick={() => onEdit(p, marketplace)}
                    >
                      <Edit className="w-3 h-3" /> Editar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
          {filtered.length} produto(s)
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function MarketplaceFields() {
  const [editTarget, setEditTarget] = useState(null); // { product, marketplace }
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-mf'],
    queryFn: () => base44.entities.Product.list('-created_date', 5000),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
  });

  // Descobre quais marketplaces estão ativos em alguma empresa
  const activeMps = ['bling', 'mercado_livre', 'shopee', 'amazon', 'magalu'].filter(mp => {
    if (mp === 'bling') return companies.some(c => c.bling_integrated);
    return companies.some(c => c.marketplaces_config?.[mp]?.enabled);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6" /> Campos de Marketplace
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Edite e mapeie os campos específicos de cada marketplace para os seus produtos.
          Esses campos são preenchidos automaticamente na importação e podem ser ajustados aqui.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue={activeMps[0] || 'bling'}>
          <TabsList className="flex-wrap h-auto gap-1">
            {activeMps.map(mp => (
              <TabsTrigger key={mp} value={mp} className="gap-1.5 text-xs">
                <div className={`w-3.5 h-3.5 rounded ${MP_COLORS[mp]} flex items-center justify-center shrink-0`}>
                  <span className={`text-[6px] font-bold ${MP_TEXT[mp]}`}>
                    {MP_LABELS[mp].slice(0, 2).toUpperCase()}
                  </span>
                </div>
                {MP_LABELS[mp]}
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                  {products.filter(p => {
                    const mf = p.marketplace_fields?.[mp];
                    return mf && Object.values(mf).some(v => v);
                  }).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {activeMps.map(mp => (
            <TabsContent key={mp} value={mp} className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${MP_COLORS[mp]} flex items-center justify-center shrink-0`}>
                      <span className={`text-[7px] font-bold ${MP_TEXT[mp]}`}>
                        {MP_LABELS[mp].slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    Campos {MP_LABELS[mp]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MarketplaceTable
                    products={products}
                    marketplace={mp}
                    onEdit={(product, marketplace) => setEditTarget({ product, marketplace })}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {activeMps.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Nenhum marketplace ativo. Configure em <strong>Empresas</strong>.
            </div>
          )}
        </Tabs>
      )}

      {editTarget && (
        <FieldEditor
          product={editTarget.product}
          marketplace={editTarget.marketplace}
          onClose={() => setEditTarget(null)}
          onSave={() => queryClient.invalidateQueries({ queryKey: ['products-mf'] })}
        />
      )}
    </div>
  );
}
