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
      description: "手打豬肉排、煎蛋、生菜與店家特製醬。",
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
            { id: "season-no-onion", name: "不加洋蔥", priceDelta: 0, isAvailable: true },
            { id: "season-spicy", name: "加辣", priceDelta: 0, isAvailable: true }
          ]
        },
        {
          id: "g-upgrade",
          name: "加購 / 升級套餐",
          required: false,
          minSelect: 0,
          maxSelect: 1,
          options: [
            { id: "upgrade-none", name: "不升級", priceDelta: 0, isAvailable: true },
            {
              id: "upgrade-a",
              name: "升級 A 套餐",
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
                    { id: "a-fresh-milk-tea", name: "鮮奶茶", priceDelta: 20, isAvailable: true }
                  ]
                }
              ]
            },
            {
              id: "upgrade-b",
              name: "升級 B 套餐",
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
                    { id: "b-milk-tea", name: "奶茶", priceDelta: 10, isAvailable: true },
                    { id: "b-fresh-milk-tea", name: "鮮奶茶", priceDelta: 20, isAvailable: true }
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
            },
            { id: "addon-cheese", name: "加購起司", priceDelta: 10, isAvailable: true },
            { id: "addon-egg", name: "加購蛋", priceDelta: 15, isAvailable: true }
          ]
        },
        {
          id: "g-extra",
          name: "加料 / 備註",
          required: false,
          minSelect: 0,
          maxSelect: 3,
          options: [
            { id: "extra-cheese", name: "加起司", priceDelta: 10, isAvailable: true },
            { id: "extra-egg", name: "加蛋", priceDelta: 15, isAvailable: true },
            { id: "extra-no-lettuce", name: "不加生菜", priceDelta: 0, isAvailable: true }
          ]
        }
      ],
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
      description: "經典鮪魚沙拉與嫩蛋，店家人氣款。",
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
      description: "店家經典紅茶，甜度固定也可備註調整。",
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
            { groupId: "g-upgrade", groupName: "加購 / 升級套餐", choiceId: "upgrade-a", choiceName: "升級 A 套餐", priceDelta: 60, level: 0 },
            { groupId: "g-a-drink", groupName: "A 套餐飲料", choiceId: "a-fresh-milk-tea", choiceName: "鮮奶茶", priceDelta: 20, level: 1 },
            { groupId: "g-extra", groupName: "加料 / 備註", choiceId: "extra-egg", choiceName: "加蛋", priceDelta: 15, level: 0 }
          ],
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
          selectedOptions: [
            { groupId: "legacy-0", groupName: "容量", choiceId: "legacy-0-0", choiceName: "中杯", priceDelta: 0 },
            { groupId: "legacy-1", groupName: "甜度", choiceId: "legacy-1-1", choiceName: "半糖", priceDelta: 0 },
            { groupId: "legacy-2", groupName: "冰量", choiceId: "legacy-2-1", choiceName: "少冰", priceDelta: 0 }
          ],
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
          selectedOptions: [
            { groupId: "legacy-0", groupName: "調味", choiceId: "legacy-0-1", choiceName: "胡椒", priceDelta: 0 }
          ],
          note: "番茄醬多一包"
        }
      ]
    }
  ]
};
