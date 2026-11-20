import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Boxes, CircleDollarSign, PackagePlus, Pencil, RotateCw, Settings2, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ReactNode } from 'react';
import { ErrorState, EmptyState, LoadingState } from '../../components/StateView';
import { PageContainer } from '../../components/Layout';
import { api, errorMessage, formatMoney } from '../../lib/api';
import { Category, Product, User } from '../../types';

interface DashboardData {
  productsCount: number;
  ordersCount: number;
  activeAgentsCount: number;
  salesTotal: string;
  newOrdersCount: number;
  lowStockProducts: Array<Product>;
  topProducts: Array<{ id: string; name: string; sku: string; sold: number }>;
  topAgents: Array<{ id: string; name: string; phone: string; sales: string }>;
}

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ['admin-dashboard'], queryFn: async () => (await api.get<DashboardData>('/admin/dashboard')).data });
  if (query.isPending) return <PageContainer><LoadingState /></PageContainer>;
  if (query.isError) return <PageContainer><ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /></PageContainer>;
  const data = query.data;
  const quickActions = [
    { title: 'Новый товар', description: 'Добавить позицию в каталог', href: '/admin/products' },
    { title: 'Категории', description: 'Структурировать ассортимент', href: '/admin/categories' },
    { title: 'Настройки', description: 'Скорректировать параметры', href: '/admin/settings' },
  ];
  const pulseItems = [
    { label: 'Подтверждения', value: data.newOrdersCount, tone: 'warning' },
    { label: 'Низкий остаток', value: data.lowStockProducts.length, tone: 'neutral' },
    { label: 'Топ-агент', value: data.topAgents[0]?.name ?? 'Нет данных', tone: 'success' },
  ];

  return (
    <PageContainer>
      <div className="page-heading heading-with-action"><div><span className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</span><h1>Добро пожаловать</h1><p>Ключевые показатели и состояние платформы.</p></div><span className="date-chip">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div className="stats-grid">
        <StatCard icon={<Boxes size={19} />} label="Товары" value={data.productsCount} />
        <StatCard icon={<BarChart3 size={19} />} label="Все заказы" value={data.ordersCount} />
        <StatCard icon={<UsersRound size={19} />} label="Активные агенты" value={data.activeAgentsCount} />
        <StatCard icon={<CircleDollarSign size={19} />} label="Сумма продаж" value={formatMoney(data.salesTotal)} />
      </div>

      <section className="pulse-grid" aria-label="Краткие показатели">
        {pulseItems.map((item) => (
          <div key={item.label} className={`pulse-card pulse-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <div className="dashboard-panels">
        <section className="panel-card">
          <div className="panel-heading"><div><h2>Заказы ожидают</h2><p>Новые заказы требуют подтверждения</p></div><span className="panel-count">{data.newOrdersCount}</span></div>
          <a className="panel-link" href="/admin/orders">Перейти к заказам <span>→</span></a>
        </section>
        <section className="panel-card">
          <div className="panel-heading"><div><h2>Низкий остаток</h2><p>Товары, которые скоро закончатся</p></div><PackagePlus size={19} /></div>
          {data.lowStockProducts.length
            ? <div className="mini-list">{data.lowStockProducts.map((item) => <div key={item.id}><span>{item.name}</span><b className="warning-text">{item.inventory?.quantity ?? 0} шт.</b></div>)}</div>
            : <p className="muted">Все запасы в норме.</p>}
        </section>
        <section className="panel-card">
          <div className="panel-heading"><div><h2>Топ товаров</h2><p>По проданному количеству</p></div><BarChart3 size={19} /></div>
          {data.topProducts.length ? <div className="mini-list">{data.topProducts.map((item) => <div key={item.id}><span>{item.name}</span><b>{item.sold} шт.</b></div>)}</div> : <p className="muted">Пока нет продаж.</p>}
        </section>
        <section className="panel-card">
          <div className="panel-heading"><div><h2>Топ агентов</h2><p>По объёму продаж</p></div><UsersRound size={19} /></div>
          {data.topAgents.length ? <div className="mini-list">{data.topAgents.map((item) => <div key={item.id}><span>{item.name}</span><b>{formatMoney(item.sales)}</b></div>)}</div> : <p className="muted">У агентов пока нет продаж.</p>}
        </section>
      </div>

      <section className="quick-actions-section" aria-label="Быстрые действия">
        <div className="section-heading">
          <div>
            <span className="eyebrow">БЫСТРЫЕ ДЕЙСТВИЯ</span>
            <h2>Оперативные задачи</h2>
          </div>
        </div>
        <div className="action-grid">
          {quickActions.map((action) => (
            <a key={action.title} className="action-card" href={action.href}>
              <span className="action-tag">Открыть</span>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
            </a>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></article>;
}

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Введите сумму с точностью до 2 знаков');
const productSchema = z.object({
  sku: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/),
  name: z.string().min(2).max(160),
  description: z.string().max(5000),
  categoryId: z.string().min(1, 'Выберите категорию'),
  costPrice: money,
  recommendedPrice: money,
  minimumPrice: money,
  maximumMarkup: money,
  stock: z.coerce.number().int().min(0).max(1_000_000),
  allowAgentPriceChange: z.boolean(),
  status: z.enum(['ACTIVE', 'HIDDEN', 'ARCHIVED', 'OUT_OF_STOCK']).optional(),
}).superRefine((values, context) => {
  const cost = Number(values.costPrice);
  if (Number(values.minimumPrice) < cost ||
    Number(values.recommendedPrice) < Number(values.minimumPrice) ||
    Number(values.recommendedPrice) > cost + Number(values.maximumMarkup)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recommendedPrice'], message: 'Условия: закупка ≤ минимум ≤ рекомендация ≤ закупка + наценка' });
  }
});
type ProductValues = z.output<typeof productSchema>;
type ProductFormInput = z.input<typeof productSchema>;

interface MediaItem {
  url: string;
  key: string;
}

function MediaUploader({
  directory,
  value,
  onChange,
  multiple = true,
}: {
  directory: 'products' | 'categories' | 'banners' | 'brands';
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  multiple?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append(multiple ? 'files' : 'file', file));
    try {
      const endpoint = multiple ? '/storage/upload/multiple' : '/storage/upload';
      const response = await api.post<{ success: boolean; data: MediaItem | MediaItem[] }>(
        `${endpoint}?directory=${directory}`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => setProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0),
        },
      );
      const uploaded = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      onChange(multiple ? [...value, ...uploaded] : uploaded);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUploading(false);
    }
  }

  async function remove(item: MediaItem) {
    const parts = item.key.split('/');
    if (parts.length !== 2) return;
    try {
      await api.delete(`/storage/${parts[0]}/${parts[1]}`);
      onChange(value.filter((candidate) => candidate.key !== item.key));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="media-uploader field-span">
      <div className="media-upload-actions">
        <label className="button button-outline">
          Выбрать изображения
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={(event) => void upload(event.target.files)} />
        </label>
        {uploading && <span className="upload-progress">Загрузка: {progress}%</span>}
      </div>
      {value.length > 0 && (
        <div className="media-preview-list">
          {value.map((item, index) => (
            <div className="media-preview" key={item.key}>
              <img src={item.url} alt="" loading="lazy" />
              {index === 0 && <span className="media-main-label">Главное</span>}
              <div className="media-preview-actions">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>←</button>
                <button type="button" disabled={index === value.length - 1} onClick={() => move(index, 1)}>→</button>
                <button type="button" onClick={() => void remove(item)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function ProductForm({
  categories,
  product,
  close,
}: {
  categories: Category[];
  product?: Product;
  close: () => void;
}) {
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<MediaItem[]>(
    (() => {
      const urls = product?.imageUrls?.length
        ? product.imageUrls
        : product?.imageUrl
          ? [product.imageUrl]
          : [];
      return urls.map((url, index) => ({
        url,
        key: product?.imageKeys?.[index] ?? '',
      })).filter((item) => item.url);
    })(),
  );
  const form = useForm<ProductFormInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          costPrice: product.costPrice ?? '0',
          recommendedPrice: product.recommendedPrice,
          minimumPrice: product.minimumPrice ?? '0',
          maximumMarkup: product.maximumMarkup ?? '0',
          stock: product.inventory?.quantity ?? 0,
          allowAgentPriceChange: product.allowAgentPriceChange ?? true,
          status: product.status as ProductValues['status'],
        }
      : { allowAgentPriceChange: true, stock: 0 },
  });
  const mutation = useMutation({
    mutationFn: async (values: ProductValues) => {
      const payload = {
        ...values,
        imageUrl: media[0]?.url || undefined,
        imageUrls: media.map((item) => item.url),
        imageKeys: media.map((item) => item.key).filter(Boolean),
      };
      return product
        ? api.patch(`/admin/products/${product.id}`, payload)
        : api.post('/admin/products', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      close();
    },
  });
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <div className="panel-heading"><div><span className="eyebrow">КАТАЛОГ</span><h2 id="product-form-title">{product ? 'Редактировать товар' : 'Новый товар'}</h2></div><button className="button-icon" onClick={close} aria-label="Закрыть">×</button></div>
        <form className="form-grid" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="field"><span>Артикул SKU</span><input {...form.register('sku')} />{form.formState.errors.sku && <small className="field-error">{form.formState.errors.sku.message}</small>}</label>
          <label className="field"><span>Название</span><input {...form.register('name')} /></label>
          <label className="field field-span"><span>Описание</span><textarea rows={3} {...form.register('description')} /></label>
          <label className="field"><span>Категория</span><select {...form.register('categoryId')}><option value="">Выберите</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <MediaUploader directory="products" value={media} onChange={setMedia} />
          <label className="field"><span>Закупочная цена</span><input inputMode="decimal" {...form.register('costPrice')} /></label>
          <label className="field"><span>Минимальная цена</span><input inputMode="decimal" {...form.register('minimumPrice')} /></label>
          <label className="field"><span>Рекомендованная цена</span><input inputMode="decimal" {...form.register('recommendedPrice')} /></label>
          <label className="field"><span>Макс. наценка</span><input inputMode="decimal" {...form.register('maximumMarkup')} /></label>
          <label className="field"><span>Остаток</span><input type="number" min={0} {...form.register('stock')} /></label>
          {product && <label className="field"><span>Статус</span><select {...form.register('status')}><option value="ACTIVE">Активен</option><option value="HIDDEN">Скрыт</option><option value="OUT_OF_STOCK">Нет в наличии</option><option value="ARCHIVED">Архив</option></select></label>}
          <label className="checkbox-field field-span"><input type="checkbox" {...form.register('allowAgentPriceChange')} /> Агент может менять цену продажи</label>
          {Object.values(form.formState.errors).length > 0 && <p className="form-error field-span">Проверьте обязательные поля и ограничения цены.</p>}
          {mutation.isError && <p className="form-error field-span">{errorMessage(mutation.error)}</p>}
          <div className="modal-actions field-span"><button type="button" className="button button-outline" onClick={close}>Отмена</button><button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить товар'}</button></div>
        </form>
      </div>
    </div>
  );
}

export function AdminProductsPage() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['admin-products'], queryFn: async () => (await api.get<Product[]>('/admin/products')).data });
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<Category[]>('/categories')).data });
  const [editing, setEditing] = useState<Product | null | undefined>();
  const [error, setError] = useState('');
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
    onError: (reason) => setError(errorMessage(reason)),
  });
  return (
    <PageContainer>
      <div className="page-heading heading-with-action"><div><span className="eyebrow">КАТАЛОГ</span><h1>Товары</h1><p>Управление ценами, наличием и карточками товаров.</p></div><button className="button button-primary" onClick={() => setEditing(null)}><PackagePlus size={17} /> Добавить товар</button></div>
      {(products.isPending || categories.isPending) ? <LoadingState /> : products.isError ? <ErrorState message={errorMessage(products.error)} retry={() => products.refetch()} />
        : !products.data?.length ? <EmptyState label="Товаров пока нет. Добавьте первый товар." />
          : <div className="table-wrap"><table><thead><tr><th>Товар</th><th>Категория</th><th>Закупка</th><th>Рекоменд.</th><th>Остаток</th><th>Статус</th><th /></tr></thead><tbody>
            {products.data.map((product) => <tr key={product.id}><td><div className="table-product"><b>{product.name}</b><small>{product.sku}</small></div></td><td>{product.category.name}</td><td>{formatMoney(product.costPrice ?? '0')}</td><td>{formatMoney(product.recommendedPrice)}</td><td>{product.inventory?.quantity ?? 0}</td><td><span className={`status-badge status-${product.status.toLowerCase()}`}>{product.status === 'ACTIVE' ? 'Активен' : product.status === 'HIDDEN' ? 'Скрыт' : product.status === 'ARCHIVED' ? 'Архив' : 'Нет в наличии'}</span></td><td className="table-actions"><button className="button-icon" aria-label={`Изменить ${product.name}`} onClick={() => setEditing(product)}><Pencil size={16} /></button><button className="button-icon danger-icon" aria-label={`Архивировать ${product.name}`} onClick={() => { if (window.confirm(`Архивировать «${product.name}»?`)) remove.mutate(product.id); }}><Trash2 size={16} /></button></td></tr>)}
          </tbody></table></div>}
      {error && <p className="form-error">{error}</p>}
      {editing !== undefined && categories.data && <ProductForm categories={categories.data} product={editing ?? undefined} close={() => setEditing(undefined)} />}
    </PageContainer>
  );
}

const categorySchema = z.object({ name: z.string().trim().min(2).max(80) });
export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<Category[]>('/categories')).data });
  const form = useForm<{ name: string }>({ resolver: zodResolver(categorySchema) });
  const [categoryMedia, setCategoryMedia] = useState<MediaItem[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const add = useMutation({
    mutationFn: (values: { name: string }) => api.post('/categories', {
      ...values,
      imageUrl: categoryMedia[0]?.url,
      imageKey: categoryMedia[0]?.key,
    }),
    onSuccess: async () => { form.reset(); setCategoryMedia([]); await queryClient.invalidateQueries({ queryKey: ['categories'] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
  const rename = useMutation({
    mutationFn: ({ id, name, imageUrl, imageKey }: { id: string; name: string; imageUrl?: string | null; imageKey?: string | null }) => api.patch(`/categories/${id}`, { name, imageUrl: imageUrl || undefined, imageKey: imageKey || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
  async function uploadCategoryImage(category: Category, files: FileList | null) {
    if (!files?.[0]) return;
    setCategoryError('');
    const formData = new FormData();
    formData.append('file', files[0]);
    try {
      const response = await api.post<{ data: MediaItem }>(
        '/storage/upload?directory=categories',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      await api.patch(`/categories/${category.id}`, {
        name: category.name,
        imageUrl: response.data.data.url,
        imageKey: response.data.data.key,
      });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (reason) {
      setCategoryError(errorMessage(reason));
    }
  }
  return <PageContainer><div className="page-heading"><span className="eyebrow">КАТАЛОГ</span><h1>Категории</h1><p>Категории помогают покупателям находить нужные товары.</p></div>
    <form className="inline-form" onSubmit={form.handleSubmit((values) => add.mutate(values))}><label className="field"><span>Название категории</span><input placeholder="Например, Для дома" {...form.register('name')} /></label><MediaUploader directory="categories" value={categoryMedia} onChange={setCategoryMedia} multiple={false} /><button className="button button-primary" disabled={add.isPending}>{add.isPending ? 'Добавляем…' : 'Добавить категорию'}</button></form>
    {categoryError && <p className="form-error">{categoryError}</p>}
    {add.isError && <p className="form-error">{errorMessage(add.error)}</p>}{remove.isError && <p className="form-error">{errorMessage(remove.error)}</p>}
    {categories.isPending ? <LoadingState /> : categories.isError ? <ErrorState message={errorMessage(categories.error)} /> : !categories.data?.length ? <EmptyState label="Категории ещё не созданы." />
      : <div className="category-list">{categories.data.map((category) => <div className="category-row" key={category.id}><div>{category.imageUrl && <img className="category-image" src={category.imageUrl} alt="" loading="lazy" />}<b>{category.name}</b><span>{category._count?.products ?? 0} товаров</span></div><div className="category-actions"><label className="button-icon" title="Загрузить изображение"><span>+</span><input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadCategoryImage(category, event.target.files)} /></label><button className="button-icon" title="Переименовать категорию" onClick={() => { const name = window.prompt('Новое название категории', category.name)?.trim(); if (name && name !== category.name) rename.mutate({ id: category.id, name, imageUrl: category.imageUrl, imageKey: category.imageKey }); }}><Pencil size={16} /></button><button className="button-icon danger-icon" title="Удалить категорию" onClick={() => { if (window.confirm(`Удалить категорию «${category.name}»?`)) remove.mutate(category.id); }}><Trash2 size={17} /></button></div></div>)}</div>}
    {rename.isError && <p className="form-error">{errorMessage(rename.error)}</p>}
  </PageContainer>;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await api.get<User[]>('/admin/users')).data });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: object }) => api.patch(`/admin/users/${id}`, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  return <PageContainer><div className="page-heading"><span className="eyebrow">УПРАВЛЕНИЕ ДОСТУПОМ</span><h1>Пользователи и агенты</h1><p>Роль назначается администратором. Только активные пользователи могут входить.</p></div>
    {users.isPending ? <LoadingState /> : users.isError ? <ErrorState message={errorMessage(users.error)} retry={() => users.refetch()} /> : !users.data?.length ? <EmptyState label="Пользователей пока нет." />
      : <div className="table-wrap"><table><thead><tr><th>Пользователь</th><th>Телефон</th><th>Роль</th><th>Аккаунт</th><th>Регистрация</th></tr></thead><tbody>
        {users.data.map((user) => <tr key={user.id}><td><div className="table-product"><b>{user.name}</b><small>{user.agentProfile?.referralCode ?? '—'}</small></div></td><td>{user.phone}</td>
          <td><select aria-label={`Роль для ${user.name}`} value={user.role} disabled={update.isPending} onChange={(event) => update.mutate({ id: user.id, values: { role: event.target.value } })}><option value="CUSTOMER">Покупатель</option><option value="AGENT">Агент</option><option value="ADMIN">Администратор</option></select></td>
          <td><button className={user.isActive ? 'toggle-enabled' : 'toggle-disabled'} onClick={() => update.mutate({ id: user.id, values: { isActive: !user.isActive } })}>{user.isActive ? 'Активен' : 'Заблокирован'}</button></td>
          <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}</td></tr>)}
      </tbody></table></div>}
    {update.isError && <p className="form-error">{errorMessage(update.error)}</p>}
  </PageContainer>;
}

interface AgentSales { id: string; name: string; phone: string; isActive: boolean; ordersCount: number; sales: string; profit: string }
export function AdminAgentsPage() {
  const query = useQuery({ queryKey: ['admin-agents'], queryFn: async () => (await api.get<AgentSales[]>('/admin/agents')).data });
  return <PageContainer><div className="page-heading"><span className="eyebrow">ПАРТНЁРСКАЯ СЕТЬ</span><h1>Продажи агентов</h1><p>Показатели рассчитаны по всем заказам, кроме отменённых.</p></div>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} /> : !query.data?.length ? <EmptyState label="Агентов с продажами пока нет." />
      : <div className="table-wrap"><table><thead><tr><th>Агент</th><th>Телефон</th><th>Заказы</th><th>Продажи</th><th>Прибыль</th><th>Аккаунт</th></tr></thead><tbody>{query.data.map((agent) => <tr key={agent.id}><td><b>{agent.name}</b></td><td>{agent.phone}</td><td>{agent.ordersCount}</td><td>{formatMoney(agent.sales)}</td><td className="agent-profit">{formatMoney(agent.profit)}</td><td>{agent.isActive ? 'Активен' : 'Заблокирован'}</td></tr>)}</tbody></table></div>}
  </PageContainer>;
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get<{ lowStockThreshold: number; telegramConfigured: boolean }>('/admin/settings')).data });
  const form = useForm<{ lowStockThreshold: number }>({ values: { lowStockThreshold: query.data?.lowStockThreshold ?? 5 } });
  const mutation = useMutation({
    mutationFn: (values: { lowStockThreshold: number }) => api.patch('/admin/settings', values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-settings'] }); await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }); },
  });
  return <PageContainer><div className="page-heading"><span className="eyebrow">ПЛАТФОРМА</span><h1>Настройки</h1><p>Порог наличия и состояние интеграций.</p></div>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} /> : <>
      <div className="settings-grid"><section className="panel-card"><div className="panel-heading"><div><h2>Склад</h2><p>Сигнализировать администратору о низком остатке.</p></div><Settings2 size={19} /></div>
        <form className="form-stack" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><label className="field"><span>Минимальный остаток (шт.)</span><input type="number" min={0} max={100000} {...form.register('lowStockThreshold', { valueAsNumber: true })} /></label>{mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}<button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить настройки'}</button></form>
      </section>
      <section className="panel-card"><div className="panel-heading"><div><h2>Telegram-бот</h2><p>Уведомления о заказах и изменениях статуса.</p></div><ShieldCheck size={19} /></div><div className={`integration-status ${query.data.telegramConfigured ? 'integration-ok' : 'integration-off'}`}><span />{query.data.telegramConfigured ? 'Подключён по переменным окружения' : 'Не настроен'}</div><p className="muted">Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID в серверный .env. Токен не доступен через интерфейс.</p></section></div>
      <AdminNotifications />
    </>}
  </PageContainer>;
}

interface NotificationRow {
  id: string;
  event: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  order: { orderNumber: number; customerName: string };
}

function AdminNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-notifications'], queryFn: async () => (await api.get<NotificationRow[]>('/admin/notifications')).data });
  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/notifications/${id}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });
  return <section className="notifications-section">
    <div className="panel-heading notifications-heading"><div><h2>История Telegram-уведомлений</h2><p>Сбойные сообщения можно отправить повторно.</p></div></div>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
      : !query.data?.length ? <EmptyState label="Уведомлений пока нет." />
        : <div className="table-wrap"><table><thead><tr><th>Заказ</th><th>Событие</th><th>Состояние</th><th>Попытки</th><th>Последняя ошибка</th><th /></tr></thead><tbody>
          {query.data.map((item) => <tr key={item.id}><td>№{item.order.orderNumber} · {item.order.customerName}</td><td>{item.event === 'ORDER_CREATED' ? 'Новый заказ' : item.event === 'ORDER_CANCELLED' ? 'Отмена' : 'Изменение статуса'}</td>
            <td><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === 'SENT' ? 'Отправлено' : item.status === 'FAILED' ? 'Ошибка' : item.status === 'PROCESSING' ? 'Отправляется' : 'В очереди'}</span></td>
            <td>{item.attempts}</td><td className="notification-error">{item.lastError ?? '—'}</td><td>{item.status === 'FAILED' && <button className="button button-outline button-small" disabled={retry.isPending} onClick={() => retry.mutate(item.id)}><RotateCw size={14} /> Повторить</button>}</td></tr>)}
        </tbody></table></div>}
    {retry.isError && <p className="form-error">{errorMessage(retry.error)}</p>}
  </section>;
}
