export type OrderStatus = "pending" | "waiting" | "unprocessed" | "accepted" | "cooking" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderMode = "dine-in" | "takeout";
export type StoreOrderStatus = "open" | "paused" | "closed";
export type StoreMemberRole = "owner" | "manager" | "staff" | "viewer";
export type SubscriptionStatus = "trial" | "active" | "expired" | "suspended";
export type AccessStatus = "active" | "expired" | "suspended";
export type UserRole = "user" | "merchant" | "kitchen" | "admin" | StoreMemberRole;
export type StoreType = "breakfast" | "drink" | "snack" | "hotpot";
export type BusinessType = "breakfast" | "drink" | "snack" | "restaurant" | "other";
export type DiscountType = "none" | "percent" | "amount" | "specialPrice";
export type PromotionType = "buy_x_get_y" | "buy_one_get_one" | "second_half_price" | "percent_discount" | "amount_discount";

export type StoreUserAccess = {
  accessStartsAt?: string;
  accessEndsAt?: string;
  accessStatus?: AccessStatus;
};

export type UserPermissions = {
  canViewDailyReport: boolean;
  canManageMenu: boolean;
  canManagePromotions: boolean;
  canUseCashflow: boolean;
  canUseKDS: boolean;
  canManageUsers: boolean;
  canViewOrders: boolean;
  canCancelOrders: boolean;
  canApplyDiscounts: boolean;
  canViewPlatformTools: boolean;
  // Member management
  canManageMembers: boolean;
  canUseMemberLookup: boolean;
  canAdjustMemberPoints: boolean;
  canUseStoredValue: boolean;
};

export type PointLogType = "earn" | "redeem" | "adjust" | "rollback" | "points_add" | "points_use";
export type StoredValueLogType = "topup" | "payment" | "spend" | "adjust" | "refund";

export type MemberSettings = {
  pointsEnabled?: boolean;
  pointsPerAmount?: number; // spend this many yen to get pointsReward points
  pointsReward?: number;    // points earned per unit
};

export type Customer = {
  id: string;
  storeId: string;
  memberNo: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  note?: string;
  points: number;
  storedValueBalance: number;
  balance?: number;
  totalSpent: number;
  totalOrders: number;
  lastOrderAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PointLog = {
  id: string;
  storeId: string;
  customerId: string;
  type: PointLogType;
  points: number;
  orderId?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
  archiveEligible?: boolean;
  archivedAt?: string | null;
};

export type StoredValueLog = {
  id: string;
  storeId: string;
  customerId: string;
  memberId?: string;
  memberName?: string;
  type: StoredValueLogType;
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  beforePoints?: number;
  afterPoints?: number;
  orderId?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
  archiveEligible?: boolean;
  archivedAt?: string | null;
};

export type OrderCustomerInfo = {
  customerId: string;
  memberNo: string;
  name: string;
  phone: string;
};
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
  dataRetentionMonths?: number; // default 6
  takeoutEnabled?: boolean;
  dineInEnabled?: boolean;
  takeoutOrderingEnabled?: boolean;
  dineInOrderingEnabled?: boolean;
  posOrderingEnabled?: boolean;
  enablePickupDisplay?: boolean;
  reportEmailEnabled?: boolean;
  reportEmailRecipients?: string;
  reportEmailTime?: string;
  ownerId?: string;
  storeType?: StoreType;
  businessType?: BusinessType;
  contactName?: string;
  isOpen: boolean;
  orderStatus?: StoreOrderStatus;
  peakMode?: boolean;
  demoBreakfastMenuImported?: boolean;
  temporaryNotice?: string;
  notice?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartsAt?: string;
  subscriptionEndsAt?: string;
  trialEndsAt?: string;
  features?: {
    kdsEnabled?: boolean;
    dailyReportEnabled?: boolean;
    promotionEnabled?: boolean;
    cashFlowEnabled?: boolean;
    memberEnabled?: boolean;
    memberStoredValueEnabled?: boolean;
  };
  memberSettings?: MemberSettings;
  createdAt: string;
};

export type User = {
  id: string;
  storeId: string | null;
  storeIds?: string[];
  memberships?: Record<string, StoreMemberRole>;
  storeRoles?: Record<string, StoreMemberRole>;
  storePermissions?: Record<string, Partial<UserPermissions>>;
  storeAccess?: Record<string, StoreUserAccess>;
  accessEndsAt?: string;
  accessStatus?: AccessStatus;
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

export type ItemDiscount = {
  type: "amount" | "percent";
  value: number;
  amount: number;
  reason?: string;
};

export type OrderDiscount = {
  type: "amount" | "percent";
  value: number;
  amount: number;
  reason?: string;
  promotionId?: string;
  promotionName?: string;
};

export type DiscountSummary = {
  itemDiscountTotal: number;
  orderDiscountTotal: number;
  totalDiscount: number;
  promotionDiscountTotal?: number;
};

export type PromotionDiscountLine = {
  promotionId: string;
  promotionName: string;
  amount: number;
  targetName?: string;
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
  discount?: ItemDiscount;
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

export type PaymentMethod = "cash" | "stored_value" | "linepay" | "card" | "jkopay" | "ubereats" | "foodpanda" | "transfer" | "other";

export type PaymentMethodStat = {
  method: PaymentMethod | "unknown";
  label: string;
  count: number;
  amount: number;
  percent: number;
};

export type HourSlotStat = {
  slot: string;
  orderCount: number;
  revenue: number;
  isPeak: boolean;
};

export type Order = {
  id: string;
  storeId: string;
  orderNumber: string;
  pickupNumber: string;
  mode: OrderMode;
  tableNo: string;
  archiveEligible?: boolean;
  archivedAt?: string | null;
  customerName?: string;
  customerSessionId?: string;
  orderType?: OrderMode;
  tableName?: string;
  tableNumber?: string;
  customerNote: string;
  status: OrderStatus;
  source: "qr" | "pos" | "kiosk";
  rejectReason?: string;
  cancelReason?: string;
  total: number;
  totalAmount?: number;
  paymentMethod?: PaymentMethod;
  orderDiscount?: OrderDiscount;
  discountSummary?: DiscountSummary;
  promotionDiscounts?: PromotionDiscountLine[];
  customer?: OrderCustomerInfo;
  memberId?: string;
  memberPhone?: string;
  memberName?: string;
  pointsEarned?: number;
  pointsUsed?: number;
  storedValueUsed?: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrderPayload = Omit<Order, "id" | "orderNumber" | "pickupNumber" | "createdAt" | "updatedAt" | "items" | "status" | "source"> & {
  items: OrderItemPayload[];
  status?: OrderStatus;
  source?: "qr" | "pos" | "kiosk";
  memberId?: string;
  memberPhone?: string;
  memberName?: string;
};

export type DailyReportProduct = {
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
};

export type DailyReport = {
  id: string;
  storeId: string;
  date: string;
  generatedAt: string;
  generatedBy?: string;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  totalRevenue: number;
  completedRevenue: number;
  averageOrderValue: number;
  cashIncome: number;
  cashExpense: number;
  cashNet: number;
  estimatedCashBalance: number;
  products: DailyReportProduct[];
  paymentStats?: PaymentMethodStat[];
  hourSlots?: HourSlotStat[];
  discountSummary?: DiscountSummary;
  promotionSummary?: PromotionUsageStat[];
  // Backup tracking
  backupFilesGenerated?: boolean;
  backupDownloaded?: boolean;
  backupDownloadedAt?: string;
  backupFileTypes?: string[];
  retentionNoticeShown?: boolean;
};

export type PromotionUsageStat = {
  promotionId: string;
  promotionName: string;
  usageCount: number;
  discountTotal: number;
};

export type Promotion = {
  id: string;
  storeId: string;
  name: string;
  enabled: boolean;
  startDate: string;
  endDate: string;
  type: PromotionType;
  targetCategories: string[];
  targetProducts: string[];
  buyQty: number;
  freeQty: number;
  discountPercent: number;
  discountAmount: number;
  stackable: boolean;
  autoApply: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformNotification = {
  id: string;
  type: "store_registration";
  email: string;
  storeId: string;
  storeName: string;
  contactName: string;
  phone: string;
  address: string;
  businessType: BusinessType;
  createdAt: string;
  read: boolean;
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
  dailyReports?: DailyReport[];
  promotions?: Promotion[];
  platformNotifications?: PlatformNotification[];
  customers?: Customer[];
  pointLogs?: PointLog[];
  storedValueLogs?: StoredValueLog[];
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
  archiveEligible?: boolean;
  archivedAt?: string | null;
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
