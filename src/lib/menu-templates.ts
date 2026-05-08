import type { Category, Product, ProductOptionGroup, StoreType } from "./types";

const image = {
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  egg: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  tea: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80",
  fries: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=900&q=80",
  drink: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80",
  snack: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80",
  hotpot: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80"
};

type TemplateProduct = Omit<Product, "id" | "storeId" | "categoryId"> & { categoryKey: string; key: string };

const templates: Record<StoreType, { categories: Array<{ key: string; name: string }>; products: TemplateProduct[] }> = {
  breakfast: {
    categories: [
      { key: "burger", name: "漢堡" },
      { key: "egg", name: "蛋餅" },
      { key: "drink", name: "飲料" },
      { key: "side", name: "點心" }
    ],
    products: [
      product("pork-burger", "burger", "招牌豬肉蛋堡", "豬肉排、煎蛋、生菜與店家特製醬。", image.burger, 65, 1),
      product("chicken-burger", "burger", "卡拉雞腿堡", "酥脆雞腿排搭配美生菜。", image.burger, 85, 2),
      product("corn-egg", "egg", "玉米起司蛋餅", "玉米、起司與新鮮雞蛋。", image.egg, 55, 3),
      product("milk-tea", "drink", "招牌奶茶", "店家經典奶茶。", image.tea, 35, 4),
      product("fries", "side", "黃金脆薯", "現炸薯條，附番茄醬。", image.fries, 45, 5)
    ]
  },
  drink: {
    categories: [
      { key: "tea", name: "茶飲" },
      { key: "milk", name: "奶茶" },
      { key: "fresh", name: "鮮奶" }
    ],
    products: [
      product("black-tea", "tea", "古早味紅茶", "清爽順口。", image.drink, 30, 1),
      product("milk-tea", "milk", "招牌奶茶", "茶香與奶香平衡。", image.tea, 45, 2),
      product("fresh-milk-tea", "fresh", "鮮奶茶", "使用鮮乳調製。", image.tea, 60, 3)
    ]
  },
  snack: {
    categories: [
      { key: "main", name: "主食" },
      { key: "side", name: "小吃" },
      { key: "drink", name: "飲料" }
    ],
    products: [
      product("rice", "main", "滷肉飯", "經典小吃主食。", image.snack, 45, 1),
      product("nuggets", "side", "雞塊", "外酥內嫩。", image.snack, 55, 2),
      product("tea", "drink", "紅茶", "大杯冰紅茶。", image.drink, 30, 3)
    ]
  },
  hotpot: {
    categories: [
      { key: "pot", name: "鍋物" },
      { key: "addon", name: "加點" },
      { key: "drink", name: "飲料" }
    ],
    products: [
      product("beef-pot", "pot", "牛肉鍋", "牛肉片與蔬菜盤。", image.hotpot, 180, 1),
      product("pork-pot", "pot", "豬肉鍋", "梅花豬與蔬菜盤。", image.hotpot, 160, 2),
      product("extra-meat", "addon", "加點肉盤", "可搭配任一鍋物。", image.hotpot, 90, 3)
    ]
  }
};

function product(key: string, categoryKey: string, name: string, description: string, imageUrl: string, price: number, sort: number): TemplateProduct {
  return {
    key,
    categoryKey,
    name,
    description,
    imageUrl,
    price,
    isAvailable: true,
    isSoldOut: false,
    sort,
    options: [
      { name: "加料", values: ["不加", "加蛋 +15", "加起司 +10"] },
      { name: "備註", values: ["正常", "少醬", "不加醬"] }
    ],
    optionGroups: categoryKey === "burger" || categoryKey === "egg" ? breakfastMealOptionGroups(key) : basicDrinkOptionGroups(key, categoryKey)
  };
}

function breakfastMealOptionGroups(productKey: string): ProductOptionGroup[] {
  return [
    {
      id: `${productKey}-seasoning`,
      name: "調味",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: `${productKey}-seasoning-normal`, name: "正常", priceDelta: 0, isAvailable: true },
        { id: `${productKey}-seasoning-no-onion`, name: "不加洋蔥", priceDelta: 0, isAvailable: true },
        { id: `${productKey}-seasoning-no-sauce`, name: "不加醬", priceDelta: 0, isAvailable: true },
        { id: `${productKey}-seasoning-spicy`, name: "加辣", priceDelta: 0, isAvailable: true }
      ]
    },
    {
      id: `${productKey}-addons`,
      name: "加購",
      required: false,
      minSelect: 0,
      maxSelect: 3,
      options: [
        { id: `${productKey}-addon-egg`, name: "加蛋", priceDelta: 15, isAvailable: true },
        { id: `${productKey}-addon-cheese`, name: "加起司", priceDelta: 15, isAvailable: true },
        { id: `${productKey}-addon-meat`, name: "加肉", priceDelta: 30, isAvailable: true }
      ]
    },
    {
      id: `${productKey}-bundle`,
      name: "升級套餐",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      options: [
        { id: `${productKey}-bundle-none`, name: "不升級", priceDelta: 0, isAvailable: true },
        {
          id: `${productKey}-bundle-a`,
          name: "A 套餐",
          priceDelta: 49,
          isAvailable: true,
          children: [drinkGroup(`${productKey}-bundle-a`, "A 套餐飲料")]
        },
        {
          id: `${productKey}-bundle-b`,
          name: "B 套餐",
          priceDelta: 69,
          isAvailable: true,
          children: [
            drinkGroup(`${productKey}-bundle-b`, "B 套餐飲料"),
            {
              id: `${productKey}-bundle-b-side`,
              name: "B 套餐點心",
              required: true,
              minSelect: 1,
              maxSelect: 1,
              options: [
                { id: `${productKey}-bundle-b-nuggets`, name: "雞塊", priceDelta: 0, isAvailable: true }
              ]
            }
          ]
        },
        {
          id: `${productKey}-bundle-c`,
          name: "C 套餐",
          priceDelta: 89,
          isAvailable: true,
          children: [
            drinkGroup(`${productKey}-bundle-c`, "C 套餐飲料"),
            {
              id: `${productKey}-bundle-c-side`,
              name: "C 套餐點心",
              required: true,
              minSelect: 1,
              maxSelect: 1,
              options: [
                { id: `${productKey}-bundle-c-fries`, name: "薯條", priceDelta: 0, isAvailable: true }
              ]
            }
          ]
        }
      ]
    }
  ];
}

function drinkGroup(prefix: string, name: string): ProductOptionGroup {
  return {
    id: `${prefix}-drink`,
    name,
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: `${prefix}-black-tea`, name: "紅茶", priceDelta: 0, isAvailable: true },
      { id: `${prefix}-milk-tea`, name: "奶茶", priceDelta: 10, isAvailable: true },
      { id: `${prefix}-fresh-milk-tea`, name: "鮮奶茶", priceDelta: 20, isAvailable: true },
      { id: `${prefix}-coffee`, name: "咖啡", priceDelta: 25, isAvailable: true }
    ]
  };
}

function basicDrinkOptionGroups(productKey: string, categoryKey: string): ProductOptionGroup[] {
  if (categoryKey !== "drink" && categoryKey !== "tea" && categoryKey !== "milk" && categoryKey !== "fresh") return [];
  return [
    {
      id: `${productKey}-sweetness`,
      name: "甜度",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: ["正常糖", "半糖", "微糖", "無糖"].map((name, index) => ({ id: `${productKey}-sweetness-${index}`, name, priceDelta: 0, isAvailable: true }))
    },
    {
      id: `${productKey}-ice`,
      name: "冰量",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: ["正常冰", "少冰", "微冰", "去冰", "熱飲"].map((name, index) => ({ id: `${productKey}-ice-${index}`, name, priceDelta: 0, isAvailable: true }))
    }
  ];
}

export function createDefaultMenu(storeId: string, storeType: StoreType) {
  const template = templates[storeType];
  const categories: Category[] = template.categories.map((category, index) => ({
    id: `${storeId}-${category.key}`,
    storeId,
    name: category.name,
    sort: index + 1,
    isActive: true
  }));
  const categoryMap = new Map(template.categories.map((category) => [category.key, `${storeId}-${category.key}`]));
  const products: Product[] = template.products.map((item) => ({
    id: `${storeId}-${item.key}`,
    storeId,
    categoryId: categoryMap.get(item.categoryKey) ?? categories[0].id,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    price: item.price,
    isAvailable: item.isAvailable,
    isSoldOut: item.isSoldOut,
    sort: item.sort,
    options: item.options,
    optionGroups: item.optionGroups ?? []
  }));
  return { categories, products };
}
