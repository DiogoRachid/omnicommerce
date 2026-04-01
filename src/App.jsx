import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Companies from '@/pages/Companies';
import Products from '@/pages/Products';
import ProductForm from '@/pages/ProductForm';
import Stock from '@/pages/Stock';
import Sales from '@/pages/Sales';
import NewSale from '@/pages/NewSale';
import Invoices from '@/pages/Invoices';
import ImportInvoice from '@/pages/ImportInvoice';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Marketplaces from '@/pages/Marketplaces';
import Reports from '@/pages/Reports';
import IAPricing from '@/pages/IAPricing';
import Settings from '@/pages/Settings';
import BlingCallback from '@/pages/BlingCallback';
import ProductOrganizer from '@/pages/ProductOrganizer';
import FinancialDashboard from '@/pages/FinancialDashboard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/empresas" element={<Companies />} />
        <Route path="/produtos" element={<Products />} />
        <Route path="/produtos/novo" element={<ProductForm />} />
        <Route path="/produtos/editar/:id" element={<ProductForm />} />
        <Route path="/estoque" element={<Stock />} />
        <Route path="/vendas" element={<Sales />} />
        <Route path="/vendas/nova" element={<NewSale />} />
        <Route path="/notas-fiscais" element={<Invoices />} />
        <Route path="/notas-fiscais/importar" element={<ImportInvoice />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/fornecedores" element={<Suppliers />} />
        <Route path="/marketplaces" element={<Marketplaces />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/ia-precos" element={<IAPricing />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="/organizar-produtos" element={<ProductOrganizer />} />
        <Route path="/financeiro" element={<FinancialDashboard />} />
      </Route>
      <Route path="/bling-callback" element={<BlingCallback />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App