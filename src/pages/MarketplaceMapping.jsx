import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Download, Trash2, Edit, Plus, Loader2, ArrowRight, Map, Package, FileText } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const MARKETPLACES = [
  { id: 'mercado_livre', label: 'Mercado Livre', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'bling', label: 'Bling', color: 'bg-blue-100 text-blue-800' },
  { id: 'shopee', label: 'Shopee', color: 'bg-orange-100 text-orange-800' },
  { id: 'shopify', label: 'Shopify', color: 'bg-green-100 text-green-800' },
  { id: 'woocommerce', label: 'WooCommerce', color: 'bg-purple-100 text-purple-800' },
  { id: 'amazon', label: 'Amazon', color: 'bg-amber-100 text-amber-800' },
  { id: 'magalu', label: 'Magalu', color: 'bg-blue-100 text-blue-700' },
];

const STATIC_MARKETPLACE_FIELDS = {
  mercado_livre: ['title', 'price', 'currency_id', 'available_quantity', 'listing_type_id', 'condition', 'category_id', 'gtin', 'seller_sku', 'pictures', 'description.plain_text', 'shipping.dimensions.height', 'shipping.dimensions.width', 'shipping.dimensions.length', 'shipping.dimensions.weight'],
  bling: ['nome', 'codigo', 'preco', 'precoCusto', 'situacao', 'estoque.minimo', 'estoque.maximo', 'gtin', 'marca', 'descricaoCurta', 'peso_bruto', 'peso_liquido', 'largura', 'altura', 'profundidade', 'unidade'],
  shopee: ['item_name', 'original_price', 'stock', 'category_id', 'description', 'images', 'weight', 'dimension.package_height', 'dimension.package_width', 'dimension.package_length', 'item_sku', 'logistics'],
  shopify: ['title', 'body_html', 'vendor', 'product_type', 'variants.price', 'variants.sku', 'variants.barcode', 'variants.inventory_quantity', 'variants.weight', 'images'],
  woocommerce: ['name', 'description', 'regular_price', 'sku', 'manage_stock', 'stock_quantity', 'weight', 'dimensions.length', 'dimensions.width', 'dimensions.height', 'images', 'categories'],
  amazon: ['item_name', 'brand_name', 'bullet_point', 'standard_price', 'quantity', 'main_image_url', 'external_product_id', 'item_type', 'shipping_weight'],
  magalu: ['nome', 'preco', 'sku', 'estoque', 'descricao', 'categoria', 'marca', 'imagens', 'peso', 'altura', 'largura', 'profundidade', 'ean'],
};

const SYSTEM_FIELDS = [
  { value: 'nome', label: 'Nome do Produto' },
  { value: 'sku', label: 'SKU' },
  { value: 'ean', label: 'EAN/GTIN' },
  { value: 'descricao', label: 'Descrição' },
  { value: 'marca', label: 'Marca' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'preco_venda', label: 'Preço de Venda' },
  { value: 'preco_custo', label: 'Preço de Custo' },
  { value: 'margem_padrao', label: 'Margem Padrão (%)' },
  { value: 'estoque_atual', label: 'Estoque Atual' },
  { value: 'estoque_minimo', label: 'Estoque Mínimo' },
  { value: 'estoque_maximo', label: 'Estoque Máximo' },
  { value: 'unidade_medida', label: 'Unidade de Medida' },
  { value: 'ncm', label: 'NCM' },
  { value: 'cest', label: 'CEST' },
  { value: 'peso_bruto_kg', label: 'Peso Bruto (kg)' },
  { value: 'peso_liquido_kg', label: 'Peso Líquido (kg)' },
  { value: 'altura_cm', label: 'Altura (cm)' },
  { value: 'largura_cm', label: 'Largura (cm)' },
  { value: 'comprimento_cm', label: 'Comprimento (cm)' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'variacoes_atributos', label: 'Atributos de Variação' },
  { value: 'atributos_extras', label: 'Atributos Extras' },
  { value: '_ignorar', label: '— Ignorar campo —' },
];

// ── Connection status check ───────────────────────────────────────────────────

async function checkConnections() {
  const [blingRes, mlRes] = await Promise.allSettled([
    base44.functions.invoke('blingProxy', { action: 'status' }),
    base44.functions.invoke('mlProxy', { action: 'status' }),
  ]);
  return {
    bling: blingRes.status === 'fulfilled' ? blingRes.value?.data : { connected: false, error: blingRes.reason?.message },
    ml: mlRes.status === 'fulfilled' ? mlRes.value?.data : { connected: false, error: mlRes.reason?.message },
  };
}

// ── Helper to fetch sample fields from marketplace ────────────────────────────

async function fetchMarketplaceFields(marketplace) {
  if (marketplace === 'bling') {
    const res = await base44.functions.invoke('blingProxy', { action: 'listProducts', pagina: 1, limite: 1 });
    const products = res?.data?.data || [];
    if (products.length === 0) return [];
    return Object.keys(flattenObj(products[0]));
  }

  if (marketplace === 'mercado_livre') {
    const res = await base44.functions.invoke('mlProxy', { action: 'listSampleProducts' });
    const items = res?.data?.items || [];
    if (items.length === 0) return [];
    return Object.keys(flattenObj(items[0]));
  }

  // Generic fallback — return common fields
  return ['title', 'price', 'sku', 'description', 'category_id', 'quantity', 'gtin', 'images', 'status'];
}

function flattenObj(obj, prefix = '') {
  return Object.keys(obj || {}).reduce((acc, k) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObj(obj[k], key));
    } else {
      acc[key] = obj[k];
    }
    return acc;
  }, {});
}

// ── CreateFieldModal ──────────────────────────────────────────────────────────

function CreateFieldModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ value: '', label: '', type: 'text', required: false });

  const handleCreate = () => {
    if (!form.value.trim() || !form.label.trim()) {
      toast.error('Preencha nome e label do campo.');
      return;
    }
    onCreated({ value: form.value.trim(), label: form.label.trim() });
    setForm({ value: '', label: '', type: 'text', required: false });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar novo campo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Chave do campo (ex: voltagem)</Label>
            <Input value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="voltagem" />
          </div>
          <div>
            <Label>Label (ex: Voltagem)</Label>
            <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Voltagem" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="boolean">Booleano</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate}>Criar Campo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── FieldMappingModal ─────────────────────────────────────────────────────────

function FieldMappingModal({ open, onClose, marketplace, marketplaceFields, existingMappings, companyId, onSaved, suggestedMappings }) {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState({});
  const [systemFields, setSystemFields] = useState(SYSTEM_FIELDS);
  const [saving, setSaving] = useState(false);
  const [showCreateField, setShowCreateField] = useState(false);
  const [pendingFieldFor, setPendingFieldFor] = useState(null);

  useEffect(() => {
    if (!open) return;
    const initial = {};
    marketplaceFields.forEach(f => {
      // Priority: suggestedMappings > existingMappings
      const suggested = suggestedMappings?.find(m => m.marketplace_field === f);
      const found = existingMappings.find(m => m.marketplace_field === f);
      initial[f] = suggested ? suggested.system_field : (found ? found.system_field : '');
    });
    setMappings(initial);
  }, [open, marketplaceFields, existingMappings, suggestedMappings]);

  const handleSave = async () => {
    setSaving(true);
    let saved = 0;
    for (const [mf, sf] of Object.entries(mappings)) {
      if (!sf) continue;
      const existing = existingMappings.find(m => m.marketplace_field === mf);
      if (existing) {
        await base44.entities.MarketplaceFieldMapping.update(existing.id, { system_field: sf });
      } else {
        await base44.entities.MarketplaceFieldMapping.create({
          marketplace, marketplace_field: mf, system_field: sf, company_id: companyId,
        });
      }
      saved++;
    }
    queryClient.invalidateQueries({ queryKey: ['field_mappings'] });
    toast.success(`${saved} mapeamentos salvos!`);
    setSaving(false);
    onSaved();
    onClose();
  };

  const mlLabel = MARKETPLACES.find(m => m.id === marketplace)?.label || marketplace;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mapeamento de Campos — {mlLabel}</DialogTitle>
            <p className="text-sm text-muted-foreground">Associe cada campo do marketplace ao campo correspondente no sistema.</p>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-center text-xs font-semibold text-muted-foreground mb-1 px-1">
            <span>Campo no {mlLabel}</span>
            <span />
            <span>Campo no Sistema</span>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {marketplaceFields.map(f => (
              <div key={f} className="grid grid-cols-[1fr_32px_1fr] gap-2 items-center">
                <div className="bg-muted/50 rounded px-3 py-2 text-xs font-mono truncate">{f}</div>
                <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                <div className="flex gap-1">
                  <Select
                    value={mappings[f] || ''}
                    onValueChange={v => setMappings(p => ({ ...p, [f]: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {systemFields.map(sf => (
                        <SelectItem key={sf.value} value={sf.value} className="text-xs">{sf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                    title="Criar novo campo"
                    onClick={() => { setPendingFieldFor(f); setShowCreateField(true); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Mapeamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateFieldModal
        open={showCreateField}
        onClose={() => setShowCreateField(false)}
        onCreated={(newField) => {
          setSystemFields(prev => [...prev, newField]);
          if (pendingFieldFor) {
            setMappings(p => ({ ...p, [pendingFieldFor]: newField.value }));
          }
          toast.success(`Campo "${newField.label}" criado!`);
        }}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketplaceMapping() {
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();

  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [importing, setImporting] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [marketplaceFields, setMarketplaceFields] = useState([]);
  const [activeTab, setActiveTab] = useState('importar');
  const [connStatus, setConnStatus] = useState(null);
  const [checkingConn, setCheckingConn] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestedMappings, setSuggestedMappings] = useState(null);

  const handleCheckConnections = async () => {
    setCheckingConn(true);
    const status = await checkConnections();
    setConnStatus(status);
    setCheckingConn(false);
  };

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['field_mappings', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.MarketplaceFieldMapping.filter({ company_id: selectedCompany }, '-created_date', 500);
      }
      return base44.entities.MarketplaceFieldMapping.list('-created_date', 500);
    },
  });

  const { data: importLogs = [] } = useQuery({
    queryKey: ['import_logs', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.MarketplaceImportLog.filter({ company_id: selectedCompany }, '-created_date', 50);
      }
      return base44.entities.MarketplaceImportLog.list('-created_date', 50);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MarketplaceFieldMapping.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field_mappings'] });
      toast.success('Mapeamento removido.');
    },
  });

  const handleSuggestWithAI = async () => {
    if (!selectedMarketplace) return;
    setAiLoading(true);
    setSuggestedMappings(null);
    try {
      const mlLabel = MARKETPLACES.find(m => m.id === selectedMarketplace)?.label || selectedMarketplace;
      const mlFields = STATIC_MARKETPLACE_FIELDS[selectedMarketplace] || [];
      const sysFields = SYSTEM_FIELDS.filter(f => f.value !== '_ignorar').map(f => `${f.value} (${f.label})`);
      const prompt = `Você é um especialista em integração de marketplaces. Mapeie os campos do marketplace "${mlLabel}" para os campos internos do sistema.

Campos do marketplace ${mlLabel}:
${mlFields.join(', ')}

Campos internos do sistema:
${sysFields.join(', ')}

Responda SOMENTE com um array JSON válido no formato [{"marketplace_field": "...", "system_field": "..."}], mapeando apenas os campos que tiverem correspondência clara. Não inclua texto adicional, apenas o JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            mappings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  marketplace_field: { type: 'string' },
                  system_field: { type: 'string' }
                }
              }
            }
          }
        }
      });

      const suggested = result?.mappings || [];
      setSuggestedMappings(suggested);
      // Use static fields + suggested pre-fill
      const fields = mlFields.length > 0 ? mlFields : await fetchMarketplaceFields(selectedMarketplace);
      setMarketplaceFields(fields);
      setShowMappingModal(true);
      toast.success(`IA sugeriu ${suggested.length} mapeamentos!`);
    } catch (err) {
      toast.error(`Erro na sugestão da IA: ${err.message}`);
    }
    setAiLoading(false);
  };

  const handleImport = async () => {
    if (!selectedMarketplace) {
      toast.error('Selecione um marketplace.');
      return;
    }
    setSuggestedMappings(null);
    setImporting(true);
    try {
      const fields = await fetchMarketplaceFields(selectedMarketplace);
      if (fields.length === 0) {
        toast.warning('Nenhum campo encontrado. Verifique a conexão com o marketplace.');
        setImporting(false);
        return;
      }
      setMarketplaceFields(fields);
      setShowMappingModal(true);
    } catch (err) {
      toast.error(`Erro ao importar: ${err.message}`);
      await base44.entities.MarketplaceImportLog.create({
        marketplace: selectedMarketplace,
        total_imported: 0,
        total_errors: 1,
        imported_at: new Date().toISOString(),
        status: 'erro',
        detalhes: err.message,
        company_id: selectedCompany !== 'all' ? selectedCompany : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['import_logs'] });
    }
    setImporting(false);
  };

  // Group mappings by marketplace
  const groupedMappings = MARKETPLACES.reduce((acc, ml) => {
    acc[ml.id] = mappings.filter(m => m.marketplace === ml.id);
    return acc;
  }, {});

  const existingMappings = mappings.filter(m => m.marketplace === selectedMarketplace);
  const mlInfo = MARKETPLACES.find(m => m.id === selectedMarketplace);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Map className="w-6 h-6" /> Mapeamento Marketplaces</h1>
        <Button variant="outline" size="sm" onClick={handleCheckConnections} disabled={checkingConn} className="gap-2">
          {checkingConn ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🔌</span>}
          Verificar Conexões
        </Button>
      </div>
      {connStatus && (
        <div className="flex flex-wrap gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${connStatus.bling?.connected ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className={`w-2 h-2 rounded-full ${connStatus.bling?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            Bling: {connStatus.bling?.connected ? (connStatus.bling?.expired ? '⚠ Token expirado' : '✓ Conectado') : '✗ Desconectado'}
            {connStatus.bling?.error && <span className="text-xs opacity-70 ml-1">({connStatus.bling.error})</span>}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${connStatus.ml?.connected ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className={`w-2 h-2 rounded-full ${connStatus.ml?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            Mercado Livre: {connStatus.ml?.connected ? (connStatus.ml?.valid ? '✓ Conectado' : '⚠ Token inválido') : '✗ Desconectado'}
            {connStatus.ml?.error && <span className="text-xs opacity-70 ml-1">({connStatus.ml.error})</span>}
          </div>
        </div>
      )}
        <p className="text-muted-foreground text-sm mt-0.5">Configure o mapeamento de campos entre os marketplaces e o sistema.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="importar" className="gap-2"><Download className="w-4 h-4" /> Importar & Mapear</TabsTrigger>
          <TabsTrigger value="mapeamentos" className="gap-2"><Map className="w-4 h-4" /> Mapeamentos Salvos</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><FileText className="w-4 h-4" /> Logs</TabsTrigger>
        </TabsList>

        {/* ── Tab: Importar ── */}
        <TabsContent value="importar" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Selecionar Marketplace</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                {MARKETPLACES.map(ml => (
                  <button
                    key={ml.id}
                    onClick={() => setSelectedMarketplace(ml.id)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedMarketplace === ml.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {ml.label}
                  </button>
                ))}
              </div>

              {selectedMarketplace && (
                <div className="space-y-3">
                  <div className="bg-muted/40 rounded-lg p-3 text-sm">
                    <p className="font-medium">{mlInfo?.label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {existingMappings.length > 0
                        ? `${existingMappings.length} mapeamentos existentes serão pré-carregados.`
                        : 'Nenhum mapeamento salvo ainda para este marketplace.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleImport} disabled={importing || aiLoading} className="gap-2">
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {importing ? 'Buscando campos...' : 'Buscar Campos & Mapear'}
                    </Button>
                    <Button onClick={handleSuggestWithAI} disabled={aiLoading || importing} variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✨</span>}
                      {aiLoading ? 'Consultando IA...' : 'Sugerir Mapeamento com IA'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Mapeamentos ── */}
        <TabsContent value="mapeamentos" className="space-y-4 mt-4">
          {MARKETPLACES.map(ml => {
            const mlMappings = groupedMappings[ml.id] || [];
            if (mlMappings.length === 0) return null;
            return (
              <Card key={ml.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className={ml.color}>{ml.label}</Badge>
                    <span className="font-normal text-muted-foreground">{mlMappings.length} mapeamentos</span>
                    <Button
                      size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1"
                      onClick={() => {
                        setSelectedMarketplace(ml.id);
                        setMarketplaceFields(mlMappings.map(m => m.marketplace_field));
                        setShowMappingModal(true);
                      }}
                    >
                      <Edit className="w-3 h-3" /> Editar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="border border-border px-3 py-1.5 text-left">Campo no Marketplace</th>
                        <th className="border border-border px-3 py-1.5 text-left">Campo no Sistema</th>
                        <th className="border border-border px-3 py-1.5 w-16 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlMappings.map(m => (
                        <tr key={m.id} className="hover:bg-accent/20">
                          <td className="border border-border px-3 py-1.5 font-mono">{m.marketplace_field}</td>
                          <td className="border border-border px-3 py-1.5">
                            {SYSTEM_FIELDS.find(sf => sf.value === m.system_field)?.label || m.system_field}
                          </td>
                          <td className="border border-border px-3 py-1.5 text-center">
                            <Button
                              size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(m.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
          {mappings.length === 0 && (
            <div className="border rounded-lg p-12 text-center bg-card">
              <Map className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhum mapeamento salvo ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">Use a aba "Importar & Mapear" para criar mapeamentos.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Logs ── */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de Importações</CardTitle></CardHeader>
            <CardContent>
              {importLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum log de importação ainda.</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="border border-border px-3 py-1.5 text-left">Marketplace</th>
                      <th className="border border-border px-3 py-1.5 text-right">Importados</th>
                      <th className="border border-border px-3 py-1.5 text-right">Erros</th>
                      <th className="border border-border px-3 py-1.5 text-left">Status</th>
                      <th className="border border-border px-3 py-1.5 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importLogs.map(log => (
                      <tr key={log.id} className="hover:bg-accent/20">
                        <td className="border border-border px-3 py-1.5">
                          <Badge className={MARKETPLACES.find(m => m.id === log.marketplace)?.color || ''}>
                            {MARKETPLACES.find(m => m.id === log.marketplace)?.label || log.marketplace}
                          </Badge>
                        </td>
                        <td className="border border-border px-3 py-1.5 text-right">{log.total_imported ?? 0}</td>
                        <td className="border border-border px-3 py-1.5 text-right text-destructive">{log.total_errors ?? 0}</td>
                        <td className="border border-border px-3 py-1.5">
                          <Badge variant={log.status === 'sucesso' ? 'default' : log.status === 'parcial' ? 'secondary' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="border border-border px-3 py-1.5 text-muted-foreground">
                          {log.imported_at ? new Date(log.imported_at).toLocaleString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FieldMappingModal
        open={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        marketplace={selectedMarketplace}
        marketplaceFields={marketplaceFields}
        existingMappings={existingMappings}
        companyId={selectedCompany !== 'all' ? selectedCompany : undefined}
        onSaved={refetchMappings}
        suggestedMappings={suggestedMappings}
      />
    </div>
  );
}