import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Search, ShoppingBag, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, formatMoney } from '../../lib/api';
import { Category, Product } from '../../types';
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
  const { user } = useAuth();
  const agentMode = user?.role === 'AGENT';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<Category[]>('/categories')).data });
  const products = useQuery({
    queryKey: ['products', agentMode, categoryId, search],
    queryFn: async () => (await api.get<Product[]>(agentMode ? '/agent/catalog' : '/products', {
      params: { categoryId: categoryId || undefined, search: search || undefined },
    })).data,
  });
  const categoryCount = useMemo(() => categories.data?.reduce((sum, category) => sum + (category._count?.products ?? 0), 0) ?? 0, [categories.data]);
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
      <section id="catalog" className="catalog-section">
        <div className="section-heading">
          <div><span className="eyebrow">ПОДБОРКА DROPSTORE</span><h2>Популярные товары</h2><p>Найдите то, что понравится вашим покупателям.</p></div>
          <div className="catalog-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар…" /><SlidersHorizontal size={17} /></div>
        </div>
        {categories.isError && <ErrorState message={errorMessage(categories.error)} />}
        <div className="category-filters">
          <button className={!categoryId ? 'category-filter active' : 'category-filter'} onClick={() => setCategoryId('')}>Все товары</button>
          {categories.data?.map((category) => <button key={category.id} className={categoryId === category.id ? 'category-filter active' : 'category-filter'} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
        </div>
        {products.isPending ? <LoadingState /> : products.isError
          ? <ErrorState message={errorMessage(products.error)} retry={() => void products.refetch()} />
          : products.data?.length
            ? <div className="product-grid">{products.data.map((product) => <ProductCard key={product.id} product={product} agentMode={agentMode} />)}</div>
            : <EmptyState label="Товары не найдены. Попробуйте изменить поиск или категорию." />}
      </section>
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
      <div className="detail-layout">
        <ProductGallery key={product.id} product={product} />
        <div className="detail-content">
          <span className="eyebrow">{product.category.name} · {product.sku}</span>
          <h1>{product.name}</h1><p className="detail-description">{product.description}</p>
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
