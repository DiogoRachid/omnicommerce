import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Layers, Settings, Info } from 'lucide-react';
import { toast } from 'sonner';
import GeneralTab from './tabs/GeneralTab';
import VariacoesTab from './tabs/VariacoesTab';
import MarketplaceFieldsTab from './tabs/MarketplaceFieldsTab';

export default function CategoryModal({ category, isNew, categories, onClose, onSaved }) {
  const [form, setForm] = useState(category);
  const [saving, setSaving] = useState(false);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      toast.error('Nome da categoria é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.ProductCategory.create(form);
      } else {
        await base44.entities.ProductCategory.update(form.id, form);
      }
      toast.success(isNew ? 'Categoria criada!' : 'Categoria atualizada!');
      onSaved();
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{form.icone || '📦'}</span>
            {isNew ? 'Nova Categoria' : `Editar — ${form.nome}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="geral" className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 shrink-0">
              <TabsTrigger value="geral" className="gap-1.5 text-xs">
                <Info className="w-3.5 h-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="variacoes" className="gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5" /> Variações Padrão
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" /> Campos por Marketplace
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="geral" className="mt-0">
                <GeneralTab form={form} onChange={updateForm} categories={categories} currentId={form.id} />
              </TabsContent>
              <TabsContent value="variacoes" className="mt-0">
                <VariacoesTab
                  variacoes={form.variacoes_padrao || []}
                  onChange={v => updateForm('variacoes_padrao', v)}
                />
              </TabsContent>
              <TabsContent value="marketplace" className="mt-0">
                <MarketplaceFieldsTab
                  campos={form.campos_marketplace || {}}
                  onChange={c => updateForm('campos_marketplace', c)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Categoria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}