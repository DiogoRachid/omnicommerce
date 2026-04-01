import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, Receipt,
  FileText, Users, BarChart3, Store, Settings, Building2,
  ChevronLeft, ChevronRight, Bot, Wand2, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Building2, label: 'Empresas', path: '/empresas' },
  { icon: Package, label: 'Produtos', path: '/produtos' },
  { icon: Warehouse, label: 'Estoque', path: '/estoque' },
  { icon: ShoppingCart, label: 'Vendas', path: '/vendas' },
  { icon: FileText, label: 'Notas Fiscais', path: '/notas-fiscais' },
  { icon: Users, label: 'Clientes', path: '/clientes' },
  { icon: Store, label: 'Marketplaces', path: '/marketplaces' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
  { icon: Bot, label: 'IA de Preços', path: '/ia-precos' },
  { icon: Wand2, label: 'Organizar Catálogo', path: '/organizar-produtos' },
  { icon: RefreshCw, label: 'Sync Bling', path: '/sync-bling' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white truncate">GestãoPro</h1>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Gestão Comercial</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-white shadow-lg shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}