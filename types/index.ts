// ============================================================
// CRISPY CHARLES - Types
// ============================================================

export interface SessionSummary {
  total_orders:   number;
  total_revenue:  number;
  cash_revenue:   number;
  stripe_revenue: number;
  delivery_fees:  number;
  items_sold:     { name: string; qty: number; revenue: number }[];
  extras_sold:    { name: string; qty: number; revenue: number }[];
  orders_snapshot: {
    id: string; customer_name: string; total: number;
    payment_method: string; payment_status: string; status: string;
  }[];
}

export interface Session {
  id:         string;
  opened_at:  string;
  closed_at:  string | null;
  summary:    SessionSummary | null;
  created_at: string;
}

export interface Settings {
  id: number;
  business_open: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  business_hours: string;
  closed_message: string;
  delivery_fee: number;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  display_order: number;
  active: boolean;
}

export interface ProductVariant {
  name: string;       // "Regular" | "Combo" | "HOT"
  price: number;
  includes?: string;  // e.g. "Papas + Refresco + 1 Dip"
  badge?: string;     // e.g. "🌶️"
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  variants: ProductVariant[];
  image_url: string | null;
  active: boolean;
  display_order: number;
  categories?: Category;
}

export interface Extra {
  id: string;
  name: string;
  price: number;
  active: boolean;
  display_order: number;
}

// Cart item: producto + variante elegida + cantidad
export interface CartItem {
  product_id: string;
  product_name: string;
  variant_name: string;
  unit_price: number;
  qty: number;
  subtotal: number;
}

// Extra en el carrito
export interface CartExtra {
  extra_id: string;
  extra_name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export type DeliveryType = 'pickup' | 'delivery';
export type PaymentMethod = 'stripe' | 'cash';
export type PaymentStatus = 'pending' | 'paid';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered';

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  items: CartItem[];
  extras: CartExtra[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
}

// Payload para crear una orden
export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  items: CartItem[];
  extras: CartExtra[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: DeliveryType;
  delivery_address?: string;
  payment_method: PaymentMethod;
  stripe_payment_intent_id?: string;
  scheduled_time?: string | null; // null = ahora mismo, string = "HH:MM"
  notes?: string;
}
