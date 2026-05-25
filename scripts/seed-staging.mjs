#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tapos-staging";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "ciut0000@gmail.com").trim().toLowerCase();
const STORE_ID = process.env.SEED_STORE_ID || "staging-breakfast-store";
const STORE_NAME = process.env.SEED_STORE_NAME || "Test Store";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://tapos-staging.vercel.app").replace(/\/$/, "");

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return cert(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")));
  }
  return applicationDefault();
}

function nowIso() {
  return new Date().toISOString();
}

function optionGroup(id, name, required, minSelect, maxSelect, options) {
  return {
    id,
    name,
    required,
    minSelect,
    maxSelect,
    type: maxSelect > 1 ? "multiple" : "single",
    sourceType: "custom",
    sortOrder: 0,
    linkedGroupId: null,
    sharedGroupId: null,
    children: [],
    options: options.map((item, index) => ({
      id: `${id}-${index + 1}`,
      name: item.name,
      optionName: item.name,
      priceDelta: item.priceDelta ?? 0,
      isAvailable: true,
      sortOrder: index,
      linkedGroupId: null,
      sharedGroupId: null,
      children: item.children ?? [],
      nextGroupIds: [],
      childGroupIds: [],
    })),
  };
}

const flavorGroup = optionGroup("flavor", "調味", true, 1, 1, [
  { name: "正常" },
  { name: "少醬" },
  { name: "不加洋蔥" },
  { name: "加辣" },
]);

const addonGroup = optionGroup("addons", "加料", false, 0, 3, [
  { name: "加蛋", priceDelta: 15 },
  { name: "加起司", priceDelta: 10 },
  { name: "加薯餅", priceDelta: 20 },
]);

const drinkGroup = optionGroup("set-drink", "套餐飲料", true, 1, 1, [
  { name: "紅茶", priceDelta: 0 },
  { name: "奶茶", priceDelta: 10 },
  { name: "豆漿", priceDelta: 0 },
  { name: "鮮奶茶", priceDelta: 20 },
]);

const setGroup = optionGroup("set-upgrade", "套餐升級", false, 0, 1, [
  { name: "不升級", priceDelta: 0 },
  { name: "A餐紅茶", priceDelta: 25 },
  { name: "B餐奶茶", priceDelta: 30 },
  { name: "C餐薯餅紅茶", priceDelta: 50, children: [drinkGroup] },
]);

const categories = [
  { id: "staging-cat-burger", name: "漢堡", sort: 1 },
  { id: "staging-cat-toast", name: "吐司", sort: 2 },
  { id: "staging-cat-eggroll", name: "蛋餅", sort: 3 },
  { id: "staging-cat-drink", name: "飲料", sort: 4 },
  { id: "staging-cat-snack", name: "點心", sort: 5 },
];

const products = [
  ["staging-prod-burger", "staging-cat-burger", "漢堡", "招牌豬肉蛋堡", "經典早餐漢堡，含蛋與豬肉排。", 65],
  ["staging-prod-toast", "staging-cat-toast", "吐司", "火腿蛋吐司", "快速出餐的熱壓吐司。", 45],
  ["staging-prod-eggroll", "staging-cat-eggroll", "蛋餅", "起司蛋餅", "軟嫩蛋餅搭配起司。", 40],
  ["staging-prod-fries", "staging-cat-snack", "點心", "黃金脆薯", "酥脆薯條，適合加點。", 45],
  ["staging-prod-tea", "staging-cat-drink", "飲料", "紅茶", "早餐店經典紅茶。", 25],
  ["staging-prod-milk-tea", "staging-cat-drink", "飲料", "奶茶", "香甜奶茶。", 30],
];

const obsoleteProductIds = [
  "staging-prod-pork-burger",
  "staging-prod-ham-toast",
  "staging-prod-cheese-eggroll",
  "staging-prod-noodle",
  "staging-prod-black-tea",
  "staging-prod-milk-tea",
  "staging-prod-soy",
];

const tables = ["A1", "A2", "A3", "B1", "B2", "外帶"];

function productPayload(item, index) {
  const [id, categoryId, categoryName, name, description, price] = item;
  const isDrink = categoryId === "staging-cat-drink";
  return {
    id,
    storeId: STORE_ID,
    categoryId,
    categoryName,
    name,
    description,
    imageUrl: "",
    originalPrice: price,
    cost: Math.round(price * 0.55),
    price,
    discountType: "none",
    discountValue: 0,
    isAvailable: true,
    isSoldOut: false,
    sort: index + 1,
    sortOrder: index + 1,
    options: [],
    optionGroups: isDrink
      ? [
          optionGroup("sweetness", "甜度", true, 1, 1, [{ name: "正常糖" }, { name: "半糖" }, { name: "微糖" }, { name: "無糖" }]),
          optionGroup("ice", "冰塊", true, 1, 1, [{ name: "正常冰" }, { name: "少冰" }, { name: "微冰" }, { name: "去冰" }, { name: "熱" }]),
        ]
      : [flavorGroup, addonGroup, setGroup],
    scheduledChanges: [],
  };
}

function initFirebase() {
  if (PROJECT_ID !== "tapos-staging") {
    throw new Error(`Refusing to seed non-staging Firebase project: ${PROJECT_ID}`);
  }
  if (!getApps().length) {
    initializeApp({
      credential: loadCredential(),
      projectId: PROJECT_ID,
    });
  }
}

async function main() {
  initFirebase();
  const auth = getAuth();
  const db = getFirestore();
  const now = nowIso();
  const user = await auth.getUserByEmail(ADMIN_EMAIL);
  const storePayload = {
    id: STORE_ID,
    name: STORE_NAME,
    type: "早餐店",
    status: "open",
    isOpen: true,
    orderStatus: "open",
    address: "測試地址",
    phone: "0900-000-000",
    description: "Staging 測試店家",
    logoUrl: "",
    bannerUrl: "",
    takeoutEnabled: true,
    dineInEnabled: true,
    takeoutOrderingEnabled: true,
    dineInOrderingEnabled: true,
    posOrderingEnabled: true,
    features: {
      kds: true,
      reports: true,
      cashFlow: true,
      members: true,
      storedValue: true,
      promotions: true,
    },
    createdAt: now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.set(db.doc(`stores/${STORE_ID}`), storePayload, { merge: true });
  batch.set(db.doc(`users/${user.uid}`), {
    id: user.uid,
    uid: user.uid,
    email: ADMIN_EMAIL,
    name: user.displayName || "System Admin",
    role: "systemAdmin",
    status: "active",
    approved: true,
    storeId: STORE_ID,
    storeIds: FieldValue.arrayUnion(STORE_ID),
    memberships: { [STORE_ID]: "owner" },
    storeRoles: { [STORE_ID]: "owner" },
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
  const binding = {
    email: ADMIN_EMAIL,
    uid: user.uid,
    storeId: STORE_ID,
    role: "owner",
    storeRole: "owner",
    status: "active",
    approved: true,
    updatedAt: now,
    createdAt: now,
  };
  batch.set(db.doc(`storeUsers/${STORE_ID}_${user.uid}`), binding, { merge: true });
  batch.set(db.doc(`storeUserBindings/${STORE_ID}_${user.uid}`), binding, { merge: true });
  batch.set(db.doc(`storeMembers/${STORE_ID}_${user.uid}`), binding, { merge: true });
  batch.set(db.doc(`stores/${STORE_ID}/settings/memberRules`), {
    enablePoints: true,
    earnAmount: 100,
    earnPoints: 1,
    pointValue: 1,
    enableCouponExchange: true,
    birthdayRewardEnabled: false,
    birthdayRewardPoints: 0,
    updatedAt: now,
  }, { merge: true });
  categories.forEach((category) => {
    const payload = { ...category, storeId: STORE_ID, isActive: true, createdAt: now, updatedAt: now };
    batch.set(db.doc(`categories/${category.id}`), payload, { merge: true });
    batch.set(db.doc(`stores/${STORE_ID}/categories/${category.id}`), payload, { merge: true });
  });
  products.forEach((item, index) => {
    const payload = { ...productPayload(item, index), createdAt: now, updatedAt: now };
    batch.set(db.doc(`products/${payload.id}`), payload, { merge: true });
    batch.set(db.doc(`stores/${STORE_ID}/products/${payload.id}`), payload, { merge: true });
  });
  obsoleteProductIds.forEach((id) => {
    batch.delete(db.doc(`products/${id}`));
    batch.delete(db.doc(`stores/${STORE_ID}/products/${id}`));
  });
  tables.forEach((tableName, index) => {
    const id = `staging-table-${tableName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`;
    batch.set(db.doc(`tables/${id}`), {
      id,
      storeId: STORE_ID,
      tableName,
      area: tableName === "外帶" ? "外帶" : tableName.slice(0, 1),
      number: String(index + 1),
      enabled: true,
      qrUrl: `${APP_URL}/order/${STORE_ID}?type=${tableName === "外帶" ? "takeout" : "dineIn"}${tableName === "外帶" ? "" : `&table=${encodeURIComponent(tableName)}`}`,
      sort: index + 1,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  });
  await batch.commit();
  console.log(`Seeded staging store ${STORE_ID} for ${ADMIN_EMAIL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
