import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORIAS } from '@/lib/productCategories';

// Campos disponíveis para filtro (fixos + dinâmicos de atributos_extras)
const FIXED_FIELDS = [
  { key: 'categoria',    label: 'Categoria',    type: 'select', options: CATEGORIAS },
  { key: 'ativo',        label: 'Status',       type: 'select', options: [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }] },
  { key: 'tipo',         label: 'Tipo',         type: 'select', options: [{ value: 'simples', label: 'Simples' }, { value: 'pai', label: 'Pai' }, { value: 'variacao', label: 'Variação' }] },
  { key: 'marca',        label: 'Marca',        type: 'text' },
  { key: 'unidade_medida', label: 'Unidade',    type: 'text' },
  { key: 'preco_venda',  label: 'Preço Venda',  type: 'range' },
  { key: 'estoque_atual', label: 'Estoque',     type: 'range' },
  { key: 'peso_bruto_kg', label: 'Peso (kg)',   type: 'range' },
];

function getAttrKeys(products) {
  const keys = new Set();
  products.forEach(p => {
    if (p.atributos_extras && typeof p.atributos_extras === 'object') {
      Object.keys(p.atributos_extras).forEach(k => keys.add(k));
    }
  });
  return Array.from(keys);
}

function getAttrValues(products, key) {
  const vals = new Set();
  products.forEach(p => {
    const v = p.atributos_extras?.[key];
    if (v !== undefined && v !== null && v !== '') vals.add(String(v));
  });
  return Array.from(vals).sort();
}

function matchFilter(product, filter) {
  const { field, op, value, value2, isAttr } = filter;
  let pval;
  if (isAttr) {
    pval = product.atributos_extras?.[field];
  } else {
    pval = product[field];
  }

  if (op === 'eq') return String(pval ?? '') === String(value ?? '');
  if (op === 'contains') return String(pval ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
  if (op === 'gte') return parseFloat(pval) >= parseFloat(value);
  if (op === 'lte') return parseFloat(pval) <= parseFloat(value);
  if (op === 'between') return parseFloat(pval) >= parseFloat(value) && parseFloat(pval) <= parseFloat(value2);
  return true;
}

export function applyFilters(products, filters) {
  if (!filters.length) return products;
  return products.filter(p => filters.every(f => matchFilter(p, f)));
}

export default function ProductFilters({ products, filters, onChange }) {
  const [open, setOpen] = useState(false);
  const [newField, setNewField] = useState('');
  const [newOp, setNewOp] = useState('eq');
  const [newValue, setNewValue] = useState('');
  const [newValue2, setNewValue2] = useState('');

  const attrKeys = useMemo(() => getAttrKeys(products), [products]);

  const allFields = [
    ...FIXED_FIELDS,
    ...attrKeys.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), type: 'attr', isAttr: true })),
  ];

  const selectedFieldDef = allFields.find(f => f.key === newField);

  const getOpsForField = (def) => {
    if (!def) return [];
    if (def.type === 'select') return [{ value: 'eq', label: '= igual' }];
    if (def.type === 'range') return [
      { value: 'gte', label: '>= maior ou igual' },
      { value: 'lte', label: '<= menor ou igual' },
      { value: 'between', label: 'entre' },
    ];
    if (def.type === 'attr') {
      const vals = getAttrValues(products, def.key);
      return vals.length
        ? [{ value: 'eq', label: '= igual' }, { value: 'contains', label: 'contém' }]
        : [{ value: 'contains', label: 'contém' }];
    }
    return [{ value: 'contains', label: 'contém' }, { value: 'eq', label: '= igual' }];
  };

  const handleAdd = () => {
    if (!newField || !newValue) return;
    const def = allFields.find(f => f.key === newField);
    onChange([...filters, {
      id: Date.now(),
      field: newField,
      label: def?.label || newField,
      op: newOp,
      value: newValue,
      value2: newValue2,
      isAttr: !!def?.isAttr,
    }]);
    setNewField('');
    setNewOp('eq');
    setNewValue('');
    setNewValue2('');
  };

  const handleRemove = (id) => onChange(filters.filter(f => f.id !== id));

  const opLabel = { eq: '=', contains: '≈', gte: '≥', lte: '≤', between: 'entre' };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          onClick={() => setOpen(o => !o)}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {filters.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{filters.length}</Badge>}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>

        {/* Chips dos filtros ativos */}
        {filters.map(f => (
          <Badge key={f.id} variant="secondary" className="gap-1 text-xs pr-1">
            <span>{f.label} {opLabel[f.op]} {f.value}{f.value2 ? `–${f.value2}` : ''}</span>
            <button onClick={() => handleRemove(f.id)} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        {filters.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onChange([])}>
            Limpar tudo
          </Button>
        )}
      </div>

      {open && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Adicionar filtro</p>
          <div className="flex flex-wrap gap-2 items-end">
            {/* Campo */}
            <div className="space-y-1">
              <Label className="text-xs">Campo</Label>
              <Select value={newField} onValueChange={v => { setNewField(v); setNewOp('eq'); setNewValue(''); setNewValue2(''); }}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <p className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">FIXOS</p>
                  {FIXED_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
                  {attrKeys.length > 0 && <>
                    <p className="px-2 py-1 text-[10px] text-muted-foreground font-semibold mt-1">ATRIBUTOS</p>
                    {attrKeys.map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
                  </>}
                </SelectContent>
              </Select>
            </div>

            {/* Operador */}
            {selectedFieldDef && (
              <div className="space-y-1">
                <Label className="text-xs">Condição</Label>
                <Select value={newOp} onValueChange={setNewOp}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOpsForField(selectedFieldDef).map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Valor */}
            {selectedFieldDef && (
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                {selectedFieldDef.type === 'select' ? (
                  <Select value={newValue} onValueChange={setNewValue}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {selectedFieldDef.options.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : selectedFieldDef.type === 'attr' ? (
                  <div className="flex gap-1">
                    {getAttrValues(products, selectedFieldDef.key).length > 0 ? (
                      <Select value={newValue} onValueChange={setNewValue}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {getAttrValues(products, selectedFieldDef.key).map(v => (
                            <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="w-36 h-8 text-xs" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Valor..." />
                    )}
                  </div>
                ) : (
                  <Input className="w-28 h-8 text-xs" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Valor..." />
                )}
              </div>
            )}

            {/* Valor2 (between) */}
            {newOp === 'between' && (
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input className="w-28 h-8 text-xs" value={newValue2} onChange={e => setNewValue2(e.target.value)} placeholder="Valor..." />
              </div>
            )}

            <Button size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={!newField || !newValue}>
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}