import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Package, Download, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Trash2
} from 'lucide-react';

// Usa InvokeLLM como proxy para evitar bloqueio CORS
async function blingGet(path, apiKey) {
  return await base44.integrations.Core.InvokeLLM({
    prompt: `Faça uma requisição HTTP GET para a URL exata: https://api.bling.com.br/Api/v3${path}
Use o header: Authorization: Bearer ${apiKey}
Retorne EXATAMENTE o JSON da resposta sem nenhuma modificação ou comentário.`,
    response_json_schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        error: { type: 'object' }
      }
    }
  });
}

function mapBlingProduct(bp, companyId) {
  const dim = bp.dimensoes || {};
  const fotos = (bp.midia?.imagens?.externas || [])
    .map(i => i.link).filter(Boolean).slice(0, 5);

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
  const [step, setStep] = useState('idle'); // idle | loading | preview | importing | done
  const [blingProducts, setBlingProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importResult, setImportResult] = useState(null);

  const apiKey = company?.bling_api_key;
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // null | 'ok' | 'fail'

  const testConnection = async () => {
    setTesting(true);
    setError('');
    setTestStatus(null);
    try {
      const json = await blingGet('/produtos?pagina=1&limite=1', apiKey);
      if (json?.data !== undefined) {
        setTestStatus('ok');
      } else {
        throw new Error('Resposta inesperada do Bling');
      }
    } catch (e) {
      setError('Falha na conexão: ' + e.message);
      setTestStatus('fail');
    }
    setTesting(false);
  };

  const fetchProducts = async () => {
    setStep('loading');
    setError('');
    setBlingProducts([]);
    setSelected({});
    try {
      let all = [];
      let page = 1;
      while (true) {
        const json = await blingGet(`/produtos?pagina=${page}&limite=100&criterio=1`, apiKey);
        const items = json?.data || [];
        if (items.length === 0) break;
        all = [...all, ...items];
        if (items.length < 100) break;
        page++;
        if (page > 20) break;
      }
      if (all.length === 0) throw new Error('Nenhum produto encontrado no Bling.');
      setBlingProducts(all);
      const sel = {};
      all.forEach(p => { sel[p.id] = true; });
      setSelected(sel);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('idle');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    const toImport = blingProducts.filter(p => selected[p.id]);
    let created = 0, errors = 0;

    setProgressLabel('Apagando produtos existentes...');
    const existing = await base44.entities.Product.list('-created_date', 1000);
    const toDelete = company?.id
      ? existing.filter(p => p.company_id === company.id)
      : existing;
    for (const p of toDelete) {
      try { await base44.entities.Product.delete(p.id); } catch {}
    }

    for (let i = 0; i < toImport.length; i++) {
      const bp = toImport[i];
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      setProgressLabel(`Importando ${i + 1} de ${toImport.length}: ${bp.nome}`);

      let detail = null;
      try {
        const detailJson = await blingGet(`/produtos/${bp.id}`, apiKey);
        detail = detailJson?.data || null;
      } catch {}

      try {
        await base44.entities.Product.create(mapBlingProduct(detail || bp, company?.id));
        created++;
      } catch { errors++; }
    }

    setImportResult({ created, deleted: toDelete.length, errors, total: toImport.length });
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
    setStep('idle');
    setBlingProducts([]);
    setSelected({});
    setError('');
    setImportResult(null);
    setProgress(0);
    setProgressLabel('');
    setTestStatus(null);
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

          {/* Idle */}
          {step === 'idle' && (
            <div className="py-10 text-center space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {testStatus === 'ok' && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>Conexão com o Bling estabelecida com sucesso!</AlertDescription>
                </Alert>
              )}
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
                <Download className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Buscar produtos do Bling</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Conectado via API Key da empresa <strong>{company?.nome_fantasia || company?.razao_social}</strong>
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={testConnection} disabled={testing} className="gap-2">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Testar Conexão
                </Button>
                <Button onClick={fetchProducts} className="gap-2 bg-orange-500 hover:bg-orange-600">
                  <Download className="w-4 h-4" /> Buscar Produtos
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Buscando produtos no Bling...</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div className="space-y-4 py-2">
              <Alert>
                <Trash2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Todos os produtos existentes desta empresa serão <strong>apagados</strong> e substituídos pelos selecionados abaixo.
                </AlertDescription>
              </Alert>

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
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="w-10 p-2 text-left">
                          <Checkbox checked={selectedCount === blingProducts.length} onCheckedChange={toggleAll} />
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
                        <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                          <td className="p-2">
                            <Checkbox checked={!!selected[p.id]}
                              onCheckedChange={(v) => setSelected(prev => ({ ...prev, [p.id]: v }))}
                              onClick={(e) => e.stopPropagation()} />
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
                            <Badge variant={p.situacao === 'A' ? 'default' : 'secondary'} className="text-[10px] px-1.5">
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

          {/* Importing */}
          {step === 'importing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto" />
              <div>
                <p className="font-semibold">Processando...</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{progressLabel}</p>
              </div>
              <div className="max-w-xs mx-auto space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% concluído</p>
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && importResult && (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground mt-1">{importResult.total} produtos processados</p>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="bg-red-50 rounded-xl p-4 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-red-600">{importResult.deleted}</p>
                  <p className="text-xs text-red-700 mt-1">Apagados</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                  <p className="text-xs text-green-700 mt-1">Importados</p>
                </div>
                {importResult.errors > 0 && (
                  <div className="bg-orange-50 rounded-xl p-4 text-center min-w-[80px]">
                    <p className="text-2xl font-bold text-orange-600">{importResult.errors}</p>
                    <p className="text-xs text-orange-700 mt-1">Erros</p>
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
              <Button onClick={handleImport} disabled={selectedCount === 0} className="gap-2 bg-orange-500 hover:bg-orange-600">
                <Trash2 className="w-4 h-4" />
                Apagar e importar {selectedCount > 0 ? `${selectedCount} produto${selectedCount > 1 ? 's' : ''}` : ''}
              </Button>
            </>
          )}
          {(step === 'idle' || step === 'loading') && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}