import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Upload, FileText, Link2, Plus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportInvoice() {
  const navigate = useNavigate();
  const { selectedCompany } = useOutletContext();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [itemMappings, setItemMappings] = useState({});
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingIndex, setLinkingIndex] = useState(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Product.filter({ company_id: selectedCompany }, '-created_date', 500);
      }
      return base44.entities.Product.list('-created_date', 500);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          numero_nf: { type: "string" },
          serie: { type: "string" },
          chave_acesso: { type: "string" },
          data_emissao: { type: "string" },
          emitente_cnpj: { type: "string" },
          emitente_nome: { type: "string" },
          destinatario_cnpj: { type: "string" },
          destinatario_nome: { type: "string" },
          valor_total: { type: "number" },
          valor_produtos: { type: "number" },
          valor_frete: { type: "number" },
          valor_desconto: { type: "number" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: { type: "string" },
                produto_ean: { type: "string" },
                ncm: { type: "string" },
                cfop: { type: "string" },
                quantidade: { type: "number" },
                valor_unitario: { type: "number" },
                valor_total: { type: "number" },
                unidade: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (result.status === 'success') {
      setParsedData({ ...result.output, xml_url: file_url });
    } else {
      toast.error('Erro ao processar XML: ' + (result.details || 'Formato inválido'));
    }
    setUploading(false);
  };

  const openLinkDialog = (index) => {
    setLinkingIndex(index);
    setShowLinkDialog(true);
  };

  const linkProduct = (productId) => {
    setItemMappings(prev => ({ ...prev, [linkingIndex]: productId }));
    setShowLinkDialog(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const companyId = selectedCompany !== 'all' ? selectedCompany : undefined;

      const invoiceItems = (parsedData.items || []).map((item, idx) => ({
        ...item,
        product_id: itemMappings[idx] || null,
        vinculado: !!itemMappings[idx],
      }));

      const invoice = await base44.entities.Invoice.create({
        tipo: 'entrada',
        modelo: '55',
        numero: parsedData.numero_nf,
        serie: parsedData.serie,
        chave_acesso: parsedData.chave_acesso,
        data_emissao: parsedData.data_emissao,
        emitente_cnpj: parsedData.emitente_cnpj,
        emitente_nome: parsedData.emitente_nome,
        destinatario_cnpj: parsedData.destinatario_cnpj,
        destinatario_nome: parsedData.destinatario_nome,
        valor_total: parsedData.valor_total,
        valor_produtos: parsedData.valor_produtos,
        valor_frete: parsedData.valor_frete,
        valor_desconto: parsedData.valor_desconto,
        xml_url: parsedData.xml_url,
        items: invoiceItems,
        status: 'importada',
        company_id: companyId,
      });

      for (let idx = 0; idx < (parsedData.items || []).length; idx++) {
        const item = parsedData.items[idx];
        const linkedProductId = itemMappings[idx];

        if (linkedProductId) {
          const product = products.find(p => p.id === linkedProductId);
          if (product) {
            const newStock = (product.estoque_atual || 0) + (item.quantidade || 0);
            await base44.entities.Product.update(product.id, { estoque_atual: newStock });
            await base44.entities.StockMovement.create({
              product_id: product.id,
              product_name: product.nome,
              tipo: 'entrada',
              quantidade: item.quantidade || 0,
              custo_unitario: item.valor_unitario || 0,
              referencia_tipo: 'nfe_entrada',
              referencia_id: invoice.id,
              invoice_number: parsedData.numero_nf,
              company_id: companyId,
            });
          }
        } else {
          const sku = `NF${parsedData.numero_nf || 'X'}-${idx + 1}`;
          const newProduct = await base44.entities.Product.create({
            sku,
            ean: item.produto_ean || '',
            nome: item.produto_nome || `Produto NF ${idx + 1}`,
            ncm: item.ncm || '',
            unidade_medida: item.unidade || 'UN',
            preco_custo: item.valor_unitario || 0,
            estoque_atual: item.quantidade || 0,
            estoque_minimo: 0,
            origem: 'xml_nfe',
            ativo: true,
            company_id: companyId,
          });
          await base44.entities.StockMovement.create({
            product_id: newProduct.id,
            product_name: newProduct.nome,
            tipo: 'entrada',
            quantidade: item.quantidade || 0,
            custo_unitario: item.valor_unitario || 0,
            referencia_tipo: 'nfe_entrada',
            referencia_id: invoice.id,
            invoice_number: parsedData.numero_nf,
            company_id: companyId,
          });
        }
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      toast.success('Nota fiscal importada com sucesso!');
      navigate('/notas-fiscais');
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/notas-fiscais')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importar Nota Fiscal (XML)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Faça upload do XML da NF-e para dar entrada no estoque
          </p>
        </div>
      </div>

      {!parsedData ? (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload do XML da NF-e</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Selecione o arquivo XML da nota fiscal eletrônica para importar os produtos e dar entrada no estoque
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors font-medium text-sm">
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
              ) : (
                <><Upload className="w-4 h-4" /> Selecionar Arquivo XML</>
              )}
              <input type="file" accept=".xml" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Nota Fiscal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Número</p>
                  <p className="font-semibold">{parsedData.numero_nf || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Série</p>
                  <p className="font-semibold">{parsedData.serie || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emitente</p>
                  <p className="font-semibold">{parsedData.emitente_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-semibold">R$ {(parsedData.valor_total || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Itens da Nota — Vinculação de Produtos</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Vincule cada item a um produto existente ou será criado um novo
                </p>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item da NF</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead>Vinculação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(parsedData.items || []).map((item, idx) => {
                    const linkedProduct = itemMappings[idx] ? products.find(p => p.id === itemMappings[idx]) : null;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-medium">{item.produto_nome}</TableCell>
                        <TableCell className="text-sm font-mono">{item.produto_ean || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantidade}</TableCell>
                        <TableCell className="text-right text-sm">R$ {(item.valor_unitario || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {linkedProduct ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-[10px] gap-1">
                                <Check className="w-3 h-3" /> {linkedProduct.nome} ({linkedProduct.sku})
                              </Badge>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                setItemMappings(prev => {
                                  const copy = { ...prev };
                                  delete copy[idx];
                                  return copy;
                                });
                              }}>
                                Desvincular
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">Novo produto será criado</Badge>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openLinkDialog(idx)}>
                                <Link2 className="w-3 h-3" /> Vincular
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setParsedData(null); setItemMappings({}); }}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Confirmar Importação</>
              )}
            </Button>
          </div>
        </>
      )}

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a Produto Existente</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
            {products.filter(p => p.ativo).map((p) => (
              <button
                key={p.id}
                onClick={() => linkProduct(p.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku} · EAN: {p.ean || 'N/A'}</p>
                </div>
                <p className="text-xs text-muted-foreground">Estoque: {p.estoque_atual || 0}</p>
              </button>
            ))}
            {products.filter(p => p.ativo).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto cadastrado</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}