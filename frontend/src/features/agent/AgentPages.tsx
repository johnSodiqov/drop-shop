import { useQuery } from '@tanstack/react-query';
import { BarChart3, CircleDollarSign, Copy, PackageCheck, ShoppingBag, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, EmptyState, LoadingState } from '../../components/StateView';
import { PageContainer } from '../../components/Layout';
import { api, errorMessage, formatMoney } from '../../lib/api';
import { Order } from '../../types';
import { useAuth } from '../auth/AuthProvider';

interface AgentStats {
  ordersCount: number;
  salesTotal: string;
  profit: string;
  deliveredCount: number;
  cancelledCount: number;
}

export function AgentDashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['agent-dashboard'], queryFn: async () => (await api.get<AgentStats>('/agent/dashboard')).data });
  if (stats.isPending) return <PageContainer><LoadingState /></PageContainer>;
  if (stats.isError) return <PageContainer><ErrorState message={errorMessage(stats.error)} retry={() => stats.refetch()} /></PageContainer>;
  const data = stats.data;
  return <PageContainer><div className="page-heading"><span className="eyebrow">КАБИНЕТ АГЕНТА</span><h1>Здравствуйте, {user?.name}</h1><p>Ваши продажи и прибыль в одном месте.</p></div>
    <div className="stats-grid agent-stats"><Stat icon={<ShoppingBag size={19} />} label="Заказы" value={data.ordersCount} /><Stat icon={<BarChart3 size={19} />} label="Сумма продаж" value={formatMoney(data.salesTotal)} /><Stat icon={<CircleDollarSign size={19} />} label="Прибыль" value={formatMoney(data.profit)} positive /><Stat icon={<PackageCheck size={19} />} label="Доставлено" value={data.deliveredCount} /><Stat icon={<XCircle size={19} />} label="Отменено" value={data.cancelledCount} /></div>
    <div className="agent-welcome panel-card"><div><span className="eyebrow">НАЧНИТЕ ПРОДАВАТЬ</span><h2>Выберите товар из каталога</h2><p>Добавьте товары в корзину, настройте цену в разрешённых пределах и оформите заказ.</p></div><Link className="button button-primary" to="/agent/catalog">Открыть каталог <ShoppingBag size={17} /></Link></div>
  </PageContainer>;
}

function Stat({ icon, label, value, positive = false }: { icon: ReactNode; label: string; value: ReactNode; positive?: boolean }) {
  return <article className={`stat-card ${positive ? 'stat-positive' : ''}`}><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></article>;
}

export function AgentEarningsPage() {
  const query = useQuery({ queryKey: ['agent-earnings'], queryFn: async () => (await api.get<AgentStats & { deliveredProfit: string }>('/agent/earnings')).data });
  const orders = useQuery({ queryKey: ['orders', 'agent-history'], queryFn: async () => (await api.get<Order[]>('/agent/orders')).data });
  return <PageContainer><div className="page-heading"><span className="eyebrow">ФИНАНСЫ</span><h1>Мои продажи и прибыль</h1><p>Расчёты основаны на ценах, зафиксированных при оформлении заказа.</p></div>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} /> : <div className="stats-grid"><Stat icon={<ShoppingBag size={19} />} label="Заказов без отменённых" value={query.data.ordersCount} /><Stat icon={<BarChart3 size={19} />} label="Сумма продаж" value={formatMoney(query.data.salesTotal)} /><Stat icon={<CircleDollarSign size={19} />} label="Расчётная прибыль" value={formatMoney(query.data.profit)} positive /><Stat icon={<PackageCheck size={19} />} label="Прибыль доставленных" value={formatMoney(query.data.deliveredProfit)} positive /></div>}
    {orders.isPending ? <LoadingState /> : orders.isError ? <ErrorState message={errorMessage(orders.error)} /> : orders.data?.length ? <div className="orders-list compact-orders">{orders.data.map((order) => <article className="order-card" key={order.id}><div className="order-card-heading"><b>Заказ №{order.orderNumber}</b><span>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span></div><div className="order-card-footer"><span>Продажи: {formatMoney(order.totalAmount)}</span><b className="agent-profit">Прибыль: {formatMoney(order.totalProfit)}</b></div></article>)}</div> : <EmptyState label="История продаж появится после первых заказов." />}
  </PageContainer>;
}

interface ProductLink { id: string; name: string; imageUrl: string | null; url: string }
export function AgentLinksPage() {
  const links = useQuery({ queryKey: ['agent-links'], queryFn: async () => (await api.get<ProductLink[]>('/agent/links')).data });
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const copy = async (item: ProductLink) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(item.id);
      setCopyError('');
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopyError('Браузер запретил копирование. Скопируйте ссылку вручную.');
    }
  };
  return <PageContainer><div className="page-heading"><span className="eyebrow">ПЕРСОНАЛЬНЫЕ ССЫЛКИ</span><h1>Поделитесь товаром</h1><p>Уникальная ссылка содержит ваш агентский код и ведёт на карточку товара.</p></div>
    {copyError && <p className="form-error">{copyError}</p>}
    {links.isPending ? <LoadingState /> : links.isError ? <ErrorState message={errorMessage(links.error)} retry={() => links.refetch()} /> : !links.data?.length ? <EmptyState label="Активных товаров нет." />
      : <div className="table-wrap"><table><thead><tr><th>Товар</th><th>Ссылка</th><th /></tr></thead><tbody>{links.data.map((item) => <tr key={item.id}><td><b>{item.name}</b></td><td><span className="copy-link-text">{item.url}</span></td><td><button className="button button-outline button-small" onClick={() => void copy(item)}><Copy size={15} />{copied === item.id ? 'Скопировано' : 'Копировать'}</button></td></tr>)}</tbody></table></div>}
  </PageContainer>;
}
