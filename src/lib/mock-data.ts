import type { DemoDatabase } from "./types";

const now = new Date();

export const demoStoreId = "demo-store";

export const initialData: DemoDatabase = {
  stores: [
    {
      id: demoStoreId,
      name: "早安巷口",
      logoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      ownerId: "demo-owner",
      storeType: "breakfast",
      isOpen: true,
      notice: "尖峰時段餐點約需 10-15 分鐘，飲品甜度冰量可備註。",
      createdAt: now.toISOString()
    }
  ],
  users: [
    {
      id: "u-admin",
      storeId: null,
      name: "平台管理員",
      email: "admin@example.com",
      role: "admin"
    },
    {
      id: "u-owner",
      storeId: demoStoreId,
      name: "店長 Sandy",
      email: "owner@example.com",
      role: "owner"
    }
  ],
  categories: [
    { id: "cat-burger", storeId: demoStoreId, name: "漢堡", sort: 1, isActive: true },
    { id: "cat-eggroll", storeId: demoStoreId, name: "蛋餅", sort: 2, isActive: true },
    { id: "cat-drink", storeId: demoStoreId, name: "飲料", sort: 3, isActive: true },
    { id: "cat-side", storeId: demoStoreId, name: "點心", sort: 4, isActive: true }
  ],
  products: [
    {
      id: "p-burger-01",
      storeId: demoStoreId,
      categoryId: "cat-burger",
      name: "招牌豬肉蛋堡",
      description: "手打豬肉排、煎蛋、生菜與特製早餐醬。",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
      price: 65,
      isAvailable: true,
      isSoldOut: false,
      sort: 1,
      options: [
        { name: "加料", values: ["不加", "加起司 +10", "加蛋 +15"] },
        { name: "醬料", values: ["正常", "少醬", "不加醬"] }
      ]
    },
    {
      id: "p-burger-02",
      storeId: demoStoreId,
      categoryId: "cat-burger",
      name: "卡拉雞腿堡",
      description: "酥脆雞腿排搭配新鮮番茄與美生菜。",
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80",
      price: 85,
      isAvailable: true,
      isSoldOut: false,
      sort: 2,
      options: [
        { name: "辣度", values: ["原味", "辣味"], required: true },
        { name: "加料", values: ["不加", "加起司 +10", "加蛋 +15"] }
      ]
    },
    {
      id: "p-egg-01",
      storeId: demoStoreId,
      categoryId: "cat-eggroll",
      name: "玉米起司蛋餅",
      description: "煎到微酥的餅皮，包入玉米、起司與新鮮雞蛋。",
      imageUrl: "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=80",
      price: 55,
      isAvailable: true,
      isSoldOut: false,
      sort: 3,
      options: [
        { name: "醬料", values: ["油膏", "辣椒醬", "不加醬"] },
        { name: "加料", values: ["不加", "加起司 +10", "加蛋 +15"] }
      ]
    },
    {
      id: "p-egg-02",
      storeId: demoStoreId,
      categoryId: "cat-eggroll",
      name: "鮪魚蛋餅",
      description: "經典鮪魚沙拉與嫩蛋，早餐店人氣款。",
      imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
      price: 60,
      isAvailable: true,
      isSoldOut: true,
      sort: 4,
      options: [{ name: "醬料", values: ["油膏", "辣椒醬", "不加醬"] }]
    },
    {
      id: "p-drink-01",
      storeId: demoStoreId,
      categoryId: "cat-drink",
      name: "古早味紅茶",
      description: "早餐店經典紅茶，甜度固定也可備註調整。",
      imageUrl: "https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=900&q=80",
      price: 25,
      isAvailable: true,
      isSoldOut: false,
      sort: 5,
      options: [
        { name: "容量", values: ["中杯", "大杯 +10"], required: true },
        { name: "冰量", values: ["正常冰", "少冰", "去冰", "熱"] }
      ]
    },
    {
      id: "p-drink-02",
      storeId: demoStoreId,
      categoryId: "cat-drink",
      name: "招牌奶茶",
      description: "滑順奶香，適合搭配漢堡與蛋餅。",
      imageUrl: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
      price: 35,
      isAvailable: true,
      isSoldOut: false,
      sort: 6,
      options: [
        { name: "容量", values: ["中杯", "大杯 +10"], required: true },
        { name: "甜度", values: ["正常", "半糖", "微糖"] },
        { name: "冰量", values: ["正常冰", "少冰", "去冰", "熱"] }
      ]
    },
    {
      id: "p-side-01",
      storeId: demoStoreId,
      categoryId: "cat-side",
      name: "黃金脆薯",
      description: "現炸薯條，附番茄醬。",
      imageUrl: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80",
      price: 45,
      isAvailable: true,
      isSoldOut: false,
      sort: 7,
      options: [{ name: "調味", values: ["原味", "胡椒", "梅粉"] }]
    },
    {
      id: "p-side-02",
      storeId: demoStoreId,
      categoryId: "cat-side",
      name: "雞塊 6 塊",
      description: "外酥內嫩，快速出餐小點。",
      imageUrl: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80",
      price: 55,
      isAvailable: true,
      isSoldOut: false,
      sort: 8,
      options: [{ name: "沾醬", values: ["番茄醬", "蜂蜜芥末", "不附醬"] }]
    }
  ],
  orders: [
    {
      id: "o-001",
      storeId: demoStoreId,
      orderNumber: "A001",
      pickupNumber: "001",
      mode: "dine-in",
      tableNo: "5",
      customerNote: "紅茶少冰",
      status: "new",
      total: 145,
      createdAt: new Date(now.getTime() - 1000 * 60 * 6).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 6).toISOString(),
      items: [
        {
          id: "oi-001",
          orderId: "o-001",
          storeId: demoStoreId,
          productId: "p-burger-01",
          productName: "招牌豬肉蛋堡",
          quantity: 1,
          unitPrice: 65,
          selectedOptions: { 加料: "不加", 醬料: "正常" },
          note: ""
        },
        {
          id: "oi-002",
          orderId: "o-001",
          storeId: demoStoreId,
          productId: "p-drink-02",
          productName: "招牌奶茶",
          quantity: 1,
          unitPrice: 35,
          selectedOptions: { 容量: "中杯", 甜度: "半糖", 冰量: "少冰" },
          note: ""
        },
        {
          id: "oi-003",
          orderId: "o-001",
          storeId: demoStoreId,
          productId: "p-side-01",
          productName: "黃金脆薯",
          quantity: 1,
          unitPrice: 45,
          selectedOptions: { 調味: "胡椒" },
          note: "番茄醬多一包"
        }
      ]
    }
  ]
};
