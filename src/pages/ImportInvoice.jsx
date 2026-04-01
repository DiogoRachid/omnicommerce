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
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const xmlContent = await (await fetch(file_url)).text();

      const result = await base44.functions.invoke('parseNFeXml', { xml_content: xmlContent });

      if (result.data?.success && result.data?.nf) {
        setParsedData({ ...result.data, xml_url: file_url });
        toast.success('XML processado com sucesso! Revise os dados antes de confirmar.');
      } else {
        toast.error('Erro ao processar XML: ' + (result.data?.error || 'Formato inválido'));
      }
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao fazer upload: ' + err.message);
    } finally {
      setUploading(false);
    }
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

      const invoiceItems = (parsedData.nf?.items || []).map((item, idx) => ({
        ...item,
        product_id: itemMappings[idx] || null,
        vinculado: !!itemMappings[idx],
      }));

      const invoice = await base44.entities.Invoice.create({
        tipo: 'entrada',
        modelo: parsedData.nf?.modelo || '55',
        numero: parsedData.nf?.numero,
        serie: parsedData.nf?.serie,
        chave_acesso: parsedData.nf?.chave_acesso,
        data_emissao: parsedData.nf?.data_emissao,
        emitente_cnpj: parsedData.fornecedor?.cnpj,
        emitente_nome: parsedData.fornecedor?.nome,
        destinatario_cnpj: parsedData.destinatario?.cnpj,
        destinatario_nome: parsedData.destinatario?.nome,
        valor_total: parsedData.totais?.nf,
        valor_produtos: parsedData.totais?.produtos,
        valor_frete: 0,
        valor_desconto: parsedData.totais?.desconto,
        xml_url: parsedData.xml_url,
        items: invoiceItems,
        status: 'importada',
        company_id: companyId,
      });

      for (let idx = 0; idx < (parsedData.nf?.items || []).length; idx++) {
         const item = parsedData.nf.items[idx];
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
               invoice_number: parsedData.nf.numero,
               company_id: companyId,
             });
           }
         } else {
           const sku = `NF${parsedData.nf.numero || 'X'}-${idx + 1}`;
           const newProduct = await base44.entities.Product.create({
             sku,
             ean: item.ean || '',
             nome: item.descricao || `Produto NF ${idx + 1}`,
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
             invoice_number: parsedData.nf.numero,
             company_id: companyId,
           });
         }
       }

       // Cria Conta a Pagar se houver duplicatas
       if (parsedData.duplicatas && parsedData.duplicatas.length > 0) {
         for (const dup of parsedData.duplicatas) {
           await base44.entities.FinancialAccount.create({
             tipo: 'pagar',
             descricao: `NF ${parsedData.nf.numero} - ${parsedData.fornecedor.nome}`,
             valor: dup.valor,
             status: 'pendente',
             data_vencimento: dup.vencimento,
             centro_custo: 'outro',
             forma_pagamento: parsedData.forma_pagamento || 'outro',
             fornecedor_nome: parsedData.fornecedor.nome,
             invoice_id: invoice.id,
             numero_documento: `${parsedData.nf.numero}-${dup.numero}`,
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
                  <p className="font-semibold">{parsedData.nf?.numero || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Série</p>
                  <p className="font-semibold">{parsedData.nf?.serie || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emitente</p>
                  <p className="font-semibold">{parsedData.fornecedor?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-semibold">R$ {(parsedData.totais?.nf || 0).toFixed(2)}</p>
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
                  {(parsedData.nf?.items || []).map((item, idx) => {
                    const linkedProduct = itemMappings[idx] ? products.find(p => p.id === itemMappings[idx]) : null;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                        <TableCell className="text-sm font-mono">{item.ean || '-'}</TableCell>
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