import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Search, Edit, ToggleLeft, ToggleRight } from 'lucide-react';

export default function Products() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.Product.list('-created_date', 200);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.Product.update(id, { ativo: !ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const filtered = products.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.ean?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Link to="/notas-fiscais/importar">
            <Button variant="outline">Importar XML</Button>
          </Link>
          <Link to="/produtos/novo">
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
          </Link>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou EAN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 && !isLoading ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre um produto manualmente ou importe via XML de NF-e</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.fotos?.[0] ? (
                          <img src={p.fotos[0]} className="w-9 h-9 rounded-lg object-cover" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{p.nome}</p>
                          {p.marca && <p className="text-xs text-muted-foreground">{p.marca}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{p.sku}</TableCell>
                    <TableCell className="text-sm font-mono">{p.ean || '-'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {p.preco_custo ? `R$ ${p.preco_custo.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.estoque_atual <= (p.estoque_minimo || 0) ? 'text-destructive font-semibold' : ''}>
                        {p.estoque_atual || 0} {p.unidade_medida || 'UN'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? 'default' : 'secondary'} className="text-[10px]">
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link to={`/produtos/editar/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => toggleMutation.mutate({ id: p.id, ativo: p.ativo })}
                        >
                          {p.ativo ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}