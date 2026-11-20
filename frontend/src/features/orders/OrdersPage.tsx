import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { PageContainer } from '../../components/Layout';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView';
import { useAuth } from '../auth/AuthProvider';
import { api, errorMessage, formatMoney, statusLabels } from '../../lib/api';
import { Order, OrderStatus } from '../../types';

export function OrdersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const endpoint = user?.role === 'ADMIN' ? '/admin/orders' : user?.role === 'AGENT' ? '/agent/orders' : '/orders';
  const orders = useQuery({ queryKey: ['orders', endpoint], queryFn: async () => (await api.get<Order[]>(endpoint)).data });
  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
  const createdNumber = (location.state as { createdOrder?: number } | null)?.createdOrder;
  const paymentLabels = {
    CASH: 'Наличными',
    CARD_ON_DELIVERY: 'Картой при получении',
    TRANSFER_AGENT: 'Переводом / связаться с агентом',
  };
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    NEW: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PACKING', 'CANCELLED'],
    PACKING: ['DELIVERY', 'CANCELLED'],
    DELIVERY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };
  return (
    <PageContainer>
      <div className="page-heading"><span className="eyebrow">{user?.role === 'ADMIN' ? 'УПРАВЛЕНИЕ' : 'ИСТОРИЯ'}</span><h1>{user?.role === 'ADMIN' ? 'Заказы' : 'Мои заказы'}</h1><p>Статусы, детали и история заказов.</p></div>
      {createdNumber && <div className="success-banner"><PackageCheck size={19} /> Заказ №{createdNumber} оформлен. Мы скоро свяжемся с вами.</div>}
      {orders.isPending ? <LoadingState /> : orders.isError ? <ErrorState message={errorMessage(orders.error)} retry={() => orders.refetch()} />
        : !orders.data?.length ? <EmptyState label="Заказов пока нет." />
          : <div className="orders-list">{orders.data.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-heading">
                <div><span className="eyebrow">ЗАКАЗ №{order.orderNumber}</span><p className="muted">{new Date(order.createdAt).toLocaleString('ru-RU')}</p></div>
                <span className={`status-badge status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span>
              </div>
              {user?.role === 'ADMIN' && <div className="order-customer"><b>{order.customerName}</b><span>{order.customerPhone}</span><span>{order.deliveryAddress}</span><span>{paymentLabels[order.paymentMethod]}</span></div>}
              <div className="order-items">{order.items.map((item) => <div key={item.id}><span>{item.productName} × {item.quantity}</span><b>{formatMoney(Number(item.salePrice) * item.quantity)}</b></div>)}</div>
              <div className="order-card-footer"><strong>{formatMoney(order.totalAmount)}</strong>{user?.role === 'AGENT' && <span className="agent-profit">Прибыль {formatMoney(order.totalProfit)}</span>}
                {user?.role === 'ADMIN' && transitions[order.status].length > 0 && (
                  <label className="status-control"><span>Изменить статус</span>
                    <select value="" disabled={mutation.isPending} onChange={(event) => {
                      if (event.target.value) mutation.mutate({ id: order.id, status: event.target.value as OrderStatus });
                    }}>
                      <option value="">Выбрать действие</option>
                      {transitions[order.status].map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {order.statusHistory?.length ? <details className="order-history"><summary>История статусов</summary>{order.statusHistory.map((entry, index) => <p key={`${entry.to}-${index}`}>{statusLabels[entry.from]} → {statusLabels[entry.to]} · {new Date(entry.createdAt).toLocaleString('ru-RU')}</p>)}</details> : null}
            </article>
          ))}</div>}
      {mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}
    </PageContainer>
  );
}
