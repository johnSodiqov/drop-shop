import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage, RegisterPage } from './features/auth/AuthPages';
import { CatalogPage, ProductDetailsPage } from './features/products/CatalogPage';
import { CartPage } from './features/orders/CartPage';
import { OrdersPage } from './features/orders/OrdersPage';
import {
  AdminAgentsPage,
  AdminCategoriesPage,
  AdminDashboardPage,
  AdminProductsPage,
  AdminSettingsPage,
  AdminUsersPage,
} from './features/admin/AdminPages';
import { AgentDashboardPage, AgentEarningsPage, AgentLinksPage } from './features/agent/AgentPages';
import { ProfilePage } from './features/users/ProfilePage';

function ReferralCapture() {
  const location = useLocation();
  useEffect(() => {
    const referral = new URLSearchParams(location.search).get('ref');
    if (referral && /^[a-f0-9]{16}$/.test(referral)) {
      localStorage.setItem('dropstore_referral', referral);
    }
  }, [location.search]);
  return null;
}

export default function App() {
  return (
    <>
      <ReferralCapture />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CatalogPage />} />
          <Route path="products/:id" element={<ProductDetailsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute roles={['CUSTOMER', 'AGENT']} />}>
            <Route path="cart" element={<CartPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
            <Route path="orders" element={<OrdersPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['AGENT']} />}>
            <Route path="agent" element={<AgentDashboardPage />} />
            <Route path="agent/catalog" element={<CatalogPage />} />
            <Route path="agent/orders" element={<OrdersPage />} />
            <Route path="agent/earnings" element={<AgentEarningsPage />} />
            <Route path="agent/links" element={<AgentLinksPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/products" element={<AdminProductsPage />} />
            <Route path="admin/categories" element={<AdminCategoriesPage />} />
            <Route path="admin/orders" element={<OrdersPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/agents" element={<AdminAgentsPage />} />
            <Route path="admin/statistics" element={<AdminDashboardPage />} />
            <Route path="admin/settings" element={<AdminSettingsPage />} />
          </Route>
          <Route path="*" element={<div className="not-found"><h1>Страница не найдена</h1><a className="button button-primary" href="/">Вернуться в каталог</a></div>} />
        </Route>
      </Routes>
    </>
  );
}
