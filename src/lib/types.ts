export type OrderStatus = "pending" | "waiting" | "unprocessed" | "accepted" | "cooking" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderMode = "dine-in" | "takeout";
export type StoreOrderStatus = "open" | "paused" | "closed";
export type StoreMemberRole = "owner" | "manager" | "staff" | "viewer";
export type UserRole = "user" | "merchant" | "kitchen" | "admin" | StoreMemberRole;
export type StoreType = "breakfast" | "drink" | "snack" | "hotpot";
export type DiscountType = "none" | "percent" | "amount" | "specialPrice";
export type DeviceType = "kitchen" | "label" | "display" | "scanner";
export type DeviceConnectionType = "bluetooth" | "usb" | "lan";
export type PrinterStation = "kitchen" | "counter" | "bar" | "custom";
export type PrintTemplateSize = "small" | "medium" | "large" | "xlarge";
export type PrintOrderType = "dineIn" | "takeout" | "qr" | "pos";

export type PrintTemplateField = {
  visible: boolean;
  size: PrintTemplateSize;
  bold?: boolean;
};

export type PrintTemplate = {
  orderNumber: PrintTemplateField;
  tableNumber: PrintTemplateField;
  orderType: PrintTemplateField;
  productName: PrintTemplateField;
  quantity: PrintTemplateField;
  modifiers: PrintTemplateField;
  note: PrintTemplateField;
  price: PrintTemplateField;
  total: PrintTemplateField;
  storeName: PrintTemplateField;
  createdAt: PrintTemplateField;
};

export type PrintRouting = {
  stationName: string;
  categoryIds: string[];
  productIds: string[];
  orderTypes: PrintOrderType[];
};

export type Store = {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl?: string;
  phone?: string;
  address?: string;
  businessHours?: string;
  description?: string;
  takeoutEnabled?: boolean;
  dineInEnabled?: boolean;
  takeoutOrderingEnabled?: boolean;
  dineInOrderingEnabled?: boolean;
  posOrderingEnabled?: boolean;
  ownerId?: string;
  storeType?: StoreType;
  isOpen: boolean;
  orderStatus?: StoreOrderStatus;
  peakMode?: boolean;
  demoBreakfastMenuImported?: boolean;
  temporaryNotice?: string;
  notice?: string;
  createdAt: string;
};

export type User = {
  id: string;
  storeId: string | null;
  storeIds?: string[];
  memberships?: Record<string, StoreMemberRole>;
  storeRoles?: Record<string, StoreMemberRole>;
  pending?: boolean;
  approved?: boolean;
  status?: "pending" | "active" | "rejected";
  createdAt?: string;
  updatedAt?: string;
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
  discountType?: DiscountType;
  discountValue?: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  sort: number;
  options?: ProductOption[];
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
  name?: string;
  quantity: number;
  unitPrice: number;
  price?: number;
  originalPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
  finalPrice?: number;
  selectedOptions: OrderItemOption[];
  note: string;
  itemNote?: string;
};

export type Table = {
  id: string;
  storeId: string;
  tableNo?: string;
  name?: string;
  tableName: string;
  area?: string;
  number?: number;
  enabled: boolean;
  qrUrl: string;
  isActive?: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
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

export type Device = {
  id: string;
  storeId: string;
  type: DeviceType;
  name: string;
  brand: string;
  model: string;
  connectionType: DeviceConnectionType;
  ipAddress?: string;
  port?: string;
  macAddress?: string;
  usbVendorId?: string;
  usbProductId?: string;
  bluetoothName?: string;
  paperWidth?: "58mm" | "80mm";
  station?: PrinterStation;
  categoryIds?: string[];
  printRouting?: PrintRouting;
  printTemplate?: PrintTemplate;
  labelMode?: "cup" | "takeout" | "pickup";
  labelSize?: string;
  autoPrint?: boolean;
  enabled: boolean;
  connectionStatus?: "not_tested" | "online" | "offline" | "mock";
  createdAt: string;
  updatedAt: string;
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
  orderType?: OrderMode;
  tableName?: string;
  tableNumber?: string;
  customerNote: string;
  status: OrderStatus;
  source: "qr" | "pos";
  rejectReason?: string;
  cancelReason?: string;
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
  cashFlows?: CashFlow[];
  cashFlowItems?: CashFlowItem[];
  optionGroups?: ProductOptionGroup[];
  optionItems?: OptionItem[];
  bundleGroups?: BundleGroup[];
  bundleItems?: BundleItem[];
  tables?: Table[];
  dailySalesSummaries?: DailySalesSummary[];
  devices?: Device[];
};

export type CashFlowType = "income" | "expense";

export type CashFlow = {
  id: string;
  storeId: string;
  itemId?: string;
  itemName?: string;
  type: CashFlowType;
  amount: number;
  category?: string;
  note: string;
  createdAt: string;
  createdBy?: string;
};

export type CashFlowAmountMode = "open" | "fixed";

export type CashFlowItem = {
  id: string;
  storeId: string;
  name: string;
  type: CashFlowType;
  amountMode: CashFlowAmountMode;
  fixedAmount?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
