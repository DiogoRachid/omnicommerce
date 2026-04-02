import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { LayoutList, Rows3, Grid2x2, List, Layers } from 'lucide-react';

export const VIEW_MODES = [
  {
    key: 'pai_collapsed',
    icon: Layers,
    label: 'Pai → Cores',
    description: 'Clica no pai → abre as cores (agrupado por atributo)',
  },
  {
    key: 'pai_flat',
    icon: Rows3,
    label: 'Pai → Todas variações',
    description: 'Clica no pai → lista todas as variações em sequência',
  },
  {
    key: 'cor_numeracao',
    icon: Grid2x2,
    label: 'Cor → Numerações',
    description: 'Cada cor do pai é um grupo expandível com numerações dentro',
  },
  {
    key: 'cor_produto',
    icon: List,
    label: 'Cada cor = produto',
    description: 'Cada combinação de cor aparece como produto independente',
  },
  {
    key: 'flat_all',
    icon: LayoutList,
    label: 'Todas variações',
    description: 'Todas as variações listadas individualmente, sem agrupamento',
  },
];

export default function ViewModeSelector({ viewMode, onChange }) {
  const current = VIEW_MODES.find(v => v.key === viewMode) || VIEW_MODES[0];
  const Icon = current.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Icon className="w-3.5 h-3.5" />
          Visualização
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Modo de visualização</p>
        <div className="space-y-1">
          {VIEW_MODES.map(mode => {
            const MIcon = mode.icon;
            const active = viewMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => onChange(mode.key)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <MIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium leading-tight">{mode.label}</p>
                  <p className={`text-xs mt-0.5 leading-tight ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{mode.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}