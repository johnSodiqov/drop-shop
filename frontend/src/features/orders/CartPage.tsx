import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
  paymentMethod: z.enum(['CASH', 'CARD_ON_DELIVERY', 'TRANSFER_AGENT']),
  comment: z.string().max(1000).optional(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

const defaultPosition: [number, number] = [41.311081, 69.240562];

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function AddressPicker({ onSelect }: { onSelect: (address: string, lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<[number, number]>(defaultPosition);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition([coords.latitude, coords.longitude]),
      () => undefined,
      { timeout: 5000 },
    );
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ru`);
    const data = await response.json();
    onSelect(data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng);
  }

  function Recenter() {
    const map = useMapEvents({});
    useEffect(() => {
      map.setView(position);
    }, [position, map]);
    return null;
  }

  async function searchAddress() {
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&accept-language=ru`);
      const data = await response.json();
      if (data[0]) {
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        setPosition([lat, lng]);
        onSelect(data[0].display_name, lat, lng);
      }
    } finally {
      setSearching(false);
    }
  }

  function MapClick() {
    useMapEvents({
      click(event) {
        const lat = event.latlng.lat;
        const lng = event.latlng.lng;
        setPosition([lat, lng]);
        void reverseGeocode(lat, lng);
      },
    });
    return null;
  }

  return (
    <div className="address-picker">
      <div className="address-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress(); } }} placeholder="Поиск улицы или места" />
        <button type="button" className="button button-secondary" onClick={() => void searchAddress()} disabled={searching}>{searching ? 'Поиск…' : 'Найти'}</button>
      </div>
      <MapContainer center={position} zoom={13} scrollWheelZoom={false} className="checkout-map">
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={position} icon={markerIcon} />
        <MapClick />
        <Recenter />
      </MapContainer>
      <small className="muted">Нажмите на карту для выбора адреса доставки.</small>
    </div>
  );
}

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
    defaultValues: {
      customerName: user?.name ?? '',
      customerPhone: user?.phone ?? '',
      paymentMethod: 'CASH',
    },
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
          <div className="field"><span>Адрес доставки</span>
            <AddressPicker onSelect={(address, lat, lng) => {
              form.setValue('deliveryAddress', address, { shouldValidate: true });
              form.setValue('deliveryLatitude', lat);
              form.setValue('deliveryLongitude', lng);
            }} />
            <textarea rows={3} placeholder="Город, улица, дом, квартира" {...form.register('deliveryAddress')} />
            {form.formState.errors.deliveryAddress && <small className="field-error">{form.formState.errors.deliveryAddress.message}</small>}
          </div>
          <fieldset className="payment-options">
            <legend>Способ оплаты</legend>
            <label><input type="radio" value="CASH" {...form.register('paymentMethod')} /><span><b>Наличными</b><small>Оплата при получении</small></span></label>
            <label><input type="radio" value="CARD_ON_DELIVERY" {...form.register('paymentMethod')} /><span><b>Картой при получении</b><small>Оплата курьеру</small></span></label>
            <label><input type="radio" value="TRANSFER_AGENT" {...form.register('paymentMethod')} /><span><b>Переводом / связаться с агентом</b><small>Менеджер уточнит реквизиты</small></span></label>
            {form.formState.errors.paymentMethod && <small className="field-error">{form.formState.errors.paymentMethod.message}</small>}
          </fieldset>
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
