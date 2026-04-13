import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, Copy, Tag, ShoppingCart, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import CategoryModal from '@/components/categories/CategoryModal';

const MP_LABELS = {
  mercado_livre: { label: 'ML', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  shopee:        { label: 'Shopee', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  amazon:        { label: 'Amazon', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  magalu:        { label: 'Magalu', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export default function Categories() {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => base44.entities.ProductCategory.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] });
      toast.success('Categoria excluída.');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (cat) => base44.entities.ProductCategory.create({
      ...cat,
      nome: cat.nome + ' (cópia)',
      id: undefined,
      created_date: undefined,
      updated_date: undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] });
      toast.success('Categoria duplicada.');
    },
  });

  const handleNew = () => {
    setEditingCategory({
      nome: '',
      icone: '📦',
      descricao: '',
      categoria_pai_id: '',
      variacoes_padrao: [],
      campos_marketplace: { mercado_livre: [], shopee: [], amazon: [], magalu: [] },
      ativo: true,
    });
    setIsNew(true);
  };

  const handleEdit = (cat) => {
    setEditingCategory({ ...cat });
    setIsNew(false);
  };

  const handleClose = () => {
    setEditingCategory(null);
    setIsNew(false);
  };

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const filtered = categories.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias de Produto</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {categories.length} categorias cadastradas
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-8"
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border overflow-hidden">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-12 border-b bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-card">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma categoria encontrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Crie sua primeira categoria para organizar os produtos</p>
          <Button className="mt-4 gap-2" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Nova Categoria
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground w-8"></th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Categoria</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Descrição</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Variações</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Marketplaces</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                <th className="border border-border px-3 py-2 text-center font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filtered.map(cat => {
                const camposMP = cat.campos_marketplace || {};
                const mpsAtivos = Object.entries(MP_LABELS).filter(([k]) => (camposMP[k]?.length || 0) > 0);
                const variacoes = cat.variacoes_padrao || [];
                const isExp = !!expanded[cat.id];

                return (
                  <React.Fragment key={cat.id}>
                    {/* Linha da categoria */}
                    <tr className={`hover:bg-accent/30 transition-colors ${!cat.ativo ? 'opacity-60' : ''}`}>
                      <td className="border border-border px-2 py-2 text-center">
                        {variacoes.length > 0 ? (
                          <button
                            onClick={() => toggleExpand(cat.id)}
                            className="p-0.5 rounded hover:bg-muted transition-colors"
                          >
                            {isExp
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </button>
                        ) : <span className="w-4 inline-block" />}
                      </td>
                      <td className="border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icone || '📦'}</span>
                          <span className="font-medium">{cat.nome}</span>
                          {cat.ml_category_id && (
                            <span className="text-[10px] font-mono text-muted-foreground">({cat.ml_category_id})</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-border px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                        {cat.descricao || '—'}
                      </td>
                      <td className="border border-border px-3 py-2 text-center">
                        <span className="text-muted-foreground">{variacoes.length}</span>
                      </td>
                      <td className="border border-border px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {mpsAtivos.length === 0 ? (
                            <span className="text-muted-foreground italic">—</span>
                          ) : (
                            mpsAtivos.map(([k, mp]) => (
                              <span key={k} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${mp.color}`}>
                                {mp.label}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="border border-border px-3 py-2">
                        <Badge variant={cat.ativo ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                          {cat.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      <td className="border border-border px-2 py-2">
                        <div className="flex gap-0.5 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cat)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateMutation.mutate(cat)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => { if (confirm(`Excluir "${cat.nome}"?`)) deleteMutation.mutate(cat.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Linhas de atributos expandidas */}
                    {isExp && variacoes.map((v, i) => (
                      <tr key={`${cat.id}-v-${i}`} className="bg-slate-50/60 hover:bg-accent/20">
                        <td className="border border-border" />
                        <td className="border border-border px-3 py-1.5 pl-8">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                            <span className="font-medium text-xs">{v.nome}</span>
                            {v.obrigatorio && (
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1">Obrig.</Badge>
                            )}
                          </div>
                        </td>
                        <td className="border border-border px-3 py-1.5 text-muted-foreground" colSpan={2}>
                          {v.tipo && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded mr-2">{v.tipo}</span>
                          )}
                          {v.opcoes?.length > 0 && (
                            <span className="text-[10px]">{v.opcoes.slice(0, 8).join(' · ')}{v.opcoes.length > 8 ? ` +${v.opcoes.length - 8}` : ''}</span>
                          )}
                        </td>
                        <td className="border border-border" colSpan={3} />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          isNew={isNew}
          categories={categories}
          onClose={handleClose}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['productCategories'] });
            handleClose();
          }}
        />
      )}
    </div>
  );
}