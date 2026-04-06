import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Copy, Tag } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias de Produto</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie categorias, variações padrão e campos por marketplace
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-xl border bg-card p-4 h-36 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-card">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma categoria cadastrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Crie sua primeira categoria para organizar os produtos</p>
          <Button className="mt-4 gap-2" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Nova Categoria
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const camposMP = cat.campos_marketplace || {};
            const mpsAtivos = Object.entries(MP_LABELS).filter(([k]) => (camposMP[k]?.length || 0) > 0);
            const numVariacoes = (cat.variacoes_padrao || []).length;

            return (
              <div key={cat.id} className={`rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow ${!cat.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icone || '📦'}</span>
                    <div>
                      <h3 className="font-semibold text-sm leading-tight">{cat.nome}</h3>
                      {cat.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{cat.descricao}</p>
                      )}
                    </div>
                  </div>
                  {!cat.ativo && <Badge variant="secondary" className="text-[10px] shrink-0">Inativa</Badge>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {numVariacoes} variação{numVariacoes !== 1 ? 'ões' : ''}
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  {mpsAtivos.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Sem campos de marketplace</span>
                  ) : (
                    mpsAtivos.map(([k, mp]) => (
                      <span key={k} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${mp.color}`}>
                        {mp.label}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex gap-1 mt-auto pt-1 border-t border-border">
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs flex-1" onClick={() => handleEdit(cat)}>
                    <Edit className="w-3 h-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => duplicateMutation.mutate(cat)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1 h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Excluir categoria "${cat.nome}"?`)) deleteMutation.mutate(cat.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
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