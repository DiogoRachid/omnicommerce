import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2 } from 'lucide-react';

export const ALL_COLUMNS = [
  { key: 'foto',       label: 'Foto' },
  { key: 'categoria',  label: 'Categoria' },
  { key: 'sku',        label: 'SKU' },
  { key: 'ean',        label: 'EAN' },
  { key: 'marca',      label: 'Marca' },
  { key: 'custo',      label: 'Custo' },
  { key: 'preco',      label: 'Preço Venda' },
  { key: 'tributos',   label: 'Tributos Aprox.' },
  { key: 'estoque',    label: 'Estoque' },
  { key: 'status',     label: 'Status' },
];

export const DEFAULT_COLUMNS = ['foto', 'categoria', 'sku', 'ean', 'custo', 'preco', 'tributos', 'estoque', 'status'];

export default function ColumnConfigPanel({ visibleColumns, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Settings2 className="w-3.5 h-3.5" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Colunas visíveis</p>
        <div className="space-y-2">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibleColumns.includes(col.key)}
                onCheckedChange={checked => {
                  if (checked) onChange([...visibleColumns, col.key]);
                  else onChange(visibleColumns.filter(c => c !== col.key));
                }}
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}