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
import { ArrowLeft, Save } from 'lucide-react';

const emptyProduct = {
  sku: '', ean: '', nome: '', descricao: '', marca: '',
  ncm: '', cest: '', unidade_medida: 'UN',
  peso_bruto_kg: '', peso_liquido_kg: '',
  altura_cm: '', largura_cm: '', comprimento_cm: '',
  preco_custo: '', margem_padrao: '', preco_venda: '',
  estoque_minimo: 0, estoque_maximo: '',
  origem: 'manual', ativo: true,
};

export default function ProductForm() {
  const navigate = useNavigate();
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const params = window.location.pathname.split('/');
  const productId = params[params.indexOf('editar') + 1];
  const isEditing = !!productId;

  const [form, setForm] = useState(emptyProduct);

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }),
    enabled: isEditing,
  });

  useEffect(() => {
    if (product?.[0]) {
      setForm({ ...emptyProduct, ...product[0] });
    }
  }, [product]);

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

  const handleSave = () => {
    const data = { ...form };
    if (selectedCompany && selectedCompany !== 'all') {
      data.company_id = selectedCompany;
    }
    data.preco_custo = data.preco_custo ? parseFloat(data.preco_custo) : undefined;
    data.preco_venda = data.preco_venda ? parseFloat(data.preco_venda) : undefined;
    data.margem_padrao = data.margem_padrao ? parseFloat(data.margem_padrao) : undefined;
    data.estoque_minimo = data.estoque_minimo ? parseFloat(data.estoque_minimo) : 0;
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Preencha os dados do produto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Nome do Produto *</Label>
            <Input value={form.nome} onChange={(e) => updateField('nome', e.target.value)} />
          </div>
          <div>
            <Label>SKU *</Label>
            <div className="flex gap-2">
              <Input value={form.sku} onChange={(e) => updateField('sku', e.target.value)} />
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={generateSKU} type="button">Gerar</Button>
              )}
            </div>
          </div>
          <div>
            <Label>EAN/GTIN</Label>
            <Input value={form.ean} onChange={(e) => updateField('ean', e.target.value)} placeholder="Código de barras" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Fiscais</CardTitle>
        </CardHeader>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preços e Margem</CardTitle>
        </CardHeader>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estoque</CardTitle>
        </CardHeader>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dimensões e Peso</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => navigate('/produtos')}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Produto'}
        </Button>
      </div>
    </div>
  );
}