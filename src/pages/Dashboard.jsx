import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ShoppingCart, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import StatCard from '@/components/dashboard/StatCard';

const COLORS = ['hsl(226,71%,40%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,65%,60%)'];

const statusLabels = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  cancelada: 'Cancelada',
};

const canalLabels = {
  pdv: 'PDV',
  ecommerce: 'E-Commerce',
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  b2b: 'B2B',
  outro: 'Outro',
};

export default function Dashboard() {
  const { selectedCompany } = useOutletContext();

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Sale.filter({ company_id: selectedCompany }, '-created_date', 50);
      }
      return base44.entities.Sale.list('-created_date', 50);
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 100);
      }
      return base44.entities.Product.list('-created_date', 100);
    },
  });

  const confirmedSales = sales.filter(s => s.status === 'confirmada');
  const totalRevenue = confirmedSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avgTicket = confirmedSales.length > 0 ? totalRevenue / confirmedSales.length : 0;
  const lowStock = products.filter(p =>
    p.ativo &&
    p.tipo !== 'pai' &&
    (p.estoque_minimo || 0) > 0 &&
    (p.estoque_atual || 0) <= (p.estoque_minimo || 0)
  );

  const salesByChannel = Object.entries(
    confirmedSales.reduce((acc, s) => {
      acc[s.canal] = (acc[s.canal] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: canalLabels[name] || name, value }));

  const recentSales = sales.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Vendas"
          value={confirmedSales.length}
          icon={ShoppingCart}
          iconBg="bg-chart-2/10"
        />
        <StatCard
          title="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          iconBg="bg-chart-3/10"
        />
        <StatCard
          title="Produtos Ativos"
          value={products.filter(p => p.ativo).length}
          subtitle={lowStock.length > 0 ? `${lowStock.length} com estoque baixo` : undefined}
          icon={Package}
          iconBg="bg-chart-4/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda registrada</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.client_name || 'Venda avulsa'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{canalLabels[sale.canal] || sale.canal}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {statusLabels[sale.status] || sale.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">
                      R$ {(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link to="/vendas" className="text-sm text-primary font-medium mt-3 inline-block hover:underline">
              Ver todas →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Vendas por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByChannel.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={salesByChannel} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {salesByChannel.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {salesByChannel.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-chart-3" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStock.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-destructive">{p.estoque_atual} un</p>
                    <p className="text-xs text-muted-foreground">mín: {p.estoque_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/estoque" className="text-sm text-primary font-medium mt-3 inline-block hover:underline">
              Ver estoque →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}