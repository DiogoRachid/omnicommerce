import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'lista', label: 'Lista de opções' },
  { value: 'boolean', label: 'Sim/Não' },
];

export default function VariacoesTab({ variacoes, onChange }) {
  const addVariacao = () => {
    onChange([...variacoes, { nome: '', tipo: 'texto', obrigatorio: false }]);
  };

  const updateVariacao = (idx, field, value) => {
    const updated = variacoes.map((v, i) => i === idx ? { ...v, [field]: value } : v);
    onChange(updated);
  };

  const removeVariacao = (idx) => {
    onChange(variacoes.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Defina as variações padrão desta categoria (ex: Cor, Tamanho). Serão sugeridas ao criar produtos.
      </p>

      {variacoes.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
          Nenhuma variação configurada. Clique em "+ Adicionar" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_140px_100px_36px] gap-2 px-2">
            <span className="text-[11px] text-muted-foreground font-medium">Nome</span>
            <span className="text-[11px] text-muted-foreground font-medium">Tipo</span>
            <span className="text-[11px] text-muted-foreground font-medium text-center">Obrigatório</span>
            <span />
          </div>

          {variacoes.map((v, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_140px_100px_36px] gap-2 items-center">
              <Input
                value={v.nome || ''}
                onChange={e => updateVariacao(idx, 'nome', e.target.value)}
                placeholder="Ex: Cor"
                className="h-8 text-sm"
              />
              <Select value={v.tipo || 'texto'} onValueChange={val => updateVariacao(idx, 'tipo', val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => updateVariacao(idx, 'obrigatorio', !v.obrigatorio)}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${v.obrigatorio ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${v.obrigatorio ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => removeVariacao(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={addVariacao} className="gap-1.5 w-full">
        <Plus className="w-3.5 h-3.5" /> Adicionar Variação
      </Button>
    </div>
  );
}