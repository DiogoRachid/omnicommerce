import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MLSyncButton({ category, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSync = async () => {
    if (!category?.id) return;
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncCategoryML', {
        action: 'sync_one',
        category_id: category.id,
      });
      const data = res.data;
      setLastResult(data);
      if (data?.success) {
        toast.success(`Sincronizado! Categoria ML: ${data.mlCategoryId} · ${data.requiredCount} campos obrigatórios`);
        if (onSynced) onSynced();
      } else {
        toast.error('Erro ao sincronizar: ' + (data?.error || 'Resposta inesperada'));
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
      setLastResult({ success: false, error: e.message });
    }
    setSyncing(false);
  };

  return (
    <div className="flex items-center gap-2">
      {category?.ml_category_id && (
        <Badge variant="outline" className="text-[10px] gap-1 text-yellow-700 border-yellow-300 bg-yellow-50">
          ML: {category.ml_category_id}
        </Badge>
      )}
      {lastResult && (
        lastResult.success
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : <AlertCircle className="w-4 h-4 text-destructive" />
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="gap-1.5 text-xs h-8 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
      >
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {syncing ? 'Sincronizando...' : 'Sincronizar com ML'}
      </Button>
    </div>
  );
}