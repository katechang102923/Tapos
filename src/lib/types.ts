export type OrderStatus = "pending" | "accepted" | "cooking" | "ready" | "completed" | "cancelled";
export type OrderMode = "dine-in" | "takeout";
export type UserRole = "user" | "merchant" | "kitchen" | "admin";
export type StoreType = "breakfast" | "drink" | "snack" | "hotpot";

export type Store = {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl?: string;
  phone?: string;
  address?: string;
  businessHours?: string;
  description?: string;
  ownerId?: string;
  storeType?: StoreType;
  isOpen: boolean;
  peakMode?: boolean;
  temporaryNotice?: string;
  notice?: string;
  createdAt: string;
};

export type User = {
  id: string;
  storeId: string | null;
  name: string;
  email: string;
  role: UserRole;
};

export type Category = {
  id: string;
  storeId: string;
  name: string;
  sort: number;
  isActive: boolean;
};

export type ProductOption = {
  name: string;
  values: string[];
  required?: boolean;
};

export type Product = {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  originalPrice?: number;
  price: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  sort: number;
  options: ProductOption[];
};

export type OrderItem = {
  id: string;
  orderId: string;
  storeId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: Record<string, string>;
  note: string;
};

export type Order = {
  id: string;
  storeId: string;
  orderNumber: string;
  pickupNumber: string;
  mode: OrderMode;
  tableNo: string;
  customerName?: string;
  customerSessionId?: string;
  customerNote: string;
  status: OrderStatus;
  source: "qr" | "pos";
  rejectReason?: string;
  total: number;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type DemoDatabase = {
  stores: Store[];
  users: User[];
  categories: Category[];
  products: Product[];
  orders: Order[];
};
