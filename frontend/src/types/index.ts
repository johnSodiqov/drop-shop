export type Role = 'ADMIN' | 'AGENT' | 'CUSTOMER';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PACKING' | 'DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
  agentProfile?: { referralCode: string } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  imageKey?: string | null;
  _count?: { products: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageUrls?: string[];
  imageKeys?: string[];
  costPrice?: string;
  recommendedPrice: string;
  minimumPrice?: string;
  maximumMarkup?: string;
  allowAgentPriceChange?: boolean;
  status: string;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  inventory: { quantity: number } | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  costPrice: string;
  salePrice: string;
  profit: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  paymentMethod: 'CASH' | 'CARD_ON_DELIVERY' | 'TRANSFER_AGENT';
  comment: string | null;
  status: OrderStatus;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  createdAt: string;
  items: OrderItem[];
  statusHistory?: Array<{ from: OrderStatus; to: OrderStatus; createdAt: string }>;
}
