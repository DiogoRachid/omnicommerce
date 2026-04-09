import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

function getPrimaryAttr(v) {
  return (v.variacoes_atributos || '').split('|')[0].trim() || v.nome;
}

export default function BulkEditVariationsModal({ open, onClose, pai, variacoes }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [globalCusto, setGlobalCusto] = useState('');
  const [globalVenda, setGlobalVenda] = useState('');
  const [expandedCores, setExpandedCores] = useState({});
  // Per-color price inputs: { [cor]: { custo: '', venda: '' } }
  const [corPrices, setCorPrices] = useState({});

  useEffect(() => {
    if (variacoes) {
      setRows(variacoes.map(v => ({
        ...v,
        _custo: v.preco_custo ?? '',
        _venda: v.preco_venda ?? '',
      })));
    }
  }, [variacoes, open]);

  // Group by primary attribute (Cor)
  const grouped = {};
  rows.forEach(v => {
    const key = getPrimaryAttr(v);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  });
  const cores = Object.keys(grouped);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const applyGlobalCusto = () => {
    if (!globalCusto) return;
    setRows(prev => prev.map(r => ({ ...r, _custo: parseFloat(globalCusto) })));
  };

  const applyGlobalVenda = () => {
    if (!globalVenda) return;
    setRows(prev => prev.map(r => ({ ...r, _venda: parseFloat(globalVenda) })));
  };

  const applyCorCusto = (cor) => {
    const val = corPrices[cor]?.custo;
    if (!val) return;
    setRows(prev => prev.map(r => getPrimaryAttr(r) === cor ? { ...r, _custo: parseFloat(val) } : r));
  };

  const applyCorVenda = (cor) => {
    const val = corPrices[cor]?.venda;
    if (!val) return;
    setRows(prev => prev.map(r => getPrimaryAttr(r) === cor ? { ...r, _venda: parseFloat(val) } : r));
  };

  const setCorPrice = (cor, field, value) => {
    setCorPrices(prev => ({ ...prev, [cor]: { ...prev[cor], [field]: value } }));
  };

  const onDragEnd = (result, cor) => {
    if (!result.destination) return;
    const items = Array.from(grouped[cor]);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const newRows = [];
    cores.forEach(c => {
      (c === cor ? items : grouped[c]).forEach(i => newRows.push(i));
    });
    setRows(newRows);
  };

  const handleSave = async () => {
    setSaving(true);
    for (const row of rows) {
      await base44.entities.Product.update(row.id, {
        preco_custo: row._custo !== '' ? parseFloat(row._custo) : undefined,
        preco_venda: row._venda !== '' ? parseFloat(row._venda) : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['variacoes'] });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Variações — {pai?.nome}</DialogTitle>
        </DialogHeader>

        {/* Global controls */}
        <div className="flex flex-wrap gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Custo global:</span>
            <Input type="number" step="0.01" placeholder="R$" value={globalCusto}
              onChange={e => setGlobalCusto(e.target.value)} className="h-7 w-28 text-xs" />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyGlobalCusto}>Aplicar</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Venda global:</span>
            <Input type="number" step="0.01" placeholder="R$" value={globalVenda}
              onChange={e => setGlobalVenda(e.target.value)} className="h-7 w-28 text-xs" />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyGlobalVenda}>Aplicar</Button>
          </div>
        </div>

        {/* Per-color groups */}
        <div className="space-y-3">
          {cores.map(cor => {
            const isExpanded = expandedCores[cor] !== false;
            const cp = corPrices[cor] || {};
            return (
              <div key={cor} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 cursor-pointer"
                  onClick={() => setExpandedCores(prev => ({ ...prev, [cor]: !isExpanded }))}
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-orange-600" />
                    : <ChevronRight className="w-3.5 h-3.5 text-orange-600" />}
                  <span className="text-sm font-semibold text-orange-700">🎨 {cor}</span>
                  <Badge variant="outline" className="text-[10px] ml-1">{grouped[cor].length} itens</Badge>
                  <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Input type="number" step="0.01" placeholder="Custo cor" value={cp.custo || ''}
                      onChange={e => setCorPrice(cor, 'custo', e.target.value)} className="h-6 w-24 text-xs" />
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => applyCorCusto(cor)}>✓ Custo</Button>
                    <Input type="number" step="0.01" placeholder="Venda cor" value={cp.venda || ''}
                      onChange={e => setCorPrice(cor, 'venda', e.target.value)} className="h-6 w-24 text-xs" />
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => applyCorVenda(cor)}>✓ Venda</Button>
                  </div>
                </div>

                {isExpanded && (
                  <DragDropContext onDragEnd={r => onDragEnd(r, cor)}>
                    <Droppable droppableId={cor}>
                      {(provided) => (
                        <table className="w-full text-xs border-collapse" ref={provided.innerRef} {...provided.droppableProps}>
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="w-6 border-b border-border px-2 py-1" />
                              <th className="border-b border-border px-2 py-1 text-left">Atributos</th>
                              <th className="border-b border-border px-2 py-1 text-left">SKU</th>
                              <th className="border-b border-border px-2 py-1 text-right">Custo (R$)</th>
                              <th className="border-b border-border px-2 py-1 text-right">Venda (R$)</th>
                              <th className="border-b border-border px-2 py-1 text-right">Estoque</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped[cor].map((v, idx) => (
                              <Draggable key={v.id} draggableId={v.id} index={idx}>
                                {(prov) => (
                                  <tr ref={prov.innerRef} {...prov.draggableProps} className="hover:bg-accent/30">
                                    <td className="border-b border-border px-1 py-1 text-center" {...prov.dragHandleProps}>
                                      <GripVertical className="w-3 h-3 text-muted-foreground mx-auto" />
                                    </td>
                                    <td className="border-b border-border px-2 py-1 font-medium">
                                      {(v.variacoes_atributos || '').split('|').map(s => s.trim()).join(' / ')}
                                    </td>
                                    <td className="border-b border-border px-2 py-1 font-mono text-muted-foreground">{v.sku}</td>
                                    <td className="border-b border-border px-2 py-1">
                                      <Input type="number" step="0.01" value={v._custo}
                                        onChange={e => updateRow(v.id, '_custo', e.target.value)}
                                        className="h-6 w-24 text-xs text-right ml-auto" />
                                    </td>
                                    <td className="border-b border-border px-2 py-1">
                                      <Input type="number" step="0.01" value={v._venda}
                                        onChange={e => updateRow(v.id, '_venda', e.target.value)}
                                        className="h-6 w-24 text-xs text-right ml-auto" />
                                    </td>
                                    <td className="border-b border-border px-2 py-1 text-right text-muted-foreground">
                                      {v.estoque_atual ?? 0}
                                    </td>
                                  </tr>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </tbody>
                        </table>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}