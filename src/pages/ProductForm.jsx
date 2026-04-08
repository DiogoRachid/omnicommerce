import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, X, Layers, Store } from 'lucide-react';
import ProductPhotos from '@/components/products/ProductPhotos';
import BulkEditVariationsModal from '@/components/products/BulkEditVariationsModal';
import MarketplaceCategoryFieldsModal from '@/components/products/MarketplaceCategoryFieldsModal';
import MLCategoryFields from '@/components/products/MLCategoryFields';

const emptyProduct = {
  sku: '', ean: '', nome: '', descricao: '', marca: '',
  categoria: '',
  ncm: '', cest: '', unidade_medida: 'UN',
  peso_bruto_kg: '', peso_liquido_kg: '',
  altura_cm: '', largura_cm: '', comprimento_cm: '',
  preco_custo: '', margem_padrao: '', preco_venda: '',
  estoque_minimo: 0, estoque_maximo: '',
  origem: 'manual', ativo: true,
  fotos: [],
  atributos_extras: {},
};

export default function ProductForm() {
  const navigate = useNavigate();
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();

  const params = window.location.pathname.split('/');
  const productId = params[params.indexOf('editar') + 1];
  const isEditing = !!productId;

  const [form, setForm] = useState(emptyProduct);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [showMarketplaceFields, setShowMarketplaceFields] = useState(false);

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }),
    enabled: isEditing,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => base44.entities.ProductCategory.list('nome', 200),
  });

  // Categoria selecionada com campos ML
  const categoriaObj = categorias.find(c => c.nome === form.categoria);
  const mlFields = categoriaObj?.campos_marketplace?.mercado_livre || [];
  const hasMLFields = mlFields.filter(f => f.obrigatorio).length > 0;

  const { data: variacoes = [] } = useQuery({
    queryKey: ['variacoes', productId],
    queryFn: () => base44.entities.Product.filter({ produto_pai_id: productId }),
    enabled: isEditing && form.tipo === 'pai',
  });

  useEffect(() => {
    if (product?.[0]) {
      setForm({ ...emptyProduct, ...product[0], atributos_extras: product[0].atributos_extras || {} });
    }
  }, [product]);

  // Pré-popula fotos do pai com a primeira foto de cada variação que tiver fotos
  useEffect(() => {
    if (!isEditing || form.tipo !== 'pai' || variacoes.length === 0) return;
    const fotosVariacoes = variacoes
      .map(v => v.fotos?.[0])
      .filter(Boolean);
    if (fotosVariacoes.length === 0) return;
    setForm(prev => {
      // Mescla: fotos já existentes no pai + fotos das variações (sem duplicatas)
      const existing = prev.fotos || [];
      const merged = [...existing];
      fotosVariacoes.forEach(url => {
        if (!merged.includes(url)) merged.push(url);
      });
      // Só atualiza se houve mudança
      if (merged.length === existing.length) return prev;
      return { ...prev, fotos: merged };
    });
  }, [variacoes]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (isEditing) return base44.entities.Product.update(productId, data);
      return base44.entities.Product.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/produtos');
    },
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

  const generateSKU = () => {
    const prefix = form.nome?.substring(0, 4).toUpperCase().replace(/\s/g, '') || 'PROD';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    updateField('sku', `${prefix}-${random}`);
  };

  const addAtributo = () => {
    if (!newAttrKey.trim() || !newAttrVal.trim()) return;
    updateField('atributos_extras', { ...form.atributos_extras, [newAttrKey.trim()]: newAttrVal.trim() });
    setNewAttrKey('');
    setNewAttrVal('');
  };

  const removeAtributo = (key) => {
    const updated = { ...form.atributos_extras };
    delete updated[key];
    updateField('atributos_extras', updated);
  };

  const handleSave = () => {
    const data = { ...form };
    if (selectedCompany && selectedCompany !== 'all') data.company_id = selectedCompany;
    data.preco_custo = data.preco_custo ? parseFloat(data.preco_custo) : undefined;
    data.preco_venda = data.preco_venda ? parseFloat(data.preco_venda) : undefined;
    data.margem_padrao = data.margem_padrao ? parseFloat(data.margem_padrao) : undefined;
    data.peso_bruto_kg = data.peso_bruto_kg ? parseFloat(data.peso_bruto_kg) : undefined;
    data.peso_liquido_kg = data.peso_liquido_kg ? parseFloat(data.peso_liquido_kg) : undefined;
    data.altura_cm = data.altura_cm ? parseFloat(data.altura_cm) : undefined;
    data.largura_cm = data.largura_cm ? parseFloat(data.largura_cm) : undefined;
    data.comprimento_cm = data.comprimento_cm ? parseFloat(data.comprimento_cm) : undefined;
    data.estoque_minimo = data.estoque_minimo ? parseFloat(data.estoque_minimo) : 0;
    data.estoque_maximo = data.estoque_maximo ? parseFloat(data.estoque_maximo) : undefined;
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Preencha os dados do produto</p>
        </div>
        {isEditing && (
          <Button variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setShowMarketplaceFields(true)}>
            <Store className="w-4 h-4" />
            Categoria no Marketplace
          </Button>
        )}
        {isEditing && form.tipo === 'pai' && (
          <Button variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => setShowVariationsModal(true)}>
            <Layers className="w-4 h-4" />
            Editar Variações ({variacoes.length})
          </Button>
        )}
      </div>

      {/* Fotos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
        <CardContent>
          <ProductPhotos fotos={form.fotos || []} onChange={(f) => updateField('fotos', f)} />
        </CardContent>
      </Card>

      {/* Informações Básicas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Nome do Produto *</Label>
            <Input value={form.nome} onChange={(e) => updateField('nome', e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              SKU *
              {(form.bling_id || form.ml_id) && (
                <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                  🔒 Bloqueado — produto já exportado
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                readOnly={!!(form.bling_id || form.ml_id)}
                disabled={!!(form.bling_id || form.ml_id)}
                className={(form.bling_id || form.ml_id) ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
              />
              {!isEditing && !(form.bling_id || form.ml_id) && (
                <Button variant="outline" size="sm" onClick={generateSKU} type="button">Gerar</Button>
              )}
            </div>
            {(form.bling_id || form.ml_id) && (
              <div className="flex gap-3 mt-1">
                {form.bling_id && <span className="text-[10px] text-muted-foreground">Bling: <code className="font-mono">{form.bling_id}</code></span>}
                {form.ml_id && <span className="text-[10px] text-muted-foreground">ML: <code className="font-mono">{form.ml_id}</code></span>}
              </div>
            )}
          </div>
          <div>
            <Label>EAN/GTIN</Label>
            <Input value={form.ean} onChange={(e) => updateField('ean', e.target.value)} placeholder="Código de barras" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoria || ''} onValueChange={(v) => updateField('categoria', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
              <SelectContent>
                {categorias.filter(c => c.ativo !== false).map(c => (
                  <SelectItem key={c.id} value={c.nome}>{c.icone ? `${c.icone} ` : ''}{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={form.marca} onChange={(e) => updateField('marca', e.target.value)} />
          </div>
          <div>
            <Label>Unidade de Medida</Label>
            <Select value={form.unidade_medida} onValueChange={(v) => updateField('unidade_medida', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['UN', 'KG', 'CX', 'PC', 'LT', 'MT', 'M2', 'M3'].map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => updateField('descricao', e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Ficha Técnica ML — campos obrigatórios da categoria */}
      {categoriaObj && (
        <MLCategoryFields
          category={categoriaObj}
          values={form.marketplace_fields?.mercado_livre || {}}
          onChange={vals => updateField('marketplace_fields', { ...form.marketplace_fields, mercado_livre: vals })}
        />
      )}

      {/* Atributos Extras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atributos Extras</CardTitle>
          <p className="text-xs text-muted-foreground">Adicione campos personalizados: Cor, Tamanho, Voltagem, Material, etc.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(form.atributos_extras || {}).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(form.atributos_extras || {}).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="gap-1 pr-1">
                  <span className="text-xs">{k}: <strong>{v}</strong></span>
                  <button onClick={() => removeAtributo(k)} className="ml-1 hover:text-destructive" type="button">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Nome (ex: Cor)"
              value={newAttrKey}
              onChange={e => setNewAttrKey(e.target.value)}
              className="w-36 h-8 text-sm"
            />
            <Input
              placeholder="Valor (ex: Azul)"
              value={newAttrVal}
              onChange={e => setNewAttrVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAtributo()}
              className="w-36 h-8 text-sm"
            />
            <Button type="button" size="sm" onClick={addAtributo} className="h-8 gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dados Fiscais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Fiscais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>NCM</Label>
            <Input value={form.ncm} onChange={(e) => updateField('ncm', e.target.value)} placeholder="8 dígitos" maxLength={8} />
          </div>
          <div>
            <Label>CEST</Label>
            <Input value={form.cest} onChange={(e) => updateField('cest', e.target.value)} placeholder="7 dígitos" maxLength={7} />
          </div>
        </CardContent>
      </Card>

      {/* Preços */}
      <Card>
        <CardHeader><CardTitle className="text-base">Preços e Margem</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Preço de Custo (R$)</Label>
            <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => updateField('preco_custo', e.target.value)} />
          </div>
          <div>
            <Label>Margem (%)</Label>
            <Input type="number" step="0.1" value={form.margem_padrao} onChange={(e) => updateField('margem_padrao', e.target.value)} />
          </div>
          <div>
            <Label>Preço de Venda (R$)</Label>
            <Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => updateField('preco_venda', e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente pela margem</p>
          </div>
        </CardContent>
      </Card>

      {/* Estoque */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estoque</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Estoque Mínimo</Label>
            <Input type="number" value={form.estoque_minimo} onChange={(e) => updateField('estoque_minimo', e.target.value)} />
          </div>
          <div>
            <Label>Estoque Máximo</Label>
            <Input type="number" value={form.estoque_maximo} onChange={(e) => updateField('estoque_maximo', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Dimensões */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dimensões e Peso</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <Label>Peso Bruto (kg)</Label>
            <Input type="number" step="0.001" value={form.peso_bruto_kg} onChange={(e) => updateField('peso_bruto_kg', e.target.value)} />
          </div>
          <div>
            <Label>Peso Líquido (kg)</Label>
            <Input type="number" step="0.001" value={form.peso_liquido_kg} onChange={(e) => updateField('peso_liquido_kg', e.target.value)} />
          </div>
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" step="0.1" value={form.altura_cm} onChange={(e) => updateField('altura_cm', e.target.value)} />
          </div>
          <div>
            <Label>Largura (cm)</Label>
            <Input type="number" step="0.1" value={form.largura_cm} onChange={(e) => updateField('largura_cm', e.target.value)} />
          </div>
          <div>
            <Label>Comprimento (cm)</Label>
            <Input type="number" step="0.1" value={form.comprimento_cm} onChange={(e) => updateField('comprimento_cm', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => navigate('/produtos')}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Produto'}
        </Button>
      </div>

      {isEditing && form.tipo === 'pai' && (
        <BulkEditVariationsModal
          open={showVariationsModal}
          onClose={() => setShowVariationsModal(false)}
          pai={product?.[0] || form}
          variacoes={variacoes}
        />
      )}

      {isEditing && showMarketplaceFields && (
        <MarketplaceCategoryFieldsModal
          open={showMarketplaceFields}
          onClose={() => setShowMarketplaceFields(false)}
          product={product?.[0] || form}
        />
      )}
    </div>
  );
}