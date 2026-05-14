import type { Product, ProductOptionChoice, ProductOptionGroup } from "./types";

export type MenuTemplateType = "breakfast" | "drink" | "noodle";

type TemplateItem = {
  name: string;
  category: string;
  price: number;
  cost?: number;
  description: string;
};

const imageByType: Record<MenuTemplateType, string> = {
  breakfast: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  noodle: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80"
};

const itemsByType: Record<MenuTemplateType, TemplateItem[]> = {
  breakfast: [
    { name: "招牌豬肉蛋堡", category: "漢堡吐司", price: 65, cost: 32, description: "豬肉排、雞蛋與生菜，早餐店招牌主餐。" },
    { name: "火腿蛋吐司", category: "漢堡吐司", price: 45, cost: 22, description: "火腿與煎蛋，快速出餐的人氣吐司。" },
    { name: "起司蛋餅", category: "蛋餅點心", price: 40, cost: 18, description: "煎蛋餅皮搭配起司。" },
    { name: "蘿蔔糕", category: "蛋餅點心", price: 45, cost: 20, description: "外酥內軟，適合加蛋加辣。" },
    { name: "鐵板麵加蛋", category: "主食", price: 70, cost: 35, description: "鐵板麵搭配煎蛋。" },
    { name: "紅茶", category: "飲料", price: 25, cost: 8, description: "經典早餐紅茶。" },
    { name: "奶茶", category: "飲料", price: 30, cost: 12, description: "早餐店奶茶。" },
    { name: "豆漿", category: "飲料", price: 25, cost: 10, description: "冷熱皆宜。" }
  ],
  drink: [
    { name: "紅茶", category: "原茶", price: 30, cost: 9, description: "經典紅茶。" },
    { name: "綠茶", category: "原茶", price: 30, cost: 9, description: "清爽綠茶。" },
    { name: "奶茶", category: "奶茶", price: 45, cost: 18, description: "濃郁奶香。" },
    { name: "鮮奶茶", category: "奶茶", price: 55, cost: 25, description: "鮮奶搭配茶湯。" },
    { name: "多多綠", category: "特調", price: 50, cost: 22, description: "綠茶與多多。" },
    { name: "冬瓜檸檬", category: "特調", price: 50, cost: 18, description: "酸甜清爽。" },
    { name: "珍珠奶茶", category: "奶茶", price: 55, cost: 23, description: "奶茶加珍珠。" }
  ],
  noodle: [
    { name: "原味鍋燒意麵", category: "鍋燒麵", price: 90, cost: 42, description: "經典原味湯頭。" },
    { name: "沙茶鍋燒意麵", category: "鍋燒麵", price: 100, cost: 48, description: "沙茶湯底香氣足。" },
    { name: "泡菜鍋燒意麵", category: "鍋燒麵", price: 110, cost: 52, description: "泡菜酸辣湯底。" },
    { name: "牛奶鍋燒烏龍", category: "鍋燒麵", price: 120, cost: 58, description: "牛奶湯頭搭配烏龍。" },
    { name: "海鮮鍋燒雞絲", category: "鍋燒麵", price: 120, cost: 60, description: "海鮮料與雞絲麵。" },
    { name: "滷味拼盤", category: "小菜", price: 80, cost: 36, description: "可搭配主餐的小菜拼盤。" }
  ]
};

function id(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`}`;
}

function option(name: string, priceDelta = 0): ProductOptionChoice {
  return {
    id: id("opt"),
    name,
    optionName: name,
    priceDelta,
    sortOrder: 0,
    isAvailable: true,
    children: [],
    childGroupIds: [],
    nextGroupIds: [],
    linkedGroupId: null,
    sharedGroupId: null
  };
}

function group(name: string, options: ProductOptionChoice[], required = false, maxSelect = 1): ProductOptionGroup {
  return {
    id: id("group"),
    name,
    groupName: name,
    required,
    minSelect: required ? 1 : 0,
    maxSelect,
    type: maxSelect > 1 ? "multiple" : "single",
    sortOrder: 0,
    children: [],
    linkedGroupId: null,
    sharedGroupId: null,
    options
  };
}

function optionGroupsFor(type: MenuTemplateType): ProductOptionGroup[] {
  if (type === "drink") {
    return [
      group("甜度", ["正常", "少糖", "半糖", "微糖", "無糖"].map((item) => option(item)), true),
      group("冰量", ["正常冰", "少冰", "微冰", "去冰", "熱"].map((item) => option(item)), true),
      group("加料", [option("珍珠", 10), option("椰果", 10), option("布丁", 15), option("仙草", 10)], false, 3),
      group("容量", [option("中杯"), option("大杯", 10)], true)
    ];
  }
  if (type === "noodle") {
    return [
      group("麵體", ["意麵", "烏龍", "雞絲", "冬粉", "泡麵"].map((item) => option(item)), true),
      group("湯底", [option("原味"), option("沙茶", 10), option("泡菜", 20), option("牛奶", 30)], true),
      group("加料", [option("加蛋", 15), option("加肉片", 30), option("加蛤蜊", 40), option("加青菜", 20)], false, 4),
      group("辣度", ["不辣", "小辣", "中辣", "大辣"].map((item) => option(item)), true)
    ];
  }
  return [
    group("調味", ["正常", "不醬", "加辣"].map((item) => option(item)), true),
    group("加料", [option("加蛋", 15), option("加起司", 10), option("加肉排", 25)], false, 3),
    group("套餐升級", [option("不升級"), option("A餐紅茶", 25), option("B餐奶茶", 30), option("C餐薯餅紅茶", 50)], false)
  ];
}

export function buildMenuTemplateProducts(storeId: string, type: MenuTemplateType, startSort = 1): Product[] {
  return itemsByType[type].map((item, index) => ({
    id: "",
    storeId,
    categoryId: "",
    categoryName: item.category,
    name: item.name,
    description: item.description,
    imageUrl: imageByType[type],
    originalPrice: item.price,
    cost: item.cost ?? 0,
    price: item.price,
    discountType: "none",
    discountValue: 0,
    isAvailable: true,
    isSoldOut: false,
    sort: startSort + index,
    sortOrder: startSort + index,
    options: [],
    optionGroups: optionGroupsFor(type)
  }));
}

export function menuTemplateLabel(type: MenuTemplateType) {
  return type === "breakfast" ? "早餐店" : type === "drink" ? "飲料店" : "鍋燒麵店";
}
