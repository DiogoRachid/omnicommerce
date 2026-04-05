import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Store, FileText, Bot, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

const settingsItems = [
  {
    title: 'Empresas e CNPJs',
    description: 'Gerencie empresas, conexões Bling, Mercado Livre e outros marketplaces',
    icon: Building2,
    path: '/empresas',
    color: 'bg-blue-500',
  },
  {
    title: 'Marketplaces',
    description: 'Visualize e importe produtos do Bling e dos marketplaces ativos',
    icon: Store,
    path: '/marketplaces',
    color: 'bg-yellow-400',
  },
  {
    title: 'Campos de Marketplace',
    description: 'Edite e mapeie os campos específicos de cada marketplace por produto',
    icon: Tag,
    path: '/configuracoes/campos-marketplace',
    color: 'bg-purple-500',
  },
  {
    title: 'Notas Fiscais',
    description: 'Importação de XML e integração com Bling para emissão',
    icon: FileText,
    path: '/notas-fiscais',
    color: 'bg-green-500',
  },
  {
    title: 'IA de Preços',
    description: 'Configuração do motor de IA para precificação inteligente',
    icon: Bot,
    path: '/ia-precos',
    color: 'bg-pink-500',
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
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-5 h-5 text-white" />
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

      <Card>
        <CardContent className="p-5">
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-base mb-3">Sobre o Sistema</p>
            <p><strong>Sistema:</strong> GestãoPro — Gestão Comercial</p>
            <p><strong>Integrações:</strong> Bling (ERP/NF-e), Mercado Livre, Shopee, Amazon, Magalu</p>
            <p><strong>Estoque:</strong> Gerenciado centralmente com entrada via XML de NF-e</p>
            <p className="text-muted-foreground text-xs mt-4">
              Cada empresa possui integração individual configurada em <strong>Empresas</strong>.
              Os campos específicos de cada marketplace são gerenciados em <strong>Campos de Marketplace</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
