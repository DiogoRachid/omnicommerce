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
  RefreshCw, Trash2, ChevronRight, ChevronDown, ExternalLink, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

async function callProxy(action, payload = {}) {
  const res = await base44.functions.invoke('blingProxy', { action, payload });
  return res.data;
}

function buildFotos(p) {
  const fotos = [];
  if (p.imagemURL) fotos.push(p.imagemURL);
  if (Array.isArray(p.imagens)) {
    p.imagens.forEach(img => {
      const url = img.link || img.url || img;
      if (url && !fotos.includes(url)) fotos.push(url);
    });
  }
  return fotos;
}

function buildDimensoes(p) {
  const d = p.dimensoes || {};
  return {
    altura_cm: d.altura ? parseFloat(d.altura) : undefined,
    largura_cm: d.largura ? parseFloat(d.largura) : undefined,
    comprimento_cm: d.profundidade ? parseFloat(d.profundidade) : undefined,
    peso_bruto_kg: d.pesoBruto ? parseFloat(d.pesoBruto) : undefined,
    peso_liquido_kg: d.pesoLiquido ? parseFloat(d.pesoLiquido) : undefined,
  };
}

function buildBaseProduct(p, companyId) {
  const dims = buildDimensoes(p);
  const fotos = buildFotos(p);
  const base = {
    ativo: p.situacao === 'A',
    origem: 'importacao',
    company_id: companyId || undefined,
    bling_id: String(p.id),
    nome: p.nome || '-',
    sku: p.codigo || `BLING-${p.id}`,
    ean: p.gtin || undefined,
    preco_venda: p.preco ? parseFloat(p.preco) : undefined,
    preco_custo: p.precoCusto ? parseFloat(p.precoCusto) : undefined,
    marca: p.marca || undefined,
    descricao: p.descricaoCurta || undefined,
    ncm: p.tributacao?.ncm || undefined,
    unidade_medida: p.unidade || 'UN',
    estoque_atual: 0,
    estoque_minimo: 0,
    fotos: fotos.length > 0 ? fotos : undefined,
    ...dims,
  };
  // Remove undefined keys
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined));
}

export default function BlingImportDialog({ company, open, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('idle'); // idle | loading | preview | importing | done
  const [produtosSimples, setProdutosSimples] = useState([]);
  const [produtosPai, setProdutosPai] = useState([]);
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importResult, setImportResult] = useState(null);

  const fetchProducts = async () => {
    setStep('loading');
    setError('');
    setProdutosSimples([]);
    setProdutosPai([]);
    setSelected({});
    setExpanded({});
    try {
      const result = await callProxy('listProductsFull');
      if (!result) throw new Error('Resposta vazia do servidor.');

      const simples = result.produtos_simples || [];
      const pais = result.produtos_pai || [];

      if (simples.length === 0 && pais.length === 0) {
        throw new Error('Nenhum produto encontrado no Bling.');
      }

      setProdutosSimples(simples);
      setProdutosPai(pais);

      const sel = {};
      simples.forEach(p => { sel[`s_${p.id}`] = true; });
      pais.forEach(p => { sel[`pai_${p.id}`] = true; });
      setSelected(sel);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('idle');
    }
  };

  const getStockForProduct = async (blingId) => {
    try {
      const res = await callProxy('getProductStock', { bling_id: blingId });
      return res?.saldo || 0;
    } catch {
      return 0;
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    let created = 0, errors = 0;

    // Apagar produtos existentes da empresa
    setProgressLabel('Apagando produtos existentes...');
    const existing = await base44.entities.Product.list('-created_date', 2000);
    const toDelete = company?.id ? existing.filter(p => p.company_id === company.id) : existing;
    for (const p of toDelete) {
      try { await base44.entities.Product.delete(p.id); } catch {}
    }

    const simplesSelected = produtosSimples.filter(p => selected[`s_${p.id}`]);
    const paisSelected = produtosPai.filter(p => selected[`pai_${p.id}`]);
    const total = simplesSelected.length + paisSelected.length;
    let done = 0;

    // Importar produtos simples
    for (const p of simplesSelected) {
      done++;
      setProgress(Math.round((done / total) * 100));
      setProgressLabel(`Importando simples ${done}/${total}: ${p.nome}`);
      try {
        const estoque = await getStockForProduct(p.id);
        const record = { ...buildBaseProduct(p, company?.id), tipo: 'simples', estoque_atual: estoque };
        await base44.entities.Product.create(record);
        created++;
      } catch { errors++; }
    }

    // Importar produtos pai e suas variações
    for (const p of paisSelected) {
      done++;
      setProgress(Math.round((done / total) * 100));
      setProgressLabel(`Importando pai ${done}/${total}: ${p.nome}`);
      try {
        const paiRecord = {
          ...buildBaseProduct(p, company?.id),
          tipo: 'pai',
          sku: `PAI-${p.id}`,
          estoque_atual: 0,
        };
        const paiCriado = await base44.entities.Product.create(paiRecord);
        created++;

        // Criar cada variação
        const variacoes = p.variacoes || [];
        for (const v of variacoes) {
          try {
            const attrs = (v.atributos || []).map(a => `${a.nome}: ${a.valor}`).join(' | ');
            const nomeVariacao = `${p.nome}${attrs ? ` - ${attrs}` : ''}`;
            const estoqueVar = v.estoque || 0;
            const fotos = buildFotos(p); // herda fotos do pai
            const dims = buildDimensoes(p); // herda dimensões do pai

            const varRecord = {
              nome: nomeVariacao,
              sku: v.codigo || `VAR-${v.id}`,
              ean: v.gtin || undefined,
              preco_venda: v.preco ? parseFloat(v.preco) : undefined,
              ativo: p.situacao === 'A',
              origem: 'importacao',
              company_id: company?.id || undefined,
              bling_id: String(v.id),
              bling_pai_id: String(p.id),
              produto_pai_id: paiCriado.id,
              tipo: 'variacao',
              variacoes_atributos: attrs || undefined,
              estoque_atual: estoqueVar,
              estoque_minimo: 0,
              fotos: fotos.length > 0 ? fotos : undefined,
              ...dims,
            };
            await base44.entities.Product.create(
              Object.fromEntries(Object.entries(varRecord).filter(([, val]) => val !== undefined))
            );
            created++;
          } catch { errors++; }
        }
      } catch { errors++; }
    }

    setImportResult({ created, deleted: toDelete.length, errors, total: total });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setStep('done');
  };

  const toggleSelected = (key) => setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleExpanded = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = (val) => {
    const sel = {};
    produtosSimples.forEach(p => { sel[`s_${p.id}`] = val; });
    produtosPai.forEach(p => { sel[`pai_${p.id}`] = val; });
    setSelected(sel);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalCount = produtosSimples.length + produtosPai.length;

  const handleClose = () => {
    setStep('idle');
    setProdutosSimples([]);
    setProdutosPai([]);
    setSelected({});
    setExpanded({});
    setError('');
    setImportResult(null);
    setProgress(0);
    setProgressLabel('');
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
                  <AlertDescription className="space-y-2">
                    <p>{error}</p>
                    {(error.includes('token') || error.includes('Token')) && (
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
                  Importa produtos simples e produtos com variações (cor, tamanho etc), fotos, dimensões e estoque real.
                </p>
              </div>
              <Button onClick={fetchProducts} className="gap-2 bg-orange-500 hover:bg-orange-600">
                <Download className="w-4 h-4" /> Buscar Produtos
              </Button>
            </div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
              <p className="text-sm font-medium">Buscando e analisando produtos no Bling...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos. Produtos com variações são buscados individualmente.</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div className="space-y-4 py-2">
              <Alert>
                <Trash2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Todos os produtos existentes desta empresa serão <strong>apagados</strong> e substituídos pelos selecionados.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{totalCount} produtos encontrados</p>
                  <Badge variant="secondary">{produtosSimples.length} simples</Badge>
                  <Badge variant="outline">{produtosPai.length} com variações</Badge>
                  <Badge className="bg-primary/10 text-primary border-0">{selectedCount} selecionados</Badge>
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
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="w-8 p-2">
                          <Checkbox checked={selectedCount === totalCount && totalCount > 0} onCheckedChange={toggleAll} />
                        </th>
                        <th className="p-2 text-left font-medium text-muted-foreground">Produto</th>
                        <th className="p-2 text-left font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                        <th className="p-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Preço</th>
                        <th className="p-2 text-center font-medium text-muted-foreground">Tipo</th>
                        <th className="p-2 text-center font-medium text-muted-foreground">Sit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Produtos simples */}
                      {produtosSimples.map(p => (
                        <tr key={`s_${p.id}`}
                          className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => toggleSelected(`s_${p.id}`)}>
                          <td className="p-2">
                            <Checkbox checked={!!selected[`s_${p.id}`]}
                              onCheckedChange={() => toggleSelected(`s_${p.id}`)}
                              onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {p.imagemURL
                                ? <img src={p.imagemURL} className="w-7 h-7 rounded object-cover flex-shrink-0" alt="" />
                                : <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                  </div>
                              }
                              <span className="font-medium truncate max-w-[180px]">{p.nome}</span>
                            </div>
                          </td>
                          <td className="p-2 font-mono text-xs hidden sm:table-cell">{p.codigo || '-'}</td>
                          <td className="p-2 text-right hidden sm:table-cell">
                            {p.preco ? `R$ ${parseFloat(p.preco).toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="secondary" className="text-[10px] px-1.5">Simples</Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={p.situacao === 'A' ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                              {p.situacao === 'A' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                        </tr>
                      ))}

                      {/* Produtos pai com variações */}
                      {produtosPai.map(p => (
                        <React.Fragment key={`pai_${p.id}`}>
                          <tr className="border-t bg-orange-50/50 hover:bg-orange-50 cursor-pointer"
                            onClick={() => toggleSelected(`pai_${p.id}`)}>
                            <td className="p-2">
                              <Checkbox checked={!!selected[`pai_${p.id}`]}
                                onCheckedChange={() => toggleSelected(`pai_${p.id}`)}
                                onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <button
                                  className="p-0.5 rounded hover:bg-orange-200 transition-colors flex-shrink-0"
                                  onClick={e => { e.stopPropagation(); toggleExpanded(p.id); }}>
                                  {expanded[p.id]
                                    ? <ChevronDown className="w-4 h-4 text-orange-600" />
                                    : <ChevronRight className="w-4 h-4 text-orange-600" />
                                  }
                                </button>
                                {p.imagemURL
                                  ? <img src={p.imagemURL} className="w-7 h-7 rounded object-cover flex-shrink-0" alt="" />
                                  : <div className="w-7 h-7 rounded bg-orange-100 flex items-center justify-center flex-shrink-0">
                                      <Layers className="w-3.5 h-3.5 text-orange-500" />
                                    </div>
                                }
                                <div>
                                  <span className="font-medium text-orange-900">{p.nome}</span>
                                  <span className="text-xs text-orange-600 ml-1">({p.variacoes?.length || 0} variações)</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 font-mono text-xs hidden sm:table-cell text-muted-foreground">PAI-{p.id}</td>
                            <td className="p-2 text-right hidden sm:table-cell text-muted-foreground text-xs">—</td>
                            <td className="p-2 text-center">
                              <Badge className="text-[10px] px-1.5 bg-orange-100 text-orange-700 border-0">Pai</Badge>
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant={p.situacao === 'A' ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                                {p.situacao === 'A' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </td>
                          </tr>
                          {expanded[p.id] && (p.variacoes || []).map(v => (
                            <tr key={`var_${v.id}`} className="border-t bg-muted/20">
                              <td className="p-2"></td>
                              <td className="p-2 pl-10">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">
                                    {v.atributos?.map(a => `${a.nome}: ${a.valor}`).join(' | ') || v.nome}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2 font-mono text-xs text-muted-foreground hidden sm:table-cell">{v.codigo || '-'}</td>
                              <td className="p-2 text-right text-xs hidden sm:table-cell">
                                {v.preco ? `R$ ${parseFloat(v.preco).toFixed(2)}` : '-'}
                              </td>
                              <td className="p-2 text-center">
                                <Badge variant="outline" className="text-[10px] px-1.5">Variação</Badge>
                              </td>
                              <td className="p-2 text-center">
                                <span className="text-xs text-muted-foreground">est: {v.estoque || 0}</span>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
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
                <p className="text-sm text-muted-foreground mt-1">{importResult.total} produtos/variações processados</p>
              </div>
              <div className="flex gap-4 justify-center flex-wrap">
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