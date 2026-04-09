import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('all');

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={cn("hidden lg:block")}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <div className={cn("lg:hidden fixed z-40 transition-transform", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
      </div>

      <div className={cn("transition-all duration-300", "lg:ml-[240px]", collapsed && "lg:ml-[68px]")}>
        <Header selectedCompany={selectedCompany} onCompanyChange={setSelectedCompany}>
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </Header>
        <main className="p-4 md:p-6">
          <Outlet context={{ selectedCompany, setSelectedCompany }} />
        </main>
      </div>
    </div>
  );
}