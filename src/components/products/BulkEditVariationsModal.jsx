import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2, Layers, Package, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

// ── helpers ────────────────────────────────────────────────────────────────────

function getAttrs(v) {
  return (v.variacoes_atributos || '').split('|').map(s => s.trim());
}

// Retorna { cor, tamanho } a partir dos atributos
function parseCT(v) {
  const attrs = getAttrs(v);
  return { cor: attrs[0] || '', tamanho: attrs[1] || '' };
}

// Extrai listas únicas ordenadas de cores e tamanhos
function extractDimensions(variacoes) {
  const cores = [];
  const tamanhos = [];
  variacoes.forEach(v => {
    const { cor, tamanho } = parseCT(v);
    if (cor && !cores.includes(cor)) cores.push(cor);
    if (tamanho && !tamanhos.includes(tamanho)) tamanhos.push(tamanho);
  });
  return { cores, tamanhos };
}

// Monta mapa { "Cor|Tamanho": produto }
function buildMap(variacoes) {
  const map = {};
  variacoes.forEach(v => {
    const { cor, tamanho } = parseCT(v);
    map[`${cor}|${tamanho}`] = v;
  });
  return map;
}

// ── Célula editável inline ────────────────────────────────────────────────────

function EditCell({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <Input
      type={type}
      step={type === 'number' ? '0.01' : undefined}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 text-xs px-2 min-w-[80px] w-full"
    />
  );
}

// ── Painel de informações básicas do produto pai ──────────────────────────────

function BasicInfoPanel({ pai, saving, onSavePai }) {
  const [form, setForm] = useState({
    nome: pai?.nome || '',
    marca: pai?.marca || '',
    descricao: pai?.descricao || '',
    preco_custo: pai?.preco_custo || '',
    margem_padrao: pai?.margem_padrao || '',
    peso_bruto_kg: pai?.peso_bruto_kg || '',
    altura_cm: pai?.altura_cm || '',
    largura_cm: pai?.largura_cm || '',
    comprimento_cm: pai?.comprimento_cm || '',
  });

  const f = (key, label, type = 'text') => (
    <div>
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <Input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={form[key] ?? ''}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="h-8 text-sm mt-1"
        disabled={saving}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {f('nome', 'Nome do Produto')}
        {f('marca', 'Marca')}
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium">Descrição</label>
        <textarea
          className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.descricao ?? ''}
          onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {f('preco_custo', 'Custo (R$)', 'number')}
        {f('margem_padrao', 'Margem (%)', 'number')}
        {f('peso_bruto_kg', 'Peso Bruto (kg)', 'number')}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {f('altura_cm', 'Altura (cm)', 'number')}
        {f('largura_cm', 'Largura (cm)', 'number')}
        {f('comprimento_cm', 'Comprimento (cm)', 'number')}
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => onSavePai(form)} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar Produto Pai
        </Button>
      </div>
    </div>
  );
}

// ── Grade de variações estilo Shopee ─────────────────────────────────────────

function VariationsGrid({ variacoes, saving, onSaveVariations }) {
  const { cores, tamanhos } = useMemo(() => extractDimensions(variacoes), [variacoes]);
  const prodMap = useMemo(() => buildMap(variacoes), [variacoes]);

  // Estado local: { "Cor|Tamanho": { preco_venda, estoque_atual, sku, ean } }
  const [edits, setEdits] = useState(() => {
    const init = {};
    variacoes.forEach(v => {
      const { cor, tamanho } = parseCT(v);
      init[`${cor}|${tamanho}`] = {
        preco_venda: v.preco_venda ?? '',
        estoque_atual: v.estoque_atual ?? '',
        sku: v.sku ?? '',
        ean: v.ean ?? '',
      };
    });
    return init;
  });

  const setCell = (cor, tamanho, field, value) => {
    setEdits(prev => ({
      ...prev,
      [`${cor}|${tamanho}`]: { ...prev[`${cor}|${tamanho}`], [field]: value },
    }));
  };

  // Aplica preço/estoque a toda uma cor
  const applyToColor = (cor, field, value) => {
    setEdits(prev => {
      const next = { ...prev };
      tamanhos.forEach(t => {
        const key = `${cor}|${t}`;
        if (prodMap[key]) next[key] = { ...next[key], [field]: value };
      });
      return next;
    });
  };

  // Aplica preço/estoque a toda uma coluna (tamanho)
  const applyToSize = (tamanho, field, value) => {
    setEdits(prev => {
      const next = { ...prev };
      cores.forEach(c => {
        const key = `${c}|${tamanho}`;
        if (prodMap[key]) next[key] = { ...next[key], [field]: value };
      });
      return next;
    });
  };

  const handleSave = () => {
    const updates = [];
    Object.entries(edits).forEach(([key, vals]) => {
      const prod = prodMap[key];
      if (!prod) return;
      updates.push({ id: prod.id, data: {
        preco_venda: vals.preco_venda !== '' ? parseFloat(vals.preco_venda) : undefined,
        estoque_atual: vals.estoque_atual !== '' ? parseInt(vals.estoque_atual) : undefined,
        sku: vals.sku || undefined,
        ean: vals.ean || undefined,
      }});
    });
    onSaveVariations(updates);
  };

  if (cores.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhuma variação encontrada com atributos de cor/tamanho.
      </div>
    );
  }

  // Modo sem tamanho (apenas cor)
  const hasTamanho = tamanhos.length > 0 && tamanhos.some(t => t !== '');

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border px-3 py-2 text-left font-semibold min-w-[120px]">Cor</th>
              {hasTamanho && (
                <th className="border border-border px-3 py-2 text-left font-semibold min-w-[80px]">Tamanho</th>
              )}
              <th className="border border-border px-3 py-2 text-center font-semibold min-w-[110px]">Preço (R$)</th>
              <th className="border border-border px-3 py-2 text-center font-semibold min-w-[90px]">Estoque</th>
              <th className="border border-border px-3 py-2 text-center font-semibold min-w-[110px]">SKU</th>
              <th className="border border-border px-3 py-2 text-center font-semibold min-w-[120px]">EAN</th>
            </tr>
          </thead>
          <tbody>
            {cores.map(cor => {
              const rows = hasTamanho ? tamanhos : [''];
              return rows.map((tamanho, tidx) => {
                const key = `${cor}|${tamanho}`;
                const prod = prodMap[key];
                const cell = edits[key] || {};
                const isFirstRow = tidx === 0;

                return (
                  <tr key={key} className={prod ? 'hover:bg-accent/30' : 'bg-muted/30 opacity-50'}>
                    {/* Cor — só na primeira linha desse grupo */}
                    {isFirstRow && (
                      <td
                        rowSpan={hasTamanho ? tamanhos.length : 1}
                        className="border border-border px-3 py-2 align-middle"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {prod?.fotos?.[0] ? (
                            <img src={prod.fotos[0]} className="w-12 h-12 rounded object-cover border" alt={cor} />
                          ) : (
                            <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-semibold text-[11px] text-center leading-tight">{cor}</span>
                          {hasTamanho && (
                            <div className="flex flex-col gap-1 w-full mt-1">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Preço p/ todos"
                                className="h-6 text-[10px] px-1.5 rounded border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-full"
                                onChange={e => applyToColor(cor, 'preco_venda', e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Estoque p/ todos"
                                className="h-6 text-[10px] px-1.5 rounded border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-full"
                                onChange={e => applyToColor(cor, 'estoque_atual', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Tamanho */}
                    {hasTamanho && (
                      <td className="border border-border px-3 py-2 text-center font-medium">
                        {tamanho || '—'}
                        {!prod && <div className="text-[10px] text-muted-foreground">N/D</div>}
                      </td>
                    )}

                    {/* Preço */}
                    <td className="border border-border px-2 py-1.5">
                      {prod ? (
                        <EditCell
                          type="number"
                          placeholder="0,00"
                          value={cell.preco_venda}
                          onChange={v => setCell(cor, tamanho, 'preco_venda', v)}
                        />
                      ) : <span className="text-muted-foreground text-center block">—</span>}
                    </td>

                    {/* Estoque */}
                    <td className="border border-border px-2 py-1.5">
                      {prod ? (
                        <EditCell
                          type="number"
                          placeholder="0"
                          value={cell.estoque_atual}
                          onChange={v => setCell(cor, tamanho, 'estoque_atual', v)}
                        />
                      ) : <span className="text-muted-foreground text-center block">—</span>}
                    </td>

                    {/* SKU */}
                    <td className="border border-border px-2 py-1.5">
                      {prod ? (
                        <EditCell
                          placeholder="SKU"
                          value={cell.sku}
                          onChange={v => setCell(cor, tamanho, 'sku', v)}
                        />
                      ) : <span className="text-muted-foreground text-center block">—</span>}
                    </td>

                    {/* EAN */}
                    <td className="border border-border px-2 py-1.5">
                      {prod ? (
                        <EditCell
                          placeholder="EAN"
                          value={cell.ean}
                          onChange={v => setCell(cor, tamanho, 'ean', v)}
                        />
                      ) : <span className="text-muted-foreground text-center block">—</span>}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {variacoes.length} variações · {cores.length} cores{hasTamanho ? ` · ${tamanhos.length} tamanhos` : ''}
        </p>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : `Salvar ${variacoes.length} variações`}
        </Button>
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function BulkEditVariationsModal({ open, onClose, pai, variacoes }) {
  const queryClient = useQueryClient();
  const [savingPai, setSavingPai] = useState(false);
  const [savingVars, setSavingVars] = useState(false);

  const handleSavePai = async (form) => {
    setSavingPai(true);
    try {
      const data = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) {
          if (['preco_custo', 'margem_padrao', 'peso_bruto_kg', 'altura_cm', 'largura_cm', 'comprimento_cm'].includes(k)) {
            data[k] = parseFloat(v);
          } else {
            data[k] = v;
          }
        }
      });
      await base44.entities.Product.update(pai.id, data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto pai atualizado com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSavingPai(false);
  };

  const handleSaveVariations = async (updates) => {
    setSavingVars(true);
    try {
      for (const { id, data } of updates) {
        const clean = {};
        Object.entries(data).forEach(([k, v]) => { if (v !== undefined) clean[k] = v; });
        if (Object.keys(clean).length > 0) {
          await base44.entities.Product.update(id, clean);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${updates.length} variações atualizadas com sucesso!`);
    } catch (e) {
      toast.error('Erro ao salvar variações: ' + e.message);
    }
    setSavingVars(false);
  };

  if (!pai) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="w-5 h-5 text-orange-500" />
            {pai.nome}
            <Badge variant="outline" className="text-[10px] ml-1">{variacoes.length} variações</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="variacoes" className="mt-1">
          <TabsList>
            <TabsTrigger value="variacoes" className="gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Variações
            </TabsTrigger>
            <TabsTrigger value="basico" className="gap-1.5">
              <Package className="w-3.5 h-3.5" /> Informações Básicas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="variacoes" className="pt-4">
            <VariationsGrid
              variacoes={variacoes}
              saving={savingVars}
              onSaveVariations={handleSaveVariations}
            />
          </TabsContent>

          <TabsContent value="basico" className="pt-4">
            <BasicInfoPanel
              pai={pai}
              saving={savingPai}
              onSavePai={handleSavePai}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}