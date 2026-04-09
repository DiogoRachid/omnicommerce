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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Backdrop mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar desktop — inline no flex */}
      <div className="hidden md:flex shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Sidebar mobile — off-canvas */}
      <div className={cn(
        "fixed top-0 left-0 h-screen z-50 transition-transform duration-300 md:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar collapsed={false} onToggle={() => setIsMobileMenuOpen(false)} onMobileClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Área central */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header selectedCompany={selectedCompany} onCompanyChange={setSelectedCompany}>
          <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </Header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={{ selectedCompany, setSelectedCompany }} />
        </main>
      </div>
    </div>
  );
}