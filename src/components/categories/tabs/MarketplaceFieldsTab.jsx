import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const MARKETPLACES = [
  { key: 'mercado_livre', label: 'Mercado Livre', emoji: '🛒', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { key: 'shopee',        label: 'Shopee',         emoji: '🟠', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'amazon',        label: 'Amazon',          emoji: '📦', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'magalu',        label: 'Magalu',          emoji: '🔵', color: 'text-purple-700 bg-purple-50 border-purple-200' },
];

const TIPOS = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'lista', label: 'Lista' },
  { value: 'boolean', label: 'Sim/Não' },
];

function MarketplaceSection({ mp, fields, onUpdate }) {
  const [open, setOpen] = useState(true);

  const addField = () => {
    onUpdate([...fields, { id: '', nome: '', tipo: 'texto', obrigatorio: false }]);
  };

  const updateField = (idx, key, value) => {
    onUpdate(fields.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const removeField = (idx) => {
    onUpdate(fields.filter((_, i) => i !== idx));
  };

  return (
    <div className={`rounded-lg border ${mp.color}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <span>{mp.emoji}</span> {mp.label}
          <span className="text-xs font-normal opacity-70">({fields.length} campo{fields.length !== 1 ? 's' : ''})</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-current/10">
          {fields.length > 0 && (
            <div className="grid grid-cols-[90px_1fr_110px_80px_32px] gap-1.5 mt-3 mb-1">
              {['ID técnico', 'Nome amigável', 'Tipo', 'Obrigatório', ''].map((h, i) => (
                <span key={i} className="text-[10px] font-medium text-current opacity-70">{h}</span>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {fields.map((field, idx) => (
              <div key={idx} className="grid grid-cols-[90px_1fr_110px_80px_32px] gap-1.5 items-center">
                <Input
                  value={field.id || ''}
                  onChange={e => updateField(idx, 'id', e.target.value)}
                  placeholder="ID"
                  className="h-7 text-xs px-2 bg-white"
                />
                <Input
                  value={field.nome || ''}
                  onChange={e => updateField(idx, 'nome', e.target.value)}
                  placeholder="Nome amigável"
                  className="h-7 text-xs px-2 bg-white"
                />
                <Select value={field.tipo || 'texto'} onValueChange={v => updateField(idx, 'tipo', v)}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => updateField(idx, 'obrigatorio', !field.obrigatorio)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${field.obrigatorio ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${field.obrigatorio ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => removeField(idx)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addField} className="gap-1.5 bg-white/70 w-full mt-2">
            <Plus className="w-3.5 h-3.5" /> Adicionar campo
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MarketplaceFieldsTab({ campos, onChange }) {
  const updateMp = (mpKey, fields) => {
    onChange({ ...campos, [mpKey]: fields });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Configure os campos obrigatórios e opcionais de cada marketplace para produtos desta categoria.
      </p>
      {MARKETPLACES.map(mp => (
        <MarketplaceSection
          key={mp.key}
          mp={mp}
          fields={campos[mp.key] || []}
          onUpdate={fields => updateMp(mp.key, fields)}
        />
      ))}
    </div>
  );
}