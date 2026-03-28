import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Package, Download, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Image, Scale, Barcode, FileText
} from 'lucide-react';

const BLING_API = 'https://api.bling.com.br/Api/v3';

async function fetchBlingPage(token, page = 1) {
  const res = await fetch(`${BLING_API}/produtos?pagina=${page}&limite=100&criterio=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.description || `Erro ${res.status} ao acessar a API do Bling`);
  }
  return res.json();
}

async function fetchBlingProductDetail(token, id) {
  const res = await fetch(`${BLING_API}/produtos/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

function mapBlingProduct(bp, companyId) {
  const dim = bp.dimensoes || {};
  const fotos = (bp.midia?.imagens?.externas || [])
    .map(i => i.link)
    .filter(Boolean)
    .slice(0, 5);

  return {
    sku: bp.codigo || `BLING-${bp.id}`,
    ean: bp.gtin || '',
    nome: bp.nome || '',
    descricao: bp.descricaoCurta || bp.descricaoComplementar || '',
    marca: bp.marca || '',
    ncm: bp.tributacao?.ncm || '',
    cest: bp.tributacao?.cest || '',
    unidade_medida: bp.unidade || 'UN',
    peso_bruto_kg: dim.pesoBruto ? parseFloat(dim.pesoBruto) : undefined,
    peso_liquido_kg: dim.pesoLiquido ? parseFloat(dim.pesoLiquido) : undefined,
    altura_cm: dim.altura ? parseFloat(dim.altura) : undefined,
    largura_cm: dim.largura ? parseFloat(dim.largura) : undefined,
    comprimento_cm: dim.profundidade ? parseFloat(dim.profundidade) : undefined,
    preco_custo: bp.preco ? parseFloat(bp.preco) : undefined,
    preco_venda: bp.preco ? parseFloat(bp.preco) : undefined,
    estoque_atual: 0,
    estoque_minimo: 0,
    fotos,
    ativo: bp.situacao === 'A',
    origem: 'importacao',
    company_id: companyId || undefined,
    bling_id: String(bp.id),
  };
}

export default function BlingImportDialog({ company, open, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('preview'); // preview | importing | done
  const [blingProducts, setBlingProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);

  const token = company?.bling_api_key;

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    setBlingProducts([]);
    setSelected({});
    try {
      let all = [];
      let page = 1;
      while (true) {
        const json = await fetchBlingPage(token, page);
        const items = json?.data || [];
        if (items.length === 0) break;
        all = [...all, ...items];
        if (items.length < 100) break;
        page++;
        if (page > 20) break; // limite de segurança
      }
      setBlingProducts(all);
      const sel = {};
      all.forEach(p => { sel[p.id] = true; });
      setSelected(sel);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    const toImport = blingProducts.filter(p => selected[p.id]);
    let created = 0, updated = 0, errors = 0;

    // Busca produtos existentes para verificar duplicatas por SKU
    const existingRaw = await base44.entities.Product.list('-created_date', 500);
    const existingBySku = {};
    const existingByBlingId = {};
    existingRaw.forEach(p => {
      if (p.sku) existingBySku[p.sku] = p;
      if (p.bling_id) existingByBlingId[p.bling_id] = p;
    });

    for (let i = 0; i < toImport.length; i++) {
      const bp = toImport[i];
      setProgress(Math.round(((i + 1) / toImport.length) * 100));

      // Busca detalhes completos (fotos, dimensões, etc.)
      const detail = await fetchBlingProductDetail(token, bp.id);
      const productData = mapBlingProduct(detail || bp, company.id);

      const existingByBling = existingByBlingId[String(bp.id)];
      const existingBySKU = existingBySku[productData.sku];
      const existing = existingByBling || existingBySKU;

      try {
        if (existing) {
          await base44.entities.Product.update(existing.id, productData);
          updated++;
        } else {
          await base44.entities.Product.create(productData);
          created++;
        }
      } catch {
        errors++;
      }
    }

    setImportResult({ created, updated, errors, total: toImport.length });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setStep('done');
  };

  const toggleAll = (val) => {
    const sel = {};
    blingProducts.forEach(p => { sel[p.id] = val; });
    setSelected(sel);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleClose = () => {
    setStep('preview');
    setBlingProducts([]);
    setSelected({});
    setError('');
    setImportResult(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            Importar Produtos do Bling
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {company?.nome_fantasia || company?.razao_social}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4 py-2">
              {!token && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta empresa não possui um Access Token do Bling configurado. Edite a empresa e adicione o token OAuth2 no campo "API Key do Bling".
                  </AlertDescription>
                </Alert>
              )}

              {token && blingProducts.length === 0 && !loading && !error && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Buscar Produtos no Bling</h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                    Será feita uma busca completa no catálogo do Bling. Produtos já cadastrados serão atualizados automaticamente.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center text-xs text-muted-foreground mb-6">
                    {[
                      { icon: Image, label: 'Fotos' },
                      { icon: Scale, label: 'Peso & Dimensões' },
                      { icon: Barcode, label: 'EAN / GTIN' },
                      { icon: FileText, label: 'NCM & Dados Fiscais' },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
                        <Icon className="w-3 h-3" /> {label}
                      </div>
                    ))}
                  </div>
                  <Button onClick={fetchProducts} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Buscar Produtos
                  </Button>
                </div>
              )}

              {loading && (
                <div className="text-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Buscando produtos no Bling...</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {blingProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">{blingProducts.length} produtos encontrados</p>
                      <Badge variant="secondary">{selectedCount} selecionados</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Todos</Button>
                      <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Nenhum</Button>
                      <Button variant="outline" size="sm" onClick={fetchProducts} className="gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[340px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="w-10 p-2 text-left">
                              <Checkbox
                                checked={selectedCount === blingProducts.length}
                                onCheckedChange={(v) => toggleAll(v)}
                              />
                            </th>
                            <th className="p-2 text-left font-medium text-muted-foreground">Produto</th>
                            <th className="p-2 text-left font-medium text-muted-foreground">Cód.</th>
                            <th className="p-2 text-left font-medium text-muted-foreground">EAN</th>
                            <th className="p-2 text-right font-medium text-muted-foreground">Preço</th>
                            <th className="p-2 text-center font-medium text-muted-foreground">Sit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blingProducts.map((p) => (
                            <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                              <td className="p-2">
                                <Checkbox
                                  checked={!!selected[p.id]}
                                  onCheckedChange={(v) => setSelected(prev => ({ ...prev, [p.id]: v }))}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-2">
                                <p className="font-medium truncate max-w-[200px]">{p.nome}</p>
                                {p.marca && <p className="text-xs text-muted-foreground">{p.marca}</p>}
                              </td>
                              <td className="p-2 font-mono text-xs">{p.codigo || '-'}</td>
                              <td className="p-2 font-mono text-xs">{p.gtin || '-'}</td>
                              <td className="p-2 text-right">
                                {p.preco ? `R$ ${parseFloat(p.preco).toFixed(2)}` : '-'}
                              </td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant={p.situacao === 'A' ? 'default' : 'secondary'}
                                  className="text-[10px] px-1.5"
                                >
                                  {p.situacao === 'A' ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-semibold">Importando produtos...</p>
                <p className="text-sm text-muted-foreground mt-1">Buscando detalhes completos (fotos, dimensões, etc.)</p>
              </div>
              <div className="max-w-xs mx-auto space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% concluído</p>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && importResult && (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground mt-1">{importResult.total} produtos processados</p>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="bg-green-50 rounded-xl p-4 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                  <p className="text-xs text-green-700 mt-1">Criados</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                  <p className="text-xs text-blue-700 mt-1">Atualizados</p>
                </div>
                {importResult.errors > 0 && (
                  <div className="bg-red-50 rounded-xl p-4 text-center min-w-[80px]">
                    <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                    <p className="text-xs text-red-700 mt-1">Erros</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || loading}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Importar {selectedCount > 0 ? `${selectedCount} produto${selectedCount > 1 ? 's' : ''}` : ''}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}