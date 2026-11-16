import { PropsWithChildren, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, LogOut, Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useCart } from '../features/cart/CartProvider';

export function Layout() {
  const { user, logout } = useAuth();
  const { lines } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const links = user?.role === 'ADMIN'
    ? [['/admin', 'Панель'], ['/admin/products', 'Товары'], ['/admin/categories', 'Категории'], ['/admin/orders', 'Заказы'], ['/admin/users', 'Пользователи'], ['/admin/agents', 'Агенты'], ['/admin/statistics', 'Статистика'], ['/admin/settings', 'Настройки']]
    : user?.role === 'AGENT'
      ? [['/agent', 'Обзор'], ['/agent/catalog', 'Каталог'], ['/agent/orders', 'Мои заказы'], ['/agent/earnings', 'Прибыль'], ['/agent/links', 'Ссылки'], ['/profile', 'Профиль']]
      : [['/', 'Каталог'], ...(user ? [['/orders', 'Мои заказы'], ['/profile', 'Профиль']] : [])];

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="brand-icon"><Box size={20} /></span>
            <span>drop<span className="brand-accent">store</span></span>
          </Link>
          <button className="mobile-menu button-icon" aria-label="Открыть меню" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`}>
            {links.map(([href, label]) => (
              <NavLink key={href} to={href} end={href === '/'} onClick={() => setMenuOpen(false)}>{label}</NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            {user?.role !== 'ADMIN' && (
              <Link className="cart-button" to="/cart" aria-label="Корзина">
                <ShoppingBag size={18} /><span>Корзина</span>
                {lines.length > 0 && <b>{lines.reduce((sum, line) => sum + line.quantity, 0)}</b>}
              </Link>
            )}
            {user ? (
              <>
                <Link className="profile-button" to="/profile">
                  <span className="avatar"><UserRound size={16} /></span><span className="profile-name">{user.name}</span>
                </Link>
                <button className="button-icon logout-button" onClick={signOut} title="Выйти" aria-label="Выйти"><LogOut size={17} /></button>
              </>
            ) : (
              <Link className="button button-dark button-small" to="/login">Войти</Link>
            )}
          </div>
        </div>
      </header>
      <main className="main-content"><Outlet /></main>
      <footer className="footer">
        <Link className="brand brand-footer" to="/"><span className="brand-icon"><Box size={17} /></span>drop<span className="brand-accent">store</span></Link>
        <span>Платформа для удобных продаж</span>
      </footer>
    </div>
  );
}

export function PageContainer({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`page-container ${className}`}>{children}</section>;
}
