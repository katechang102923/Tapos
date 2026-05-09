import type { DemoDatabase } from "./types";

const now = new Date();

export const demoStoreId = "demo-store";

export const initialData: DemoDatabase = {
  stores: [
    {
      id: demoStoreId,
      name: "晨光餐飲",
      logoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      ownerId: "demo-owner",
      storeType: "breakfast",
      isOpen: true,
      orderStatus: "open",
      takeoutEnabled: true,
      dineInEnabled: true,
      takeoutOrderingEnabled: true,
      dineInOrderingEnabled: true,
      posOrderingEnabled: true,
      notice: "尖峰時段餐點約需等候 10-15 分鐘。",
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
      storeIds: [demoStoreId],
      storeRoles: { [demoStoreId]: "owner" },
      memberships: { [demoStoreId]: "owner" },
      name: "店長 Sandy",
      email: "owner@example.com",
      role: "merchant"
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
      description: "煎蛋、豬肉排與生菜，適合升級套餐。",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
      price: 65,
      isAvailable: true,
      isSoldOut: false,
      sort: 1,
      optionGroups: [
        {
          id: "g-seasoning",
          name: "調味",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "season-normal", name: "正常", priceDelta: 0, isAvailable: true },
            { id: "season-less-sauce", name: "少醬", priceDelta: 0, isAvailable: true },
            { id: "season-spicy", name: "加辣", priceDelta: 0, isAvailable: true }
          ]
        },
        {
          id: "g-upgrade",
          name: "升級套餐",
          required: false,
          minSelect: 0,
          maxSelect: 1,
          options: [
            { id: "upgrade-none", name: "不升級", priceDelta: 0, isAvailable: true },
            {
              id: "upgrade-a",
              name: "A 套餐",
              priceDelta: 60,
              isAvailable: true,
              children: [
                {
                  id: "g-a-drink",
                  name: "A 套餐飲料",
                  required: true,
                  minSelect: 1,
                  maxSelect: 1,
                  options: [
                    { id: "a-black-tea", name: "紅茶", priceDelta: 0, isAvailable: true },
                    { id: "a-milk-tea", name: "奶茶", priceDelta: 10, isAvailable: true },
                    { id: "a-coffee", name: "咖啡", priceDelta: 20, isAvailable: true }
                  ]
                }
              ]
            },
            {
              id: "upgrade-b",
              name: "B 套餐",
              priceDelta: 80,
              isAvailable: true,
              children: [
                {
                  id: "g-b-drink",
                  name: "B 套餐飲料",
                  required: true,
                  minSelect: 1,
                  maxSelect: 1,
                  options: [
                    { id: "b-black-tea", name: "紅茶", priceDelta: 0, isAvailable: true },
                    { id: "b-milk-tea", name: "奶茶", priceDelta: 10, isAvailable: true }
                  ]
                },
                {
                  id: "g-b-side",
                  name: "B 套餐點心",
                  required: true,
                  minSelect: 1,
                  maxSelect: 1,
                  options: [
                    { id: "b-nugget", name: "雞塊", priceDelta: 0, isAvailable: true },
                    { id: "b-fries", name: "薯條", priceDelta: 0, isAvailable: true }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: "g-extra",
          name: "加料",
          required: false,
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: "extra-cheese", name: "加起司", priceDelta: 15, isAvailable: true },
            { id: "extra-egg", name: "加蛋", priceDelta: 15, isAvailable: true },
            { id: "extra-meat", name: "加肉", priceDelta: 30, isAvailable: true }
          ]
        }
      ]
    },
    {
      id: "p-eggroll-01",
      storeId: demoStoreId,
      categoryId: "cat-eggroll",
      name: "玉米起司蛋餅",
      description: "玉米、起司與酥香餅皮。",
      imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
      price: 55,
      isAvailable: true,
      isSoldOut: false,
      sort: 2,
      optionGroups: []
    },
    {
      id: "p-drink-01",
      storeId: demoStoreId,
      categoryId: "cat-drink",
      name: "招牌奶茶",
      description: "可調整冰塊與甜度。",
      imageUrl: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
      price: 35,
      isAvailable: true,
      isSoldOut: false,
      sort: 3,
      optionGroups: [
        {
          id: "g-ice",
          name: "冰塊",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "ice-normal", name: "正常冰", priceDelta: 0, isAvailable: true },
            { id: "ice-less", name: "少冰", priceDelta: 0, isAvailable: true },
            { id: "ice-none", name: "去冰", priceDelta: 0, isAvailable: true }
          ]
        },
        {
          id: "g-sugar",
          name: "甜度",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "sugar-normal", name: "正常甜", priceDelta: 0, isAvailable: true },
            { id: "sugar-half", name: "半糖", priceDelta: 0, isAvailable: true },
            { id: "sugar-none", name: "無糖", priceDelta: 0, isAvailable: true }
          ]
        }
      ]
    },
    {
      id: "p-side-01",
      storeId: demoStoreId,
      categoryId: "cat-side",
      name: "黃金脆薯",
      description: "現炸點心，適合外帶。",
      imageUrl: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80",
      price: 45,
      isAvailable: true,
      isSoldOut: false,
      sort: 4,
      optionGroups: []
    }
  ],
  orders: [
    {
      id: "o-001",
      storeId: demoStoreId,
      orderNumber: "Q001",
      pickupNumber: "Q001",
      mode: "dine-in",
      tableNo: "A1",
      tableName: "A1",
      customerName: "A1",
      customerNote: "餐具一份",
      status: "pending",
      source: "qr",
      total: 240,
      totalAmount: 240,
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
          unitPrice: 160,
          selectedOptions: [
            { groupId: "g-seasoning", groupName: "調味", choiceId: "season-less-sauce", choiceName: "少醬", priceDelta: 0, level: 0 },
            { groupId: "g-upgrade", groupName: "升級套餐", choiceId: "upgrade-a", choiceName: "A 套餐", priceDelta: 60, level: 0 },
            { groupId: "g-a-drink", groupName: "A 套餐飲料", choiceId: "a-milk-tea", choiceName: "奶茶", priceDelta: 10, level: 1 },
            { groupId: "g-extra", groupName: "加料", choiceId: "extra-egg", choiceName: "加蛋", priceDelta: 15, level: 0 }
          ],
          note: "不要洋蔥",
          itemNote: "不要洋蔥"
        },
        {
          id: "oi-002",
          orderId: "o-001",
          storeId: demoStoreId,
          productId: "p-side-01",
          productName: "黃金脆薯",
          quantity: 1,
          unitPrice: 45,
          selectedOptions: [],
          note: "",
          itemNote: ""
        }
      ]
    }
  ],
  cashFlows: [],
  cashFlowItems: [
    { id: "cash-opening", storeId: demoStoreId, name: "開店備用金", type: "income", amountMode: "open", enabled: true, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { id: "cash-extra", storeId: demoStoreId, name: "額外收入", type: "income", amountMode: "open", enabled: true, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { id: "cash-supply", storeId: demoStoreId, name: "採買", type: "expense", amountMode: "open", enabled: true, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { id: "cash-change", storeId: demoStoreId, name: "找零", type: "expense", amountMode: "open", enabled: true, createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { id: "cash-refund", storeId: demoStoreId, name: "退款", type: "expense", amountMode: "open", enabled: true, createdAt: now.toISOString(), updatedAt: now.toISOString() }
  ],
  tables: []
};
