import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMOJIS = ['📦','👟','👠','👡','👢','🥾','🧢','👗','👔','👕','👖','🧤','🧣','🎒','💼','👜','👛','💍','⌚','📱','💻','🖥️','📷','🎮','🏠','🛋️','🧴','💄','🌸','🎁','🧸','🔧','🍳','🏋️','⚽','🚗','📚','🎵','🎨'];

export default function GeneralTab({ form, onChange, categories, currentId }) {
  const [showEmojis, setShowEmojis] = useState(false);

  const parentOptions = categories.filter(c => c.id !== currentId);

  return (
    <div className="space-y-4">
      {/* Ícone */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Ícone</Label>
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={() => setShowEmojis(prev => !prev)}
            className="text-3xl w-12 h-12 rounded-lg border border-input hover:bg-muted transition-colors flex items-center justify-center"
          >
            {form.icone || '📦'}
          </button>
          <span className="text-xs text-muted-foreground">Clique para escolher o emoji</span>
        </div>
        {showEmojis && (
          <div className="mt-2 p-3 border rounded-lg bg-muted/30 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange('icone', e); setShowEmojis(false); }}
                className={`text-xl w-9 h-9 rounded hover:bg-background transition-colors ${form.icone === e ? 'bg-background ring-1 ring-primary' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nome */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Nome da Categoria *</Label>
        <Input
          value={form.nome || ''}
          onChange={e => onChange('nome', e.target.value)}
          placeholder="Ex: Calçados, Eletrônicos..."
          className="mt-1"
        />
      </div>

      {/* Descrição */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
        <textarea
          value={form.descricao || ''}
          onChange={e => onChange('descricao', e.target.value)}
          placeholder="Descrição opcional da categoria..."
          rows={2}
          className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Categoria Pai */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Categoria Pai (opcional)</Label>
        <Select
          value={form.categoria_pai_id || 'none'}
          onValueChange={v => onChange('categoria_pai_id', v === 'none' ? '' : v)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Nenhuma (categoria raiz)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma (categoria raiz)</SelectItem>
            {parentOptions.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium text-muted-foreground">Status</Label>
        <button
          type="button"
          onClick={() => onChange('ativo', !form.ativo)}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.ativo ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${form.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-xs text-muted-foreground">{form.ativo ? 'Ativa' : 'Inativa'}</span>
      </div>
    </div>
  );
}