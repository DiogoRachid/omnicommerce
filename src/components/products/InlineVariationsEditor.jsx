import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Layers, Package, Trash2 } from 'lucide-react';

// Gera todas as combinações cartesianas de variações
function cartesian(groups) {
  if (groups.length === 0) return [[]];
  const [first, ...rest] = groups;
  const restCombos = cartesian(rest);
  return first.values
    .filter(v => v.trim())
    .flatMap(val => restCombos.map(combo => [{ nome: first.nome, valor: val.trim() }, ...combo]));
}

function buildVariationName(combo) {
  return combo.map(c => c.valor).join(' / ');
}

function buildAtributosStr(combo) {
  return combo.map(c => c.valor).join('|');
}

export default function InlineVariationsEditor({ tipo, onTipoChange, variationGroups, onVariationGroupsChange, readOnly = false }) {
  const [newGroupName, setNewGroupName] = useState('');

  const addGroup = () => {
    const nome = newGroupName.trim();
    if (!nome) return;
    onVariationGroupsChange([...variationGroups, { nome, values: [''] }]);
    setNewGroupName('');
  };

  const removeGroup = (idx) => {
    onVariationGroupsChange(variationGroups.filter((_, i) => i !== idx));
  };

  const updateGroupName = (idx, nome) => {
    const updated = [...variationGroups];
    updated[idx] = { ...updated[idx], nome };
    onVariationGroupsChange(updated);
  };

  const addValue = (groupIdx) => {
    const updated = [...variationGroups];
    updated[groupIdx] = { ...updated[groupIdx], values: [...updated[groupIdx].values, ''] };
    onVariationGroupsChange(updated);
  };

  const updateValue = (groupIdx, valIdx, val) => {
    const updated = [...variationGroups];
    updated[groupIdx] = {
      ...updated[groupIdx],
      values: updated[groupIdx].values.map((v, i) => i === valIdx ? val : v),
    };
    onVariationGroupsChange(updated);
  };

  const removeValue = (groupIdx, valIdx) => {
    const updated = [...variationGroups];
    const newVals = updated[groupIdx].values.filter((_, i) => i !== valIdx);
    updated[groupIdx] = { ...updated[groupIdx], values: newVals.length > 0 ? newVals : [''] };
    onVariationGroupsChange(updated);
  };

  // Preview das combinações geradas
  const combos = tipo === 'pai' ? cartesian(variationGroups.filter(g => g.nome.trim())) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" /> Tipo de Produto e Variações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de tipo */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onTipoChange('simples')}
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors
              ${tipo !== 'pai'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div>Produto Simples</div>
              <div className="text-xs font-normal opacity-70">Sem variações (cor, tamanho, etc.)</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onTipoChange('pai')}
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors
              ${tipo === 'pai'
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div>Produto com Variações</div>
              <div className="text-xs font-normal opacity-70">Ex: cor, tamanho, voltagem</div>
            </div>
          </button>
        </div>

        {/* Editor de grupos de variação */}
        {tipo === 'pai' && !readOnly && (
          <div className="space-y-3">
            {variationGroups.map((group, gIdx) => (
              <div key={gIdx} className="border rounded-lg p-3 space-y-2 bg-orange-50/40">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-sm font-medium w-40"
                    placeholder="Nome (ex: Cor)"
                    value={group.nome}
                    onChange={e => updateGroupName(gIdx, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground flex-1">Valores:</span>
                  <button type="button" onClick={() => removeGroup(gIdx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.values.map((val, vIdx) => (
                    <div key={vIdx} className="flex items-center gap-1">
                      <Input
                        className="h-7 text-xs w-28"
                        placeholder="Ex: Azul"
                        value={val}
                        onChange={e => updateValue(gIdx, vIdx, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addValue(gIdx); }
                        }}
                      />
                      {group.values.length > 1 && (
                        <button type="button" onClick={() => removeValue(gIdx, vIdx)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" onClick={() => addValue(gIdx)}>
                    <Plus className="w-3 h-3" /> Valor
                  </Button>
                </div>
              </div>
            ))}

            {/* Adicionar novo grupo */}
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm w-44"
                placeholder="Nova variação (ex: Tamanho)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }}
              />
              <Button type="button" size="sm" variant="outline" onClick={addGroup} className="h-8 gap-1 border-orange-300 text-orange-700 hover:bg-orange-50">
                <Plus className="w-3.5 h-3.5" /> Adicionar Variação
              </Button>
            </div>

            {/* Preview das combinações */}
            {combos.length > 0 && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{combos.length} variação(ões) que serão criadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {combos.slice(0, 20).map((combo, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] bg-white">
                      {buildVariationName(combo)}
                    </Badge>
                  ))}
                  {combos.length > 20 && (
                    <Badge variant="secondary" className="text-[11px]">+{combos.length - 20} mais</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Utilitário exportado para gerar as variações a partir dos grupos
export function generateVariationsFromGroups(pai, variationGroups) {
  const normalize = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const combos = cartesian(variationGroups.filter(g => g.nome.trim() && g.values.some(v => v.trim())));
  return combos.map((combo, idx) => ({
    nome: `${pai.nome} - ${buildVariationName(combo)}`,
    sku: `${pai.sku}-${combo.map(c => normalize(c.valor).substring(0, 4)).join('-')}`.substring(0, 18),
    tipo: 'variacao',
    variacoes_atributos: buildAtributosStr(combo),
    atributos_extras: Object.fromEntries(combo.map(c => [c.nome, c.valor])),
    preco_venda: pai.preco_venda || 0,
    preco_custo: pai.preco_custo || 0,
    ativo: true,
    company_id: pai.company_id,
    fotos: pai.fotos || [],
  }));
}