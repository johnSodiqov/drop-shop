import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useRef } from 'react';
import { PageContainer } from '../../components/Layout';
import { EmptyState } from '../../components/StateView';
import { useAuth } from '../auth/AuthProvider';
import { CartLine, useCart } from '../cart/CartProvider';
import { api, errorMessage, formatMoney } from '../../lib/api';
import { Order } from '../../types';

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, 'Введите имя').max(100),
  customerPhone: z.string().regex(/^\+998\d{9}$/, 'Введите номер в формате +998XXXXXXXXX'),
  deliveryAddress: z.string().trim().min(5, 'Укажите адрес доставки').max(500),
  comment: z.string().max(1000).optional(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

function linePrice(line: CartLine, agent: boolean): number {
  return Number(agent ? line.salePrice ?? line.product.recommendedPrice : line.product.recommendedPrice);
}

export function CartPage() {
  const { lines, setQuantity, remove, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkoutKey = useRef<{ userId: string; key: string } | null>(null);
  if (!checkoutKey.current || checkoutKey.current.userId !== user?.id) {
    const userId = user?.id ?? '';
    const storageKey = `dropstore_checkout_key:${userId}`;
    checkoutKey.current = {
      userId,
      key: sessionStorage.getItem(storageKey) ?? crypto.randomUUID(),
    };
    sessionStorage.setItem(storageKey, checkoutKey.current.key);
  }
  const activeCheckoutKey = checkoutKey.current;
  const isAgent = user?.role === 'AGENT';
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: user?.name ?? '', customerPhone: user?.phone ?? '' },
  });
  const orderTotal = lines.reduce((sum, line) => sum + linePrice(line, Boolean(isAgent)) * line.quantity, 0);
  const mutation = useMutation({
    mutationFn: async (values: CheckoutValues) => {
      const { data } = await api.post<Order>('/orders', {
        ...values,
        items: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          ...(isAgent ? { salePrice: line.salePrice ?? line.product.recommendedPrice } : {}),
        })),
        idempotencyKey: activeCheckoutKey.key,
        ...(isAgent ? {} : { agentCode: localStorage.getItem('dropstore_referral') ?? undefined }),
      });
      return data;
    },
    onSuccess: async (order) => {
      clear();
      sessionStorage.removeItem(`dropstore_checkout_key:${user?.id ?? ''}`);
      checkoutKey.current = { userId: user?.id ?? '', key: crypto.randomUUID() };
      sessionStorage.setItem(`dropstore_checkout_key:${user?.id ?? ''}`, checkoutKey.current.key);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(isAgent ? '/agent/orders' : '/orders', { state: { createdOrder: order.orderNumber } });
    },
  });

  if (!lines.length) return <PageContainer><div className="page-heading"><span className="eyebrow">ВАША ПОКУПКА</span><h1>Корзина</h1></div><EmptyState label="В корзине пока пусто." /><Link className="button button-primary" to="/">Перейти в каталог <ArrowRight size={17} /></Link></PageContainer>;

  return (
    <PageContainer>
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Продолжить покупки</Link>
      <div className="page-heading"><span className="eyebrow">ОФОРМЛЕНИЕ ЗАКАЗА</span><h1>Ваша корзина</h1><p>Проверьте товары и укажите данные доставки.</p></div>
      <div className="checkout-layout">
        <div className="cart-lines">
          {lines.map((line) => (
            <article className="cart-line" key={line.product.id}>
              <div className="cart-line-image">{line.product.imageUrl ? <img src={line.product.imageUrl} alt="" /> : <div className="image-placeholder">DS</div>}</div>
              <div className="cart-line-main">
                <Link to={`/products/${line.product.id}`} className="product-title">{line.product.name}</Link>
                <span className="muted">{line.product.sku} · {formatMoney(linePrice(line, Boolean(isAgent)))}</span>
                {isAgent && <small className="agent-profit">Прибыль/шт.: {formatMoney(linePrice(line, true) - Number(line.product.costPrice ?? 0))}</small>}
              </div>
              <div className="quantity-control">
                <button aria-label={`Уменьшить количество ${line.product.name}`} onClick={() => setQuantity(line.product.id, line.quantity - 1)}><Minus size={15} /></button>
                <span>{line.quantity}</span>
                <button aria-label={`Увеличить количество ${line.product.name}`} onClick={() => setQuantity(line.product.id, line.quantity + 1)}><Plus size={15} /></button>
              </div>
              <strong className="cart-line-total">{formatMoney(linePrice(line, Boolean(isAgent)) * line.quantity)}</strong>
              <button className="button-icon remove-button" aria-label={`Удалить ${line.product.name}`} onClick={() => remove(line.product.id)}><Trash2 size={17} /></button>
            </article>
          ))}
          <div className="cart-total"><span>Итого</span><strong>{formatMoney(orderTotal)}</strong></div>
        </div>
        <form className="checkout-card form-stack" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <h2>Доставка</h2>
          <label className="field"><span>Имя получателя</span><input {...form.register('customerName')} />
            {form.formState.errors.customerName && <small className="field-error">{form.formState.errors.customerName.message}</small>}</label>
          <label className="field"><span>Телефон</span><input placeholder="+998901234567" {...form.register('customerPhone')} />
            {form.formState.errors.customerPhone && <small className="field-error">{form.formState.errors.customerPhone.message}</small>}</label>
          <label className="field"><span>Адрес доставки</span><textarea rows={3} placeholder="Город, улица, дом, квартира" {...form.register('deliveryAddress')} />
            {form.formState.errors.deliveryAddress && <small className="field-error">{form.formState.errors.deliveryAddress.message}</small>}</label>
          <label className="field"><span>Комментарий <em>необязательно</em></span><textarea rows={2} placeholder="Пожелания к доставке" {...form.register('comment')} /></label>
          {mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}
          <button className="button button-primary button-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Оформляем заказ…' : <>Подтвердить заказ <ArrowRight size={17} /></>}
          </button>
          <p className="muted checkout-note">Оплата производится при получении. Наличие и цены будут повторно проверены.</p>
        </form>
      </div>
    </PageContainer>
  );
}
