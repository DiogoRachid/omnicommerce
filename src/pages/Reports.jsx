import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(226,71%,40%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,65%,60%)', 'hsl(340,75%,55%)'];

export default function Reports() {
  const { selectedCompany } = useOutletContext();

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Sale.filter({ company_id: selectedCompany }, '-created_date', 500);
      }
      return base44.entities.Sale.list('-created_date', 500);
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 500);
      }
      return base44.entities.Product.list('-created_date', 500);
    },
  });

  const confirmedSales = sales.filter(s => s.status === 'confirmada');

  const salesByDay = confirmedSales.reduce((acc, s) => {
    const day = new Date(s.created_date).toLocaleDateString('pt-BR');
    acc[day] = (acc[day] || 0) + (s.total || 0);
    return acc;
  }, {});

  const salesChartData = Object.entries(salesByDay).slice(-14).map(([name, value]) => ({ name, value }));

  const salesByChannel = Object.entries(
    confirmedSales.reduce((acc, s) => {
      const label = s.canal === 'pdv' ? 'PDV' : s.canal === 'ecommerce' ? 'E-Commerce' : s.canal === 'mercado_livre' ? 'ML' : s.canal === 'shopee' ? 'Shopee' : s.canal;
      acc[label] = (acc[label] || 0) + (s.total || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const topProducts = products
    .filter(p => p.ativo)
    .sort((a, b) => (b.preco_venda || 0) * (b.estoque_atual || 0) - (a.preco_venda || 0) * (a.estoque_atual || 0))
    .slice(0, 10);

  const stockValue = products.reduce((sum, p) => sum + ((p.preco_custo || 0) * (p.estoque_atual || 0)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Análise de desempenho do negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Faturamento Total</p>
          <p className="text-2xl font-bold mt-1">
            R$ {confirmedSales.reduce((s, v) => s + (v.total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Total de Vendas</p>
          <p className="text-2xl font-bold mt-1">{confirmedSales.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Valor em Estoque</p>
          <p className="text-2xl font-bold mt-1">
            R$ {stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="vendas">
        <TabsList>
          <TabsTrigger value="vendas">Vendas por Dia</TabsTrigger>
          <TabsTrigger value="canais">Vendas por Canal</TabsTrigger>
          <TabsTrigger value="produtos">Top Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <Card>
            <CardHeader><CardTitle className="text-base">Vendas por Dia</CardTitle></CardHeader>
            <CardContent>
              {salesChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados de vendas</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `R$ ${v.toFixed(2)}`} />
                    <Bar dataKey="value" fill="hsl(226,71%,40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canais">
          <Card>
            <CardHeader><CardTitle className="text-base">Faturamento por Canal</CardTitle></CardHeader>
            <CardContent>
              {salesByChannel.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={salesByChannel} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                        {salesByChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `R$ ${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {salesByChannel.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm">{item.name}</span>
                        <span className="text-sm font-semibold ml-auto">R$ {item.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produtos">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 Produtos por Valor</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">R$ {(p.preco_venda || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Estoque: {p.estoque_atual || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}