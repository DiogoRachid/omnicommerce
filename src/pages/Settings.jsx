import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, Building2, Store, FileText, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import BlingOAuthConfig from '@/components/bling/BlingOAuthConfig';
import BlingAgentChat from '@/components/bling/BlingAgentChat';

const settingsItems = [
  {
    title: 'Empresas e CNPJs',
    description: 'Gerencie suas empresas, integrações Bling e marketplaces',
    icon: Building2,
    path: '/empresas',
  },
  {
    title: 'Marketplaces',
    description: 'Configure integrações com Mercado Livre, Shopee, Amazon',
    icon: Store,
    path: '/marketplaces',
  },
  {
    title: 'Notas Fiscais',
    description: 'Importação de XML e integração com Bling para emissão',
    icon: FileText,
    path: '/notas-fiscais',
  },
  {
    title: 'IA de Preços',
    description: 'Configuração do motor de IA para precificação inteligente',
    icon: Bot,
    path: '/ia-precos',
  },
];

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link key={item.path} to={item.path}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <BlingOAuthConfig />
      <BlingAgentChat />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sobre o Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Sistema:</strong> GestãoPro — Gestão Comercial</p>
            <p><strong>Integrações:</strong> Bling (emissão NF-e), Mercado Livre, Shopee, Amazon</p>
            <p><strong>Estoque:</strong> Gerenciado centralmente pelo sistema, com entrada via XML de NF-e</p>
            <p className="text-muted-foreground text-xs mt-4">
              Cada empresa (CNPJ) possui integração individual com o Bling e os marketplaces.
              O estoque é unificado e gerenciado por este sistema. Notas fiscais de entrada são importadas via XML.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}