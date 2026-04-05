import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Loader2, Layers, Package, Image as ImageIcon, X, Plus, Upload, Trash2 } from 'lucide-react';
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

// Ordena tamanhos: numérico primeiro, depois texto (ex: P, M, G)
function sortTamanhos(list) {
  return [...list].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    const aNum = !isNaN(na) && String(na) === a.trim();
    const bNum = !isNaN(nb) && String(nb) === b.trim();
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
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
  return { cores, tamanhos: sortTamanhos(tamanhos) };
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

// ── TagInput: edita lista de opções como tags ─────────────────────────────────

function TagInput({ label, tags, onAdd, onRemove }) {
  const [input, setInput] = useState('');

  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const val = input.trim().toUpperCase();
      if (!tags.includes(val)) onAdd(val);
      setInput('');
    }
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-24 shrink-0 pt-1.5">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-h-[36px] rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-muted border border-border rounded px-2 py-0.5 text-xs font-medium">
            {tag}
            <button onClick={() => onRemove(tag)} className="hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite e pressione Enter..."
          className="flex-1 min-w-[120px] text-xs bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

// ── Grade de variações estilo Shopee ─────────────────────────────────────────

function VariationsGrid({ variacoes, pai, saving, onSaveVariations, onSaveAtributos }) {
  const { cores: coresInit, tamanhos: tamanhosInit } = useMemo(() => extractDimensions(variacoes), [variacoes]);

  // Tags editáveis de cor e tamanho
  const [cores, setCores] = useState(coresInit);
  const [tamanhos, setTamanhos] = useState(tamanhosInit);

  const prodMap = useMemo(() => buildMap(variacoes), [variacoes]);

  // Fotos por cor: { "Cor": ["url1", "url2"] }
  const [fotosPorCor, setFotosPorCor] = useState(() => {
    const init = {};
    variacoes.forEach(v => {
      const { cor } = parseCT(v);
      if (cor && v.fotos?.length > 0 && !init[cor]) {
        init[cor] = v.fotos;
      }
    });
    return init;
  });
  const [uploadingCor, setUploadingCor] = useState(null); // qual cor está fazendo upload
  const fileInputRef = useRef(null);
  const uploadingCorRef = useRef(null);

  const handlePhotoUpload = async (file, cor) => {
    setUploadingCor(cor);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotosPorCor(prev => ({
        ...prev,
        [cor]: [...(prev[cor] || []), file_url],
      }));
    } catch (e) {
      toast.error('Erro ao enviar foto: ' + e.message);
    }
    setUploadingCor(null);
  };

  const handleRemovePhoto = (cor, url) => {
    setFotosPorCor(prev => ({
      ...prev,
      [cor]: (prev[cor] || []).filter(u => u !== url),
    }));
  };

  // Estado local: { "Cor|Tamanho": { preco_venda, estoque_atual, sku, ean, isNew } }
  const [edits, setEdits] = useState(() => {
    const init = {};
    variacoes.forEach(v => {
      const { cor, tamanho } = parseCT(v);
      init[`${cor}|${tamanho}`] = {
        preco_venda: v.preco_venda ?? '',
        estoque_atual: v.estoque_atual ?? '',
        sku: v.sku ?? '',
        ean: v.ean ?? '',
        isNew: false,
      };
    });
    return init;
  });

  // Adiciona nova cor → cria células para todos os tamanhos atuais
  const handleAddCor = (novaCor) => {
    setCores(prev => [...prev, novaCor]);
    setEdits(prev => {
      const next = { ...prev };
      const tamList = tamanhos.length > 0 ? tamanhos : [''];
      tamList.forEach(t => {
        const key = `${novaCor}|${t}`;
        if (!next[key]) next[key] = { preco_venda: '', estoque_atual: '', sku: '', ean: '', isNew: true };
      });
      return next;
    });
  };

  // Adiciona novo tamanho → cria células para todas as cores atuais, reordena
  const handleAddTamanho = (novoTam) => {
    setTamanhos(prev => sortTamanhos([...prev, novoTam]));
    setEdits(prev => {
      const next = { ...prev };
      cores.forEach(c => {
        const key = `${c}|${novoTam}`;
        if (!next[key]) next[key] = { preco_venda: '', estoque_atual: '', sku: '', ean: '', isNew: true };
      });
      return next;
    });
  };

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
    const creates = [];
    Object.entries(edits).forEach(([key, vals]) => {
      const prod = prodMap[key];
      const [cor, tamanho] = key.split('|');
      if (prod) {
        // Variação existente → atualizar
        updates.push({ id: prod.id, data: {
          preco_venda: vals.preco_venda !== '' ? parseFloat(vals.preco_venda) : undefined,
          estoque_atual: vals.estoque_atual !== '' ? parseInt(vals.estoque_atual) : undefined,
          sku: vals.sku || undefined,
          ean: vals.ean || undefined,
          fotos: fotosPorCor[cor] || undefined,
        }});
      } else if (vals.isNew && (cores.includes(cor) && (tamanhos.includes(tamanho) || tamanho === ''))) {
        // Nova célula → criar variação
        const atributos = tamanho ? `${cor} | ${tamanho}` : cor;
        creates.push({
          nome: `${pai.nome} - ${atributos}`,
          sku: vals.sku || `${pai.sku || 'VAR'}-${cor.substring(0,2)}${tamanho}`.toUpperCase().replace(/\s/g,''),
          ean: vals.ean || '',
          preco_venda: vals.preco_venda !== '' ? parseFloat(vals.preco_venda) : 0,
          estoque_atual: vals.estoque_atual !== '' ? parseInt(vals.estoque_atual) : 0,
          tipo: 'variacao',
          produto_pai_id: pai.id,
          variacoes_atributos: atributos,
          fotos: fotosPorCor[cor] || [],
          ativo: true,
          origem: 'manual',
          marca: pai.marca || '',
          ncm: pai.ncm || '',
          cest: pai.cest || '',
          unidade_medida: pai.unidade_medida || 'UN',
          company_id: pai.company_id,
        });
      }
    });
    onSaveVariations(updates, creates);
  };

  // Modo sem tamanho (apenas cor)
  const hasTamanho = tamanhos.length > 0 && tamanhos.some(t => t !== '');

  return (
    <div className="space-y-4">
      {/* Input oculto para upload de foto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && uploadingCorRef.current) {
            handlePhotoUpload(file, uploadingCorRef.current);
            uploadingCorRef.current = null;
          }
          e.target.value = '';
        }}
      />

      {/* Painel de atributos (Cor / Tamanho) */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-0">
        <TagInput
          label="Cor"
          tags={cores}
          onAdd={handleAddCor}
          onRemove={v => setCores(p => p.filter(c => c !== v))}
        />
        <TagInput
          label="Tamanho"
          tags={tamanhos}
          onAdd={handleAddTamanho}
          onRemove={v => setTamanhos(p => sortTamanhos(p.filter(t => t !== v)))}
        />
        <p className="text-[10px] text-muted-foreground pt-2">
          💡 Edite as opções acima e clique em "Salvar variações" para aplicar. Novas combinações serão criadas automaticamente.
        </p>
      </div>

      {cores.length === 0 && tamanhos.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Adicione cores e tamanhos acima para ver a grade de variações.
        </div>
      )}
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
                  <tr key={key} className={prod ? 'hover:bg-accent/30' : cell.isNew ? 'bg-green-50/60 hover:bg-green-50' : 'bg-muted/30 opacity-50'}>
                    {/* Cor — só na primeira linha desse grupo */}
                    {isFirstRow && (
                      <td
                        rowSpan={hasTamanho ? tamanhos.length : 1}
                        className="border border-border px-3 py-2 align-top"
                      >
                        <div className="flex flex-col items-center gap-2 min-w-[110px]">
                          <span className="font-semibold text-[11px] text-center leading-tight">{cor}</span>

                          {/* Galeria de fotos da cor */}
                          <div className="flex flex-wrap gap-1 justify-center">
                            {(fotosPorCor[cor] || []).map((url, fi) => (
                              <div key={fi} className="relative group/photo">
                                <img src={url} className="w-12 h-12 rounded object-cover border" alt={`${cor} ${fi+1}`} />
                                <button
                                  onClick={() => handleRemovePhoto(cor, url)}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full items-center justify-center hidden group-hover/photo:flex"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Botão de upload */}
                          <button
                            onClick={() => {
                              uploadingCorRef.current = cor;
                              fileInputRef.current?.click();
                            }}
                            disabled={uploadingCor === cor}
                            className="flex items-center gap-1 text-[10px] text-primary border border-dashed border-primary/40 rounded px-2 py-1 hover:bg-primary/5 transition-colors disabled:opacity-50"
                          >
                            {uploadingCor === cor
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Upload className="w-3 h-3" />}
                            {(fotosPorCor[cor]?.length || 0) > 0 ? 'Add foto' : 'Foto'}
                          </button>

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
                        {!prod && cell.isNew && <div className="text-[10px] text-green-600 font-semibold">NOVO</div>}
                        {!prod && !cell.isNew && <div className="text-[10px] text-muted-foreground">N/D</div>}
                      </td>
                    )}

                    {/* Preço */}
                    <td className="border border-border px-2 py-1.5">
                      {(prod || cell.isNew) ? (
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
                      {(prod || cell.isNew) ? (
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
                      {(prod || cell.isNew) ? (
                        <EditCell
                          placeholder="SKU"
                          value={cell.sku}
                          onChange={v => setCell(cor, tamanho, 'sku', v)}
                        />
                      ) : <span className="text-muted-foreground text-center block">—</span>}
                    </td>

                    {/* EAN */}
                    <td className="border border-border px-2 py-1.5">
                      {(prod || cell.isNew) ? (
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

      {cores.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {variacoes.length} existentes · {cores.length} cores{hasTamanho ? ` · ${tamanhos.length} tamanhos` : ''}
            {Object.values(edits).filter(e => e.isNew).length > 0 && (
              <span className="ml-2 text-green-600 font-semibold">+{Object.values(edits).filter(e => e.isNew).length} novas</span>
            )}
          </p>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar variações'}
          </Button>
        </div>
      )}
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

  const handleSaveVariations = async (updates, creates = []) => {
    setSavingVars(true);
    try {
      for (const { id, data } of updates) {
        const clean = {};
        Object.entries(data).forEach(([k, v]) => { if (v !== undefined) clean[k] = v; });
        if (Object.keys(clean).length > 0) {
          await base44.entities.Product.update(id, clean);
        }
      }
      for (const data of creates) {
        await base44.entities.Product.create(data);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const msg = creates.length > 0
        ? `${updates.length} atualizadas · ${creates.length} novas criadas!`
        : `${updates.length} variações atualizadas com sucesso!`;
      toast.success(msg);
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
              pai={pai}
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