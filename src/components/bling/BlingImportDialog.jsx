import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Download, CheckCircle2, AlertCircle, Loader2, RefreshCw, Trash2, Settings2, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// Campos do sistema
const SYSTEM_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'sku', label: 'SKU / Código', required: true },
  { key: 'ean', label: 'EAN / GTIN' },
  { key: 'preco_venda', label: 'Preço de Venda' },
  { key: 'preco_custo', label: 'Preço de Custo' },
  { key: 'marca', label: 'Marca' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'ncm', label: 'NCM' },
  { key: 'unidade_medida', label: 'Unidade' },
  { key: 'peso_bruto_kg', label: 'Peso Bruto (kg)' },
  { key: 'estoque_atual', label: 'Estoque Atual' },
];

// Mapeamento padrão: campo_sistema -> campo_bling
const DEFAULT_MAPPING = {
  nome: 'nome',
  sku: 'codigo',
  ean: 'gtin',
  preco_venda: 'preco',
  preco_custo: 'preco',
  marca: 'marca',
  descricao: 'descricaoCurta',
  ncm: 'tributacao.ncm',
  unidade_medida: 'unidade',
  peso_bruto_kg: 'dimensoes.pesoBruto',
  estoque_atual: '', // não tem no Bling por padrão
};

// Produto de exemplo da API do Bling para mostrar os campos disponíveis
const EXAMPLE_BLING_PRODUCT = {
  id: 123456,
  nome: "Tênis Esportivo Adulto",
  codigo: "TEN-ESP-001",
  gtin: "7891234567890",
  preco: 299.90,
  situacao: "A",
  marca: "Nike",
  unidade: "UN",
  descricaoCurta: "Tênis esportivo para corrida",
  descricaoComplementar: "Descrição detalhada do produto...",
  tributacao: { ncm: "64029990", cest: "" },
  dimensoes: { pesoBruto: 0.8, pesoLiquido: 0.7, altura: 12, largura: 22, profundidade: 32 },
  estoque: { saldoFisico: 10, saldoVirtual: 10 },
};

// Todos os campos disponíveis no produto Bling (para o select de mapeamento)
const BLING_AVAILABLE_FIELDS = [
  { value: '__none__', label: '— não mapear —' },
  { value: 'nome', label: 'nome' },
  { value: 'codigo', label: 'codigo (SKU)' },
  { value: 'gtin', label: 'gtin (EAN)' },
  { value: 'preco', label: 'preco' },
  { value: 'marca', label: 'marca' },
  { value: 'unidade', label: 'unidade' },
  { value: 'descricaoCurta', label: 'descricaoCurta' },
  { value: 'descricaoComplementar', label: 'descricaoComplementar' },
  { value: 'tributacao.ncm', label: 'tributacao.ncm' },
  { value: 'tributacao.cest', label: 'tributacao.cest' },
  { value: 'dimensoes.pesoBruto', label: 'dimensoes.pesoBruto' },
  { value: 'dimensoes.pesoLiquido', label: 'dimensoes.pesoLiquido' },
  { value: 'dimensoes.altura', label: 'dimensoes.altura' },
  { value: 'dimensoes.largura', label: 'dimensoes.largura' },
  { value: 'dimensoes.profundidade', label: 'dimensoes.profundidade' },
  { value: 'estoque.saldoFisico', label: 'estoque.saldoFisico' },
];

function getNestedValue(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function applyMapping(blingProduct, mapping, companyId) {
  const result = {
    ativo: blingProduct.situacao === 'A',
    origem: 'importacao',
    company_id: companyId || undefined,
    bling_id: String(blingProduct.id),
    estoque_atual: 0,
    estoque_minimo: 0,
  };
  for (const [sysField, blingPath] of Object.entries(mapping)) {
    if (!blingPath) continue;
    const val = getNestedValue(blingProduct, blingPath);
    if (val === undefined || val === null || val === '') continue;
    const numFields = ['preco_venda', 'preco_custo', 'peso_bruto_kg', 'peso_liquido_kg', 'altura_cm', 'largura_cm', 'comprimento_cm', 'estoque_atual'];
    result[sysField] = numFields.includes(sysField) ? parseFloat(val) || 0 : String(val);
  }
  if (!result.sku) result.sku = `BLING-${blingProduct.id}`;
  return result;
}

export default function BlingImportDialog({ company, open, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('idle'); // idle | loading | mapping | preview | importing | done
  const [blingProducts, setBlingProducts] = useState([]);
  const [rawSample, setRawSample] = useState(null); // primeiro produto bruto da API para mostrar campos reais
  const [mapping, setMapping] = useState(DEFAULT_MAPPING);
  const [selected, setSelected] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importResult, setImportResult] = useState(null);

  // Verifica se o token está válido antes de buscar
  const validateToken = async () => {
    const tokens = await base44.entities.BlingToken.list();
    if (!tokens || tokens.length === 0) {
      throw new Error('Nenhum token Bling encontrado. Acesse Configurações → Integração Bling e clique em "Autorizar / Reconectar Bling".');
    }
    const t = tokens[0];
    if (t.expires_at) {
      const expiresAt = new Date(t.expires_at);
      const minutesLeft = Math.round((expiresAt - new Date()) / 1000 / 60);
      if (expiresAt < new Date()) {
        throw new Error(`Token Bling expirado em ${expiresAt.toLocaleString('pt-BR')}. Acesse Configurações → Integração Bling e clique em "Renovar Token" ou "Autorizar / Reconectar Bling".`);
      }
      if (minutesLeft < 5) {
        throw new Error(`Token Bling expira em ${minutesLeft} minuto(s). Acesse Configurações → Integração Bling e clique em "Renovar Token".`);
      }
    }
    return t;
  };

  // Busca produtos via agente bling_integration
  const fetchProducts = async () => {
    setStep('loading');
    setError('');
    setBlingProducts([]);
    setSelected({});
    setRawSample(null);
    try {
      const tokenRecord = await validateToken();

      // Busca via agente bling_integration (único método que funciona sem CORS e com token real)
      const conversation = await base44.agents.createConversation({ agent_name: 'bling_integration' });

      const rawResponse = await new Promise((resolve, reject) => {
        let resolved = false;
        const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
          const messages = data.messages || [];
          const last = messages[messages.length - 1];
          if (last?.role === 'assistant' && last?.content && !resolved) {
            const hasRunning = (last.tool_calls || []).some(
              tc => tc.status === 'running' || tc.status === 'in_progress'
            );
            if (!hasRunning) {
              resolved = true;
              unsubscribe();
              resolve(last.content);
            }
          }
        });

        base44.agents.addMessage(conversation, {
          role: 'user',
          content: `Busque TODOS os produtos do Bling usando o access_token armazenado na entidade BlingToken.
Faça GET https://api.bling.com.br/Api/v3/produtos?pagina=1&limite=100&criterio=5&tipo=T com Authorization: Bearer {token}.
Continue nas próximas páginas enquanto houver 100 produtos.
Retorne APENAS um JSON array com todos os produtos encontrados, sem texto adicional.
Formato: [{"id":123,"nome":"...","codigo":"...","preco":0,"situacao":"A","marca":"...","gtin":"...","unidade":"...","descricaoCurta":"...","tributacao":{"ncm":""},"dimensoes":{"pesoBruto":0}}]`,
        }).catch(reject);

        setTimeout(() => {
          if (!resolved) { resolved = true; unsubscribe(); reject(new Error('Timeout: agente não respondeu em 120s.')); }
        }, 120000);
      });

      // Parse da resposta do agente
      let allProducts = [];
      const jsonMatch = rawResponse.match(/(\[[\s\S]*\])/);
      if (jsonMatch) {
        try { allProducts = JSON.parse(jsonMatch[1]); } catch {}
      }
      if (!Array.isArray(allProducts) || allProducts.length === 0) {
        throw new Error('O agente não retornou produtos. Verifique se o token Bling está válido nas Configurações.');
      }

      setRawSample(allProducts[0]);
      setBlingProducts(allProducts);
      const sel = {};
      allProducts.forEach(p => { sel[p.id] = true; });
      setSelected(sel);

      const sample = allProducts[0];
      const hasMappingGap = !getNestedValue(sample, mapping.nome) && !getNestedValue(sample, mapping.sku);
      setStep(hasMappingGap ? 'mapping' : 'preview');
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
    const toDelete = company?.id ? existing.filter(p => p.company_id === company.id) : existing;
    for (const p of toDelete) {
      try { await base44.entities.Product.delete(p.id); } catch {}
    }

    for (let i = 0; i < toImport.length; i++) {
      const bp = toImport[i];
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      setProgressLabel(`Importando ${i + 1} de ${toImport.length}: ${bp.nome || bp.codigo || bp.id}`);
      try {
        await base44.entities.Product.create(applyMapping(bp, mapping, company?.id));
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
    setRawSample(null);
    onClose();
  };

  const sampleToShow = rawSample || EXAMPLE_BLING_PRODUCT;
  const isExampleSample = !rawSample;

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
                  <AlertDescription className="space-y-2">
                    <p>{error}</p>
                    {(error.includes('token') || error.includes('Token') || error.includes('Bling')) && (
                      <Link to="/configuracoes" onClick={handleClose}>
                        <Button size="sm" variant="outline" className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 mt-1">
                          <ExternalLink className="w-3 h-3" /> Ir para Configurações
                        </Button>
                      </Link>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
                <Download className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Buscar produtos do Bling</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Empresa: <strong>{company?.nome_fantasia || company?.razao_social}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Busca todos os produtos cadastrados no Bling (criterio=5, tipo=T)
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { setRawSample(null); setStep('mapping'); }} variant="outline" className="gap-2">
                  <Settings2 className="w-4 h-4" /> Configurar Mapeamento
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
              <p className="text-sm text-muted-foreground">Buscando produtos diretamente na API do Bling...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          )}

          {/* Mapeamento de campos */}
          {step === 'mapping' && (
            <div className="space-y-4 py-2">
              <Alert className={isExampleSample ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}>
                <AlertCircle className={`h-4 w-4 ${isExampleSample ? 'text-yellow-600' : 'text-blue-600'}`} />
                <AlertDescription className={isExampleSample ? 'text-yellow-800' : 'text-blue-800'}>
                  {isExampleSample
                    ? <><strong>Exemplo de estrutura:</strong> Abaixo está um produto de exemplo para referência. Busque os produtos primeiro para ver a estrutura real da sua conta Bling.</>
                    : <><strong>Estrutura real detectada.</strong> Configure como os campos do Bling mapeiam para os campos do sistema.</>
                  }
                </AlertDescription>
              </Alert>

              {/* Produto de exemplo / real */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted px-3 py-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {isExampleSample ? 'Exemplo de produto Bling (estrutura de campos)' : 'Produto real da sua conta Bling'}
                  </p>
                  <Badge variant="outline" className="text-[10px]">JSON</Badge>
                </div>
                <pre className="text-xs p-3 bg-slate-950 text-green-400 overflow-x-auto max-h-40 leading-5">
{JSON.stringify(sampleToShow, null, 2)}
                </pre>
              </div>

              {/* Tabela de mapeamento */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Mapeamento de campos
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left font-medium text-muted-foreground text-xs">Campo do Sistema</th>
                        <th className="p-2 text-center text-muted-foreground text-xs"><ArrowRight className="w-3 h-3 inline" /></th>
                        <th className="p-2 text-left font-medium text-muted-foreground text-xs">Campo no Bling</th>
                        <th className="p-2 text-left font-medium text-muted-foreground text-xs">Valor de exemplo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SYSTEM_FIELDS.map(f => (
                        <tr key={f.key} className="border-t">
                          <td className="p-2">
                            <span className="font-medium text-xs">{f.label}</span>
                            {f.required && <span className="text-destructive ml-1 text-xs">*</span>}
                          </td>
                          <td className="p-2 text-center text-muted-foreground">→</td>
                          <td className="p-2">
                            <Select
                              value={mapping[f.key] || '__none__'}
                              onValueChange={v => setMapping(m => ({ ...m, [f.key]: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="não mapear" />
                              </SelectTrigger>
                              <SelectContent>
                                {BLING_AVAILABLE_FIELDS.map(bf => (
                                  <SelectItem key={bf.value} value={bf.value} className="text-xs">{bf.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 font-mono text-xs text-muted-foreground">
                            {mapping[f.key]
                              ? String(getNestedValue(sampleToShow, mapping[f.key]) ?? '—').slice(0, 30)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
                  <Button variant="outline" size="sm" onClick={() => setStep('mapping')} className="gap-1">
                    <Settings2 className="w-3.5 h-3.5" /> Mapeamento
                  </Button>
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
                            <p className="font-medium truncate max-w-[200px]">
                              {getNestedValue(p, mapping.nome) || p.nome || '-'}
                            </p>
                            {(getNestedValue(p, mapping.marca) || p.marca) && (
                              <p className="text-xs text-muted-foreground">{getNestedValue(p, mapping.marca) || p.marca}</p>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">{getNestedValue(p, mapping.sku) || p.codigo || '-'}</td>
                          <td className="p-2 font-mono text-xs">{getNestedValue(p, mapping.ean) || p.gtin || '-'}</td>
                          <td className="p-2 text-right">
                            {(getNestedValue(p, mapping.preco_venda) || p.preco)
                              ? `R$ ${parseFloat(getNestedValue(p, mapping.preco_venda) || p.preco).toFixed(2)}`
                              : '-'}
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
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              {blingProducts.length > 0 && (
                <Button variant="outline" onClick={() => setStep('preview')}>Voltar à lista</Button>
              )}
              <Button onClick={blingProducts.length > 0 ? () => setStep('preview') : fetchProducts} className="gap-2 bg-orange-500 hover:bg-orange-600">
                {blingProducts.length > 0 ? 'Aplicar mapeamento' : <><Download className="w-4 h-4" /> Buscar com este mapeamento</>}
              </Button>
            </>
          )}
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