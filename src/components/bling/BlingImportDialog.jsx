import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Package, Download, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Image, Scale, Barcode, FileText, Trash2
} from 'lucide-react';

const BLING_API = 'https://api.bling.com.br/Api/v3';
const CLIENT_ID = 'cc8b8d56d863328ccef20525abc2e7649d03b4fe';
const CLIENT_SECRET = '5717f3608cd49d9a3b0bfd04aa63d44812778b57c58b7958e4552672ec9f';

// Troca o authorization code por access token via proxy LLM (CORS workaround)
async function exchangeCodeForToken(code, redirectUri) {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(`${BLING_API}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error_description || `Erro ${res.status} ao obter token`);
  }
  return res.json();
}

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
  const [step, setStep] = useState('auth'); // auth | preview | importing | done
  const [accessToken, setAccessToken] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [blingProducts, setBlingProducts] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importResult, setImportResult] = useState(null);

  // Token direto (salvo na empresa) ou via OAuth
  const savedToken = company?.bling_api_key;

  const redirectUri = window.location.origin + window.location.pathname;

  const oauthUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&state=bling_import&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const handleExchangeCode = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await exchangeCodeForToken(authCode.trim(), redirectUri);
      setAccessToken(data.access_token);
      setStep('preview');
      await doFetchProducts(data.access_token);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleUseDirectToken = async () => {
    setAccessToken(savedToken);
    setStep('preview');
    await doFetchProducts(savedToken);
  };

  const doFetchProducts = async (token) => {
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
        if (page > 20) break;
      }
      setBlingProducts(all);
      const sel = {};
      all.forEach(p => { sel[p.id] = true; });
      setSelected(sel);
    } catch (e) {
      setError(e.message);
      setStep('auth');
    }
    setLoading(false);
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    const token = accessToken || savedToken;
    const toImport = blingProducts.filter(p => selected[p.id]);
    let created = 0, errors = 0;

    // 1. Apaga todos os produtos existentes da empresa
    setProgressLabel('Apagando produtos existentes...');
    const existingRaw = await base44.entities.Product.list('-created_date', 1000);
    const toDelete = company?.id
      ? existingRaw.filter(p => p.company_id === company.id)
      : existingRaw;

    for (const p of toDelete) {
      try { await base44.entities.Product.delete(p.id); } catch {}
    }

    // 2. Importa os produtos do Bling
    for (let i = 0; i < toImport.length; i++) {
      const bp = toImport[i];
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      setProgressLabel(`Importando ${i + 1} de ${toImport.length}: ${bp.nome}`);

      const detail = await fetchBlingProductDetail(token, bp.id);
      const productData = mapBlingProduct(detail || bp, company?.id);

      try {
        await base44.entities.Product.create(productData);
        created++;
      } catch {
        errors++;
      }
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
    setStep(savedToken ? 'auth' : 'auth');
    setBlingProducts([]);
    setSelected({});
    setError('');
    setImportResult(null);
    setProgress(0);
    setProgressLabel('');
    setAuthCode('');
    setAccessToken('');
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

          {/* Step: Auth */}
          {step === 'auth' && (
            <div className="space-y-5 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {savedToken && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Usar token salvo na empresa</h3>
                  <p className="text-xs text-muted-foreground">Esta empresa já possui um Access Token configurado. Clique para usá-lo diretamente.</p>
                  <Button onClick={handleUseDirectToken} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Usar token salvo e buscar produtos
                  </Button>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm">Autenticar via OAuth2</h3>
                <p className="text-xs text-muted-foreground">
                  Clique no botão abaixo para autorizar o acesso ao Bling. Após autorizar, você será redirecionado — copie o <strong>código</strong> que aparecer na URL (<code>?code=...</code>) e cole abaixo.
                </p>
                <a href={oauthUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2 w-full">
                    <Download className="w-4 h-4 text-orange-500" />
                    Autorizar no Bling (abre nova aba)
                  </Button>
                </a>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cole o código de autorização aqui</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="código retornado na URL..."
                      value={authCode}
                      onChange={e => setAuthCode(e.target.value)}
                    />
                    <Button onClick={handleExchangeCode} disabled={!authCode.trim() || loading} className="gap-2 shrink-0">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continuar'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4 py-2">
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

              {!loading && blingProducts.length > 0 && (
                <div className="space-y-3">
                  <Alert>
                    <Trash2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Atenção:</strong> Todos os produtos existentes desta empresa serão <strong>apagados</strong> e substituídos pelos produtos do Bling selecionados abaixo.
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
                      <Button variant="outline" size="sm" onClick={() => doFetchProducts(accessToken || savedToken)} className="gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
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
                <p className="font-semibold">Processando...</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{progressLabel}</p>
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
          {step === 'preview' && !loading && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="gap-2 bg-orange-500 hover:bg-orange-600"
              >
                <Trash2 className="w-4 h-4" />
                Apagar existentes e importar {selectedCount > 0 ? `${selectedCount} produto${selectedCount > 1 ? 's' : ''}` : ''}
              </Button>
            </>
          )}
          {(step === 'auth' || (step === 'preview' && loading)) && (
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