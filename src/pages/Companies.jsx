import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, Plus, Check, X, Download } from 'lucide-react';
import BlingImportDialog from '@/components/bling/BlingImportDialog';

const emptyCompany = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
  regime_tributario: 'simples_nacional', telefone: '', email: '',
  bling_api_key: '', bling_integrated: false, status: 'ativa',
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
};

export default function Companies() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState(emptyCompany);
  const [blingImportCompany, setBlingImportCompany] = useState(null);
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingCompany) {
        return base44.entities.Company.update(editingCompany.id, data);
      }
      return base44.entities.Company.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowDialog(false);
      setEditingCompany(null);
      setForm(emptyCompany);
    },
  });

  const openNew = () => {
    setEditingCompany(null);
    setForm(emptyCompany);
    setShowDialog(true);
  };

  const openEdit = (company) => {
    setEditingCompany(company);
    setForm({
      ...emptyCompany,
      ...company,
      endereco: { ...emptyCompany.endereco, ...(company.endereco || {}) },
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateEndereco = (key, value) => setForm(prev => ({
    ...prev, endereco: { ...prev.endereco, [key]: value }
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas empresas e CNPJs</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova Empresa
        </Button>
      </div>

      {companies.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma empresa cadastrada</h3>
          <p className="text-muted-foreground text-sm mt-1">Cadastre sua primeira empresa para começar</p>
          <Button className="mt-4" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Empresa
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {companies.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(c)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{c.nome_fantasia || c.razao_social}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                    </p>
                  </div>
                </div>
                <Badge variant={c.status === 'ativa' ? 'default' : 'secondary'} className="text-[10px]">
                  {c.status === 'ativa' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap items-center">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {c.bling_integrated ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  Bling
                </Badge>
                {c.marketplaces_config?.mercado_livre?.enabled && (
                  <Badge variant="outline" className="text-[10px]">ML</Badge>
                )}
                {c.marketplaces_config?.shopee?.enabled && (
                  <Badge variant="outline" className="text-[10px]">Shopee</Badge>
                )}
                {c.marketplaces_config?.amazon?.enabled && (
                  <Badge variant="outline" className="text-[10px]">Amazon</Badge>
                )}
                {c.bling_integrated && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-6 text-[10px] px-2 gap-1"
                    onClick={(e) => { e.stopPropagation(); setBlingImportCompany(c); }}
                  >
                    <Download className="w-3 h-3" /> Importar Bling
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BlingImportDialog
        company={blingImportCompany}
        open={!!blingImportCompany}
        onClose={() => setBlingImportCompany(null)}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={(e) => updateField('razao_social', e.target.value)} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={(e) => updateField('nome_fantasia', e.target.value)} />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => updateField('cnpj', e.target.value)} placeholder="00000000000000" />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.inscricao_estadual} onChange={(e) => updateField('inscricao_estadual', e.target.value)} />
            </div>
            <div>
              <Label>Regime Tributário</Label>
              <Select value={form.regime_tributario} onValueChange={(v) => updateField('regime_tributario', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => updateField('telefone', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} />
            </div>

            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input value={form.endereco.logradouro} onChange={(e) => updateEndereco('logradouro', e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.endereco.numero} onChange={(e) => updateEndereco('numero', e.target.value)} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.endereco.bairro} onChange={(e) => updateEndereco('bairro', e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.endereco.cidade} onChange={(e) => updateEndereco('cidade', e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.endereco.uf} onChange={(e) => updateEndereco('uf', e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.endereco.cep} onChange={(e) => updateEndereco('cep', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">Integração Bling</h3>
              <Label>API Key do Bling</Label>
              <Input
                value={form.bling_api_key}
                onChange={(e) => {
                  updateField('bling_api_key', e.target.value);
                  updateField('bling_integrated', e.target.value.length > 0);
                }}
                placeholder="Cole a chave API do Bling aqui"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A chave API do Bling é necessária para emissão de notas fiscais desta empresa.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}