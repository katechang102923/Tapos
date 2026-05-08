import type { Category, Product, StoreType } from "./types";

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
    ]
  };
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
    options: item.options
  }));
  return { categories, products };
}
