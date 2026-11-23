import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Search, ShoppingBag, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage, formatMoney } from '../../lib/api';
import { Category, Department, Product } from '../../types';
import { useAuth } from '../auth/AuthProvider';
import { useCart } from '../cart/CartProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView';
import { PageContainer } from '../../components/Layout';

function ProductCard({ product, agentMode }: { product: Product; agentMode: boolean }) {
  const { add } = useCart();
  const [price, setPrice] = useState(product.recommendedPrice);
  const [added, setAdded] = useState(false);
  const cost = Number(product.costPrice ?? 0);
  const profit = Number(price) - cost;
  const inventory = product.inventory?.quantity ?? 0;
  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-image-wrap">
        {product.imageUrl
          ? <img className="product-image" src={product.imageUrl} alt={product.name} loading="lazy" />
          : <div className="image-placeholder"><ShoppingBag size={30} /></div>}
        <span className="category-pill">{product.category.name}</span>
      </Link>
      <div className="product-card-content">
        <div className="product-meta"><span>Артикул {product.sku}</span><span className="stock-label">В наличии: {inventory}</span></div>
        <Link to={`/products/${product.id}`} className="product-title">{product.name}</Link>
        <p className="product-description">{product.description}</p>
        {agentMode ? (
          <div className="agent-pricing">
            <div className="price-row"><span>Закупка</span><b>{formatMoney(product.costPrice ?? '0')}</b></div>
            <div className="price-row"><span>Цена продажи</span>
              <input aria-label={`Цена продажи: ${product.name}`} type="number" min={product.minimumPrice} step="1000"
                max={Number(product.costPrice ?? 0) + Number(product.maximumMarkup ?? 0)}
                disabled={!product.allowAgentPriceChange} value={product.allowAgentPriceChange ? price : product.recommendedPrice}
                onChange={(event) => setPrice(event.target.value)} />
            </div>
            <div className="agent-profit">Ваша прибыль: {formatMoney(Number.isFinite(profit) ? profit : 0)}</div>
          </div>
        ) : <div className="product-price">{formatMoney(product.recommendedPrice)}</div>}
        <button className={`button ${added ? 'button-added' : 'button-primary'} button-full`}
          onClick={() => { add(product, agentMode ? (product.allowAgentPriceChange ? price : product.recommendedPrice) : undefined); setAdded(true); window.setTimeout(() => setAdded(false), 1200); }}>
          {added ? 'Добавлено в корзину' : 'Добавить в корзину'} <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

export function CatalogPage() {
  const { department: departmentSlug, category: categorySlug } = useParams<{ department: string; category: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const agentMode = user?.role === 'AGENT';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('newest');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<Category[]>('/categories')).data });
  const departments = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.get<Department[]>('/categories/departments')).data });
  const departmentProducts = useQueries({ queries: (departments.data ?? []).filter((item) => item.isActive).map((item) => ({
    queryKey: ['department-featured', item.slug],
    queryFn: async () => (await api.get<Product[]>('/products', { params: { department: item.slug } })).data.slice(0, 2),
    staleTime: 60_000,
  })) });
  const department = departments.data?.find((item) => item.slug === departmentSlug);
  useEffect(() => {
    if (categorySlug && categories.data) setCategoryId(categories.data.find((category) => category.slug === categorySlug)?.id ?? '');
    else setCategoryId('');
  }, [categorySlug, categories.data]);
  const products = useQuery({
    queryKey: ['products', agentMode, categoryId, search, departmentSlug, sort, attributeFilters],
    queryFn: async () => (await api.get<Product[]>(agentMode ? '/agent/catalog' : '/products', {
      params: { categoryId: categoryId || undefined, search: search || undefined, department: departmentSlug || undefined, sort: sort === 'newest' ? undefined : sort, attributes: Object.keys(attributeFilters).length ? JSON.stringify(attributeFilters) : undefined },
    })).data,
  });
  const categoryCount = useMemo(() => categories.data?.reduce((sum, category) => sum + (category._count?.products ?? 0), 0) ?? 0, [categories.data]);
  const selectedCategory = categories.data?.find((category) => category.id === categoryId);
  return (
    <PageContainer>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> {agentMode ? 'КАТАЛОГ ДЛЯ АГЕНТОВ' : 'МАГАЗИН DROPSTORE'}</span>
          <h1>{agentMode ? <>Товары для<br /><span>ваших продаж</span></> : <>Хорошие вещи.<br /><span>Простые продажи.</span></>}</h1>
          <p>{agentMode ? 'Выбирайте товары, устанавливайте цену в разрешённых пределах и оформляйте заказ за пару минут.' : 'Выбирайте проверенные товары, а мы поможем оформить заказ с доставкой.'}</p>
          <a className="button button-dark" href="#catalog">Перейти в каталог <ArrowRight size={17} /></a>
        </div>
        <div className="hero-art">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-product-mark"><ShoppingBag size={70} strokeWidth={1.2} /></div>
          <span className="hero-float float-one">Продажи проще</span>
          <span className="hero-float float-two">{categoryCount || 0}+ товаров</span>
        </div>
      </section>
      {!agentMode && !departmentSlug && departments.data && departments.data.length > 0 && (
        <section className="department-grid" aria-label="Торговые направления">
          {departments.data.filter((item) => item.isActive).map((item, index) => (
            <Link className={`department-card department-${item.slug}`} key={item.id} to={`/catalog/${item.slug}`}>
              {item.imageUrl ? <img className="department-cover" src={item.imageUrl} alt="" loading="lazy" /> : <span className="department-cover department-cover-fallback" aria-hidden="true" />}
              <span className="department-card-content"><span className="eyebrow">ТОРГОВОЕ НАПРАВЛЕНИЕ</span><strong>{item.name}</strong><span>{item.description}</span><b>Перейти в каталог <ArrowRight size={15} /></b></span>
              <span className="department-categories">{(item.categories ?? []).filter((category) => category.isActive && !category.parentId).slice(0, 4).map((category) => category.name).join(' · ')}</span>
              <span className="department-featured">{departmentProducts[index]?.data?.map((product) => <span key={product.id}>{product.name}</span>)}</span>
            </Link>
          ))}
        </section>
      )}
      {!agentMode && !departmentSlug && categories.data && categories.data.length > 0 && (
        <section className="home-categories" aria-labelledby="categories-title">
          <div className="section-heading">
            <div><span className="eyebrow">DROPSTORE</span><h2 id="categories-title">Популярные категории</h2><p>Подборки товаров по всем торговым направлениям.</p></div>
          </div>
          <div className="category-grid">
            {categories.data.filter((category) => category.isActive && !category.parentId).slice(0, 8).map((category) => (
              <Link className="category-card" key={category.id} to={`/catalog/${category.department?.slug ?? 'home'}/${category.slug}`}>
                {category.imageUrl ? <img src={category.imageUrl} alt="" loading="lazy" /> : <span className="category-card-art"><ShoppingBag size={34} /></span>}
                <span className="category-card-copy"><strong>{category.name}</strong><span>{category._count?.products ?? 0} товаров <ArrowRight size={16} /></span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section id="catalog" className="catalog-section">
        {department && <nav className="catalog-breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span>/</span><Link to={`/catalog/${department.slug}`}>{department.name}</Link>{categorySlug && <><span>/</span><span>{categories.data?.find((category) => category.slug === categorySlug)?.name ?? categorySlug}</span></>}</nav>}
        <div className="section-heading">
          <div><span className="eyebrow">{department?.name ?? 'ПОДБОРКА DROPSTORE'}</span><h2>{department ? `Каталог: ${department.name}` : 'Популярные товары'}</h2><p>{department?.description || 'Найдите то, что понравится вашим покупателям.'}</p></div>
          <div className="catalog-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар…" /><SlidersHorizontal size={17} /></div>
        </div>
        {categories.isError && <ErrorState message={errorMessage(categories.error)} />}
        <div className="category-filters">
          <button className={!categoryId ? 'category-filter active' : 'category-filter'} onClick={() => { setAttributeFilters({}); navigate(departmentSlug ? `/catalog/${departmentSlug}` : '/'); }}>Все товары</button>
          {categories.data?.filter((category) => category.isActive && (!departmentSlug || category.department?.slug === departmentSlug)).map((category) => <button key={category.id} className={categoryId === category.id ? 'category-filter active' : 'category-filter'} onClick={() => { setAttributeFilters({}); navigate(`/catalog/${category.department?.slug ?? departmentSlug ?? 'home'}/${category.slug}`); }}>{category.name}</button>)}
        </div>
        <div className="catalog-controls">
          <label className="field"><span>Сортировка</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Сначала новые</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option><option value="name">По названию</option></select></label>
          {selectedCategory?.attributes?.map((attribute) => <label className="field" key={attribute.key}><span>{attribute.label}</span>{attribute.type === 'select' ? <select value={attributeFilters[attribute.key] ?? ''} onChange={(event) => setAttributeFilters((current) => ({ ...current, [attribute.key]: event.target.value }))}><option value="">Любое значение</option>{(attribute.options as string[] | null)?.map((option) => <option key={option}>{option}</option>)}</select> : <input type={attribute.type === 'number' ? 'number' : attribute.type === 'date' ? 'date' : 'text'} value={attributeFilters[attribute.key] ?? ''} onChange={(event) => setAttributeFilters((current) => ({ ...current, [attribute.key]: event.target.value }))} placeholder="Любое значение" />}</label>)}
        </div>
        {products.isPending ? <LoadingState /> : products.isError
          ? <ErrorState message={errorMessage(products.error)} retry={() => products.refetch()} />
          : products.data?.length
            ? <div className="product-grid">{products.data.map((product) => <ProductCard key={product.id} product={product} agentMode={agentMode} />)}</div>
            : <EmptyState label="Товары не найдены. Попробуйте изменить поиск или категорию." />}
      </section>
      {!agentMode && <section className="benefits-section" aria-labelledby="benefits-title">
        <div className="benefits-intro"><span className="eyebrow">ПОКУПКИ БЕЗ ЛИШНИХ ШАГОВ</span><h2 id="benefits-title">Всё нужное — в одном месте</h2><p>Удобный каталог помогает быстро найти подходящие товары и оформить заказ.</p></div>
        <div className="benefits-grid">
          <article><span className="benefit-number">01</span><strong>Понятный выбор</strong><p>Категории и поиск помогают сориентироваться в ассортименте.</p></article>
          <article><span className="benefit-number">02</span><strong>Простое оформление</strong><p>Добавьте товары в корзину и укажите данные для заказа.</p></article>
          <article><span className="benefit-number">03</span><strong>Доставка по адресу</strong><p>Укажите адрес и отметьте точку на карте при оформлении.</p></article>
          <article><span className="benefit-number">04</span><strong>Поддержка покупателей</strong><p>Оставьте комментарий к заказу, если нужно уточнить детали.</p></article>
        </div>
      </section>}
    </PageContainer>
  );
}

function ProductGallery({ product }: { product: Product }) {
  const images = [...new Set([product.imageUrl, ...(product.imageUrls ?? [])].filter((url): url is string => Boolean(url)))];
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!images.length) {
    return <div className="detail-gallery detail-gallery-empty"><ShoppingBag size={60} /></div>;
  }

  const showImage = (index: number) => setActiveIndex((index + images.length) % images.length);
  const handleTouchEnd = (touchEndX: number) => {
    if (touchStartX.current === null || images.length < 2) return;
    const difference = touchStartX.current - touchEndX;
    if (Math.abs(difference) > 40) showImage(activeIndex + (difference > 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <div className="detail-gallery">
      <div
        className="detail-gallery-main"
        onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
      >
        <img src={images[activeIndex]} alt={`${product.name} — фото ${activeIndex + 1}`} />
        {images.length > 1 && (
          <>
            <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="Предыдущее фото" onClick={() => showImage(activeIndex - 1)}><ArrowLeft size={20} /></button>
            <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="Следующее фото" onClick={() => showImage(activeIndex + 1)}><ArrowRight size={20} /></button>
            <span className="gallery-counter">{activeIndex + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails" aria-label="Все фотографии товара">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              className={index === activeIndex ? 'gallery-thumbnail active' : 'gallery-thumbnail'}
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => showImage(index)}
            >
              <img src={image} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailsPage() {
  const { user } = useAuth();
  const { add } = useCart();
  const id = window.location.pathname.split('/').pop() ?? '';
  const query = useQuery({
    queryKey: ['product', id, user?.role],
    queryFn: async () => (await api.get<Product>(`/products/${id}`)).data,
    enabled: user?.role !== 'AGENT',
  });
  const agentProduct = useQuery({
    queryKey: ['agent-product', id],
    queryFn: async () => (await api.get<Product>(`/agent/catalog/${id}`)).data,
    enabled: user?.role === 'AGENT',
  });
  const product = user?.role === 'AGENT' ? agentProduct.data : query.data;
  const error = user?.role === 'AGENT' ? agentProduct.error : query.error;
  const isPending = user?.role === 'AGENT' ? agentProduct.isPending : query.isPending;
  const [price, setPrice] = useState<string | null>(null);
  if (isPending) return <PageContainer><LoadingState /></PageContainer>;
  if (error || !product) return <PageContainer><ErrorState message={error ? errorMessage(error) : 'Товар не найден'} /></PageContainer>;
  const salePrice = price ?? product.recommendedPrice;
  return (
    <PageContainer className="detail-page">
      <Link className="back-link" to="/"><ArrowRight className="back-arrow" size={16} /> Назад в каталог</Link>
      {product.category.department && <nav className="catalog-breadcrumbs detail-breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span>/</span><Link to={`/catalog/${product.category.department.slug}`}>{product.category.department.name}</Link><span>/</span><Link to={`/catalog/${product.category.department.slug}/${product.category.slug}`}>{product.category.name}</Link></nav>}
      <div className="detail-layout">
        <ProductGallery key={product.id} product={product} />
        <div className="detail-content">
          <span className="eyebrow">{product.category.name} · {product.sku}</span>
          <h1>{product.name}</h1><p className="detail-description">{product.description}</p>
          {product.attributes && Object.keys(product.attributes).length > 0 && <dl className="product-attributes">{Object.entries(product.attributes).map(([key, value]) => <div key={key}><dt>{product.category.attributes?.find((attribute) => attribute.key === key)?.label ?? key}</dt><dd>{String(value)}</dd></div>)}</dl>}
          {user?.role === 'AGENT' && <p className="muted">Закупочная стоимость: <b>{formatMoney(product.costPrice ?? 0)}</b></p>}
          <div className="detail-price">{formatMoney(salePrice)}</div>
          <p className="muted">Остаток на складе: {product.inventory?.quantity ?? 0}</p>
          {user?.role === 'AGENT' && product.allowAgentPriceChange && (
            <label className="field"><span>Ваша цена продажи (от {formatMoney(product.minimumPrice ?? 0)})</span>
              <input type="number" min={product.minimumPrice} max={Number(product.costPrice ?? 0) + Number(product.maximumMarkup ?? 0)} step="1000" value={salePrice} onChange={(event) => setPrice(event.target.value)} />
            </label>
          )}
          {user?.role === 'AGENT' && <p className="agent-profit">Предварительная прибыль: {formatMoney(Number(salePrice) - Number(product.costPrice ?? 0))}</p>}
          <button className="button button-primary" onClick={() => add(product, user?.role === 'AGENT' ? salePrice : undefined)}>Добавить в корзину <ShoppingBag size={17} /></button>
          <p className="muted small-note">Цена и наличие проверяются сервером при оформлении заказа.</p>
        </div>
      </div>
    </PageContainer>
  );
}
