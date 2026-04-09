import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';
import { Menu, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('all');

  return (
    <div className="min-h-screen bg-background">
      {/* Backdrop mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar desktop — fixa, colapsável */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Sidebar mobile — off-canvas */}
      <div className={cn(
        "fixed top-0 left-0 h-screen z-50 transition-transform duration-300 md:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar collapsed={false} onToggle={() => setIsMobileMenuOpen(false)} onMobileClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <div className={cn("transition-all duration-300 md:ml-[240px]", collapsed && "md:ml-[68px]")}>
        {/* Topbar mobile */}
        <div className="md:hidden flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">GestãoPro</span>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        <Header selectedCompany={selectedCompany} onCompanyChange={setSelectedCompany} />
        <main className="p-4 md:p-6">
          <Outlet context={{ selectedCompany, setSelectedCompany }} />
        </main>
      </div>
    </div>
  );
}