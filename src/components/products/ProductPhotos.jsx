import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, Trash2, Loader2, Link } from 'lucide-react';

export default function ProductPhotos({ fotos = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const novas = [...fotos];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      novas.push(file_url);
    }
    onChange(novas);
    setUploading(false);
    e.target.value = '';
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    onChange([...fotos, urlInput.trim()]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemove = (idx) => {
    const novas = fotos.filter((_, i) => i !== idx);
    onChange(novas);
  };

  return (
    <div className="space-y-3">
      <Label>Fotos do Produto</Label>

      {/* Grid de fotos */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {fotos.map((url, idx) => (
          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => handleRemove(idx)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              type="button"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-primary-foreground px-1 rounded font-medium">
                Principal
              </span>
            )}
          </div>
        ))}

        {/* Botão de upload */}
        <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Adicionar por URL */}
      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            placeholder="https://..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
            className="text-sm"
          />
          <Button type="button" size="sm" onClick={handleAddUrl}>Adicionar</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowUrlInput(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground h-7 text-xs"
          onClick={() => setShowUrlInput(true)}
        >
          <Link className="w-3.5 h-3.5" /> Adicionar por URL
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        A primeira foto é a imagem principal. Arraste para reordenar. Máx. recomendado: 5 fotos.
      </p>
    </div>
  );
}