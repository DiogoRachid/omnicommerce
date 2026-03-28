import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Save, Search } from 'lucide-react';

export default function NewSale() {
  const navigate = useNavigate();
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    canal: 'pdv', client_name: '', forma_pagamento: 'dinheiro', desconto: 0, frete: 0,
  });
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany, ativo: true }, '-created_date', 200);
      }
      return base44.entities.Product.filter({ ativo: true }, '-created_date', 200);
    },
  });

  const filteredProducts = products.filter(p =>
    productSearch && (
      p.nome?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.ean?.includes(productSearch)
    )
  );

  const addItem = (product) => {
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      setItems(items.map(i => i.product_id === product.id
        ? { ...i, quantidade: i.quantidade + 1, total: (i.quantidade + 1) * i.preco_unitario }
        : i
      ));
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.nome,
        sku: product.sku,
        quantidade: 1,
        preco_unitario: product.preco_venda || 0,
        desconto: 0,
        total: product.preco_venda || 0,
      }]);
    }
    setProductSearch('');
  };

  const updateItem = (index, field, value) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.total = (updated.quantidade * updated.preco_unitario) - (updated.desconto || 0);
      return updated;
    }));
  };

  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - (parseFloat(form.desconto) || 0) + (parseFloat(form.frete) || 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sale = await base44.entities.Sale.create({
        canal: form.canal,
        client_name: form.client_name || 'Venda avulsa',
        forma_pagamento: form.forma_pagamento,
        subtotal,
        desconto: parseFloat(form.desconto) || 0,
        frete: parseFloat(form.frete) || 0,
        total,
        status: 'confirmada',
        items,
        company_id: selectedCompany !== 'all' ? selectedCompany : undefined,
      });

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const newStock = (product.estoque_atual || 0) - item.quantidade;
          await base44.entities.Product.update(product.id, { estoque_atual: newStock });
          await base44.entities.StockMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            tipo: 'saida_venda',
            quantidade: item.quantidade,
            custo_unitario: item.preco_unitario,
            referencia_tipo: 'venda',
            referencia_id: sale.id,
            company_id: selectedCompany !== 'all' ? selectedCompany : undefined,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      navigate('/vendas');
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendas')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Venda</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registre uma nova venda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Adicionar Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou EAN..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {filteredProducts.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted text-left border-b last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.sku} · Estoque: {p.estoque_atual || 0}</p>
                      </div>
                      <p className="text-sm font-semibold">R$ {(p.preco_venda || 0).toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {items.length > 0 && (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="w-28">Preço Unit.</TableHead>
                      <TableHead className="text-right w-24">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <p className="text-sm font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min="1" value={item.quantidade}
                            onChange={(e) => updateItem(index, 'quantidade', parseInt(e.target.value) || 1)}
                            className="h-8 w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" step="0.01" value={item.preco_unitario}
                            onChange={(e) => updateItem(index, 'preco_unitario', parseFloat(e.target.value) || 0)}
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">R$ {item.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(index)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={(v) => setForm(p => ({ ...p, canal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdv">PDV</SelectItem>
                    <SelectItem value="ecommerce">E-Commerce</SelectItem>
                    <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                    <SelectItem value="shopee">Shopee</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Nome do cliente (opcional)" />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={(v) => setForm(p => ({ ...p, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Desconto (R$)</Label>
                  <Input type="number" step="0.01" value={form.desconto} onChange={(e) => setForm(p => ({ ...p, desconto: e.target.value }))} />
                </div>
                <div>
                  <Label>Frete (R$)</Label>
                  <Input type="number" step="0.01" value={form.frete} onChange={(e) => setForm(p => ({ ...p, frete: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>- R$ {(parseFloat(form.desconto) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span>+ R$ {(parseFloat(form.frete) || 0).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => saveMutation.mutate()}
                disabled={items.length === 0 || saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Salvando...' : 'Confirmar Venda'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}