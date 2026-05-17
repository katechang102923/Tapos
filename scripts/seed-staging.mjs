#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tapos-staging";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "ciut0000@gmail.com").trim().toLowerCase();
const STORE_ID = process.env.SEED_STORE_ID || "staging-breakfast-store";
const STORE_NAME = process.env.SEED_STORE_NAME || "測試早餐店";
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
  { name: "加肉排", priceDelta: 25 },
]);

const drinkGroup = optionGroup("set-drink", "套餐飲料", true, 1, 1, [
  { name: "紅茶", priceDelta: 0 },
  { name: "奶茶", priceDelta: 10 },
  { name: "豆漿", priceDelta: 0 },
  { name: "鮮奶茶", priceDelta: 20 },
]);

const setGroup = optionGroup("set-upgrade", "套餐升級", false, 0, 1, [
  { name: "不升級", priceDelta: 0 },
  { name: "A餐：紅茶", priceDelta: 25 },
  { name: "B餐：奶茶", priceDelta: 30 },
  { name: "C餐：薯餅紅茶", priceDelta: 50, children: [drinkGroup] },
]);

const categories = [
  { id: "staging-cat-burger", name: "漢堡", sort: 1 },
  { id: "staging-cat-toast", name: "吐司", sort: 2 },
  { id: "staging-cat-eggroll", name: "蛋餅", sort: 3 },
  { id: "staging-cat-drink", name: "飲料", sort: 4 },
  { id: "staging-cat-snack", name: "點心", sort: 5 },
];

const products = [
  ["staging-prod-pork-burger", "staging-cat-burger", "漢堡", "招牌豬肉蛋堡", "經典早餐漢堡，含蛋與豬肉排。", 65],
  ["staging-prod-ham-toast", "staging-cat-toast", "吐司", "火腿蛋吐司", "快速出餐的熱壓吐司。", 45],
  ["staging-prod-cheese-eggroll", "staging-cat-eggroll", "蛋餅", "起司蛋餅", "軟嫩蛋餅搭配起司。", 40],
  ["staging-prod-noodle", "staging-cat-burger", "漢堡", "鐵板麵加蛋", "黑胡椒鐵板麵加一顆蛋。", 70],
  ["staging-prod-fries", "staging-cat-snack", "點心", "黃金脆薯", "酥脆薯條，適合加點。", 45],
  ["staging-prod-black-tea", "staging-cat-drink", "飲料", "紅茶", "早餐店經典紅茶。", 25],
  ["staging-prod-milk-tea", "staging-cat-drink", "飲料", "奶茶", "香甜奶茶。", 30],
  ["staging-prod-soy", "staging-cat-drink", "飲料", "豆漿", "溫熱皆宜。", 25],
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
    imageUrl: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80",
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
          optionGroup("sweetness", "甜度", true, 1, 1, [{ name: "正常" }, { name: "半糖" }, { name: "微糖" }, { name: "無糖" }]),
          optionGroup("ice", "冰塊", true, 1, 1, [{ name: "正常冰" }, { name: "少冰" }, { name: "微冰" }, { name: "去冰" }, { name: "熱" }]),
        ]
      : [flavorGroup, addonGroup, setGroup],
    scheduledChanges: [],
  };
}

async function upsertBoth(db, topCollection, nestedCollection, id, payload) {
  const batch = db.batch();
  batch.set(db.collection(topCollection).doc(id), payload, { merge: true });
  batch.set(db.collection("stores").doc(STORE_ID).collection(nestedCollection).doc(id), payload, { merge: true });
  await batch.commit();
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: loadCredential(), projectId: PROJECT_ID });
  }
  const db = getFirestore();
  const auth = getAuth();
  const now = nowIso();

  const adminUser = await auth.getUserByEmail(ADMIN_EMAIL).catch(async (error) => {
    if (error?.code !== "auth/user-not-found") throw error;
    return auth.createUser({ email: ADMIN_EMAIL, emailVerified: true, displayName: "Platform Admin" });
  });
  const uid = adminUser.uid;

  const store = {
    id: STORE_ID,
    name: STORE_NAME,
    logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80",
    bannerUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
    phone: "07-000-0000",
    addressCity: "高雄市",
    addressDistrict: "前鎮區",
    addressDetail: "測試路 100 號",
    address: "高雄市前鎮區測試路 100 號",
    businessHours: "週一至週日 06:00-13:30",
    businessSchedule: {
      mon: { enabled: true, start: "06:00", end: "13:30" },
      tue: { enabled: true, start: "06:00", end: "13:30" },
      wed: { enabled: true, start: "06:00", end: "13:30" },
      thu: { enabled: true, start: "06:00", end: "13:30" },
      fri: { enabled: true, start: "06:00", end: "13:30" },
      sat: { enabled: true, start: "06:00", end: "13:30" },
      sun: { enabled: true, start: "06:00", end: "13:30" },
    },
    closedDates: [],
    temporaryClosed: false,
    temporaryPaused: false,
    takeoutEnabled: true,
    dineInEnabled: true,
    takeoutOrderingEnabled: true,
    dineInOrderingEnabled: true,
    posOrderingEnabled: true,
    checkoutMode: "postpaid",
    enablePickupDisplay: true,
    ownerId: uid,
    storeType: "breakfast",
    businessType: "breakfast",
    contactName: "測試店長",
    isOpen: true,
    orderStatus: "open",
    demoBreakfastMenuImported: true,
    temporaryNotice: "Staging 測試環境，訂單不會出現在正式站。",
    subscriptionStatus: "active",
    features: {
      kdsEnabled: true,
      dailyReportEnabled: true,
      promotionEnabled: true,
      cashFlowEnabled: true,
      memberEnabled: true,
      memberStoredValueEnabled: true,
    },
    status: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const profile = {
    id: uid,
    email: ADMIN_EMAIL,
    name: adminUser.displayName || "Platform Admin",
    role: "systemAdmin",
    storeId: STORE_ID,
    storeIds: [STORE_ID],
    memberships: { [STORE_ID]: "owner" },
    storeRoles: { [STORE_ID]: "owner" },
    approved: true,
    pending: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const binding = {
    id: `${STORE_ID}_${uid}`,
    userId: uid,
    uid,
    email: ADMIN_EMAIL,
    storeId: STORE_ID,
    role: "owner",
    storeRole: "owner",
    status: "active",
    approved: true,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(db.collection("stores").doc(STORE_ID), store, { merge: true });
  batch.set(db.collection("users").doc(uid), profile, { merge: true });
  batch.set(db.collection("storeUsers").doc(binding.id), binding, { merge: true });
  batch.set(db.collection("storeUserBindings").doc(binding.id), binding, { merge: true });
  batch.set(db.collection("storeMembers").doc(binding.id), binding, { merge: true });
  batch.set(db.collection("roles").doc("systemAdmin"), { id: "systemAdmin", label: "系統管理員", canManageAllStores: true, updatedAt: now }, { merge: true });
  batch.set(db.collection("roles").doc("owner"), { id: "owner", label: "老闆", canManageStore: true, updatedAt: now }, { merge: true });
  batch.set(db.collection("roles").doc("manager"), { id: "manager", label: "店長", canManageStore: true, updatedAt: now }, { merge: true });
  batch.set(db.collection("roles").doc("staff"), { id: "staff", label: "員工", canUsePos: true, updatedAt: now }, { merge: true });
  batch.set(db.collection("permissions").doc("default"), { id: "default", updatedAt: now, roles: ["systemAdmin", "owner", "manager", "staff", "viewer"] }, { merge: true });
  batch.set(db.collection("counters").doc("orderNumbers"), { qr: 1, pos: 1, kiosk: 1 }, { merge: true });
  batch.set(db.collection("stores").doc(STORE_ID).collection("settings").doc("memberRules"), {
    enablePoints: true,
    earnAmount: 100,
    earnPoints: 1,
    pointValue: 1,
    enableCouponExchange: true,
    birthdayRewardEnabled: false,
    birthdayRewardPoints: 0,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection("stores").doc(STORE_ID).collection("settings").doc("storeSettings"), {
    features: store.features,
    checkoutMode: store.checkoutMode,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  await Promise.all(categories.map((category) => upsertBoth(db, "categories", "categories", category.id, {
    ...category,
    storeId: STORE_ID,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })));

  await Promise.all(products.map((product, index) => upsertBoth(db, "products", "products", product[0], {
    ...productPayload(product, index),
    createdAt: now,
    updatedAt: now,
  })));

  await Promise.all(tables.map((tableName, index) => {
    const id = `staging-table-${tableName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")}`;
    const payload = {
      id,
      storeId: STORE_ID,
      tableName,
      tableNo: tableName,
      name: tableName,
      area: /^[A-Z]/.test(tableName) ? tableName[0] : "",
      number: Number(tableName.replace(/\D/g, "")) || index + 1,
      enabled: true,
      isActive: true,
      qrUrl: tableName === "外帶" ? `${APP_URL}/order/${STORE_ID}?type=takeout` : `${APP_URL}/order/${STORE_ID}?type=dineIn&table=${encodeURIComponent(tableName)}`,
      sort: index + 1,
      createdAt: now,
      updatedAt: now,
    };
    return upsertBoth(db, "tables", "tables", id, payload);
  }));

  console.log("[seed:staging] completed", {
    projectId: PROJECT_ID,
    adminEmail: ADMIN_EMAIL,
    adminUid: uid,
    storeId: STORE_ID,
    storeName: STORE_NAME,
    categories: categories.length,
    products: products.length,
    tables: tables.length,
  });
}

main().catch((error) => {
  console.error("[seed:staging] failed", error);
  process.exit(1);
});