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
  demoBreakfastMenuImported?: boolean;
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

export type ProductOptionChoice = {
  id: string;
  name: string;
  optionName?: string;
  priceDelta: number;
  isAvailable: boolean;
  children?: ProductOptionGroup[];
  nextGroupIds?: string[];
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  groupName?: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ProductOptionChoice[];
};

export type ProductOptionRecord = {
  id: string;
  storeId: string;
  productId: string;
  optionGroups: ProductOptionGroup[];
  updatedAt: string;
};

export type OptionItem = {
  id: string;
  storeId: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  sort: number;
};

export type BundleGroup = {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sort: number;
};

export type BundleItem = {
  id: string;
  storeId: string;
  bundleGroupId: string;
  name: string;
  priceDelta: number;
  allowanceAmount?: number;
  isAvailable: boolean;
  sort: number;
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
  optionGroups?: ProductOptionGroup[];
};

export type OrderItemOption = {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: number;
  level?: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  storeId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: OrderItemOption[];
  note: string;
};

export type Table = {
  id: string;
  storeId: string;
  tableNo: string;
  name: string;
  qrUrl: string;
  isActive: boolean;
  sort: number;
};

export type DailySalesSummary = {
  id: string;
  storeId: string;
  date: string;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: number;
  }>;
};

export type OrderItemPayload = Omit<OrderItem, "id" | "orderId"> & {
  id?: string;
  orderId?: string;
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

export type OrderPayload = Omit<Order, "id" | "orderNumber" | "pickupNumber" | "createdAt" | "updatedAt" | "items" | "status" | "source"> & {
  items: OrderItemPayload[];
  status?: OrderStatus;
  source?: "qr" | "pos";
};

export type DemoDatabase = {
  stores: Store[];
  users: User[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  optionGroups?: ProductOptionGroup[];
  optionItems?: OptionItem[];
  bundleGroups?: BundleGroup[];
  bundleItems?: BundleItem[];
  tables?: Table[];
  dailySalesSummaries?: DailySalesSummary[];
};
