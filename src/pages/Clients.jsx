import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, Search, Edit } from 'lucide-react';

const emptyClient = {
  nome: '', tipo_pessoa: 'fisica', cpf_cnpj: '', email: '', telefone: '',
  endereco: { logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' },
};

export default function Clients() {
  const { selectedCompany } = useOutletContext();
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', selectedCompany],
    queryFn: () => {
      if (selectedCompany && selectedCompany !== 'all') {
        return base44.entities.Client.filter({ company_id: selectedCompany }, '-created_date', 200);
      }
      return base44.entities.Client.list('-created_date', 200);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: selectedCompany !== 'all' ? selectedCompany : undefined };
      if (editing) return base44.entities.Client.update(editing.id, payload);
      return base44.entities.Client.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowDialog(false);
      setEditing(null);
      setForm(emptyClient);
    },
  });

  const filtered = clients.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) || c.cpf_cnpj?.includes(search)
  );

  const openEdit = (client) => {
    setEditing(client);
    setForm({ ...emptyClient, ...client, endereco: { ...emptyClient.endereco, ...(client.endereco || {}) } });
    setShowDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{clients.length} clientes</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyClient); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Nenhum cliente encontrado</h3>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {c.tipo_pessoa === 'juridica' ? 'PJ' : 'PF'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{c.cpf_cnpj || '-'}</TableCell>
                    <TableCell className="text-sm">{c.email || '-'}</TableCell>
                    <TableCell className="text-sm">{c.telefone || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo Pessoa</Label>
                <Select value={form.tipo_pessoa} onValueChange={(v) => setForm(p => ({ ...p, tipo_pessoa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Pessoa Física</SelectItem>
                    <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'}</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => setForm(p => ({ ...p, cpf_cnpj: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm(p => ({ ...p, telefone: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}