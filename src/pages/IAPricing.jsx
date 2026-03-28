import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, TrendingUp, TrendingDown, Minus, Check, X, Loader2, RefreshCw } from 'lucide-react';

export default function IAPricing() {
  const { selectedCompany } = useOutletContext();
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany, ativo: true }, '-created_date', 200);
      }
      return base44.entities.Product.filter({ ativo: true }, '-created_date', 200);
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Sale.filter({ company_id: selectedCompany, status: 'confirmada' }, '-created_date', 500);
      }
      return base44.entities.Sale.filter({ status: 'confirmada' }, '-created_date', 500);
    },
  });

  const runAnalysis = async () => {
    setAnalyzing(true);
    const productsToAnalyze = products.filter(p => p.preco_custo && p.preco_venda).slice(0, 10);

    const productSummaries = productsToAnalyze.map(p => {
      const productSales = sales.filter(s => s.items?.some(i => i.product_id === p.id));
      const margem = p.preco_custo > 0 ? ((p.preco_venda - p.preco_custo) / p.preco_venda * 100) : 0;
      return {
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco_custo: p.preco_custo,
        preco_venda: p.preco_venda,
        margem: margem.toFixed(1),
        estoque_atual: p.estoque_atual || 0,
        estoque_minimo: p.estoque_minimo || 0,
        vendas_periodo: productSales.length,
      };
    });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um analista de gestão comercial especializado em varejo brasileiro. Analise os dados dos produtos a seguir e forneça recomendações de precificação em JSON.

Dados dos produtos:
${JSON.stringify(productSummaries, null, 2)}

Para cada produto, analise: margem atual, estoque, vendas e sugira ação.`,
      response_json_schema: {
        type: "object",
        properties: {
          sugestoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                nome: { type: "string" },
                acao: { type: "string", enum: ["aumentar", "reduzir", "manter"] },
                nova_margem_sugerida: { type: "number" },
                novo_preco_sugerido: { type: "number" },
                justificativa: { type: "string" },
                urgencia: { type: "string", enum: ["alta", "media", "baixa"] },
                alerta_estoque: { type: "boolean" }
              }
            }
          }
        }
      }
    });

    setSuggestions(result.sugestoes || []);
    setAnalyzing(false);
  };

  const applyMutation = useMutation({
    mutationFn: async (suggestion) => {
      await base44.entities.Product.update(suggestion.product_id, {
        preco_venda: suggestion.novo_preco_sugerido,
        margem_padrao: suggestion.nova_margem_sugerida,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const urgenciaColors = { alta: 'destructive', media: 'secondary', baixa: 'outline' };
  const acaoIcons = { aumentar: TrendingUp, reduzir: TrendingDown, manter: Minus };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IA de Preços</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sugestões inteligentes de precificação</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" /> Analisar Produtos</>
          )}
        </Button>
      </div>

      {suggestions.length === 0 && !analyzing && (
        <Card className="p-12 text-center">
          <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Análise de Preços com IA</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Clique em "Analisar Produtos" para que a IA analise seus produtos e sugira
            ajustes de preço baseados em margem, estoque e vendas.
          </p>
          <p className="text-xs text-muted-foreground">
            Certifique-se de que seus produtos têm preço de custo e preço de venda cadastrados.
          </p>
        </Card>
      )}

      {analyzing && (
        <Card className="p-12 text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold">Analisando seus produtos...</h3>
          <p className="text-sm text-muted-foreground mt-1">A IA está avaliando margens, estoque e tendências</p>
        </Card>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-4">
          {suggestions.map((s, i) => {
            const AcaoIcon = acaoIcons[s.acao] || Minus;
            return (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <AcaoIcon className={`w-5 h-5 ${s.acao === 'aumentar' ? 'text-green-600' : s.acao === 'reduzir' ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <h3 className="font-semibold">{s.nome}</h3>
                        <Badge variant={urgenciaColors[s.urgencia]} className="text-[10px]">
                          {s.urgencia}
                        </Badge>
                        {s.alerta_estoque && (
                          <Badge variant="destructive" className="text-[10px]">Alerta Estoque</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{s.justificativa}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>Preço sugerido: <strong>R$ {(s.novo_preco_sugerido || 0).toFixed(2)}</strong></span>
                        <span>Margem: <strong>{(s.nova_margem_sugerida || 0).toFixed(1)}%</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => applyMutation.mutate(s)}
                        disabled={applyMutation.isPending}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Aplicar
                      </Button>
                      <Button size="sm" variant="outline">
                        <X className="w-3.5 h-3.5 mr-1" /> Ignorar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}