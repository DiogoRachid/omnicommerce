import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, AlertCircle } from 'lucide-react';

// Renderiza os campos obrigatórios do Mercado Livre para o formulário de produto

export default function MLCategoryFields({ category, values = {}, onChange }) {
  if (!category) return null;

  const camposML = category?.campos_marketplace?.mercado_livre || [];
  const required = camposML.filter(c => c.obrigatorio);

  if (required.length === 0) {
    if (!category.ml_category_id) return null;
    return (
      <Card className="border-yellow-200 bg-yellow-50/40">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
            <ShoppingCart className="w-4 h-4" />
            Ficha Técnica ML — {category.ml_category_id}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">Nenhum campo obrigatório configurado para esta categoria.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/40">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
          <ShoppingCart className="w-4 h-4" />
          Ficha Técnica — Mercado Livre
          {category.ml_category_id && (
            <Badge variant="outline" className="text-[10px] border-yellow-300 text-yellow-700">
              {category.ml_category_id}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {required.length} campo{required.length !== 1 ? 's' : ''} obrigatório{required.length !== 1 ? 's' : ''} para publicação no Mercado Livre
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {required.map(campo => (
            <div key={campo.id}>
              <label className="text-xs font-medium text-foreground flex items-center gap-1 mb-1">
                {campo.nome}
                <span className="text-destructive text-[10px]">*</span>
                {campo.hint && (
                  <span className="text-[10px] text-muted-foreground font-normal">— {campo.hint}</span>
                )}
              </label>

              {campo.tipo === 'lista' && campo.opcoes?.length > 0 ? (
                <Select
                  value={values[campo.id] || ''}
                  onValueChange={v => onChange({ ...values, [campo.id]: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campo.opcoes.map(op => (
                      <SelectItem key={op} value={op}>{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : campo.tipo === 'boolean' ? (
                <Select
                  value={values[campo.id] || ''}
                  onValueChange={v => onChange({ ...values, [campo.id]: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              ) : campo.tipo === 'number' ? (
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                  value={values[campo.id] || ''}
                  onChange={e => onChange({ ...values, [campo.id]: e.target.value })}
                  placeholder={campo.hint || 'Digite o valor...'}
                />
              ) : (
                <Input
                  className="h-8 text-xs"
                  value={values[campo.id] || ''}
                  onChange={e => onChange({ ...values, [campo.id]: e.target.value })}
                  placeholder={campo.hint || 'Digite o valor...'}
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}