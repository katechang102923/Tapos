#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROD_PROJECT_ID = process.env.PROD_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID;
const STAGING_PROJECT_ID = process.env.STAGING_FIREBASE_PROJECT_ID || process.env.FIREBASE_STAGING_PROJECT_ID || "tapos-staging";

const ALLOWED_TOP_LEVEL_COLLECTIONS = [
  "categories",
  "products",
  "optionGroups",
  "sharedOptionGroups",
  "storeUsers",
  "storeUserBindings",
  "storeMembers",
];

const ALLOWED_STORE_SUBCOLLECTIONS = [
  "categories",
  "products",
  "optionGroups",
  "sharedOptionGroups",
  "tables",
  "settings",
];

const BLOCKED_COLLECTION_NAMES = new Set([
  "orders",
  "members",
  "customers",
  "cashFlows",
  "cashFlowItems",
  "dailyReports",
  "memberTransactions",
  "memberCoupons",
  "pointLogs",
  "storedValueLogs",
]);

function parseArgs(argv) {
  return argv.reduce((args, item) => {
    if (!item.startsWith("--")) return args;
    const [rawKey, ...rest] = item.slice(2).split("=");
    args[rawKey] = rest.length ? rest.join("=") : "true";
    return args;
  }, {});
}

function readJsonCredential({ base64Env, jsonEnv, fileEnv }) {
  if (process.env[base64Env]) {
    return cert(JSON.parse(Buffer.from(process.env[base64Env], "base64").toString("utf8")));
  }
  if (process.env[jsonEnv]) {
    return cert(JSON.parse(process.env[jsonEnv]));
  }
  if (process.env[fileEnv]) {
    return cert(JSON.parse(readFileSync(process.env[fileEnv], "utf8")));
  }
  return applicationDefault();
}

function appFor(name, projectId, credentialConfig) {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;
  return initializeApp({ credential: readJsonCredential(credentialConfig), projectId }, name);
}

function sanitizeForFirestore(value) {
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, sanitizeForFirestore(entryValue)])
  );
}

function withStagingStoreId(data, sourceStoreId, targetStoreId) {
  const next = { ...data };
  if (next.id === sourceStoreId) next.id = targetStoreId;
  if (next.storeId === sourceStoreId) next.storeId = targetStoreId;
  if (next.currentStoreId === sourceStoreId) next.currentStoreId = targetStoreId;
  if (next.storeIds && Array.isArray(next.storeIds)) {
    next.storeIds = next.storeIds.map((id) => (id === sourceStoreId ? targetStoreId : id));
  }
  if (next.memberships && typeof next.memberships === "object" && sourceStoreId !== targetStoreId) {
    next.memberships = Object.fromEntries(
      Object.entries(next.memberships).map(([storeId, role]) => [storeId === sourceStoreId ? targetStoreId : storeId, role])
    );
  }
  if (next.storeRoles && typeof next.storeRoles === "object" && sourceStoreId !== targetStoreId) {
    next.storeRoles = Object.fromEntries(
      Object.entries(next.storeRoles).map(([storeId, role]) => [storeId === sourceStoreId ? targetStoreId : storeId, role])
    );
  }
  return next;
}

function targetDocId(sourceDocId, sourceStoreId, targetStoreId) {
  return sourceStoreId === targetStoreId ? sourceDocId : sourceDocId.replaceAll(sourceStoreId, targetStoreId);
}

async function writeInBatches(db, writes, dryRun) {
  if (dryRun) return;
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + 400)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }
}

async function copyStoreDoc({ prodDb, stagingDb, sourceStoreId, targetStoreId, prefix, now, writes }) {
  const sourceRef = prodDb.collection("stores").doc(sourceStoreId);
  const snapshot = await sourceRef.get();
  if (!snapshot.exists) throw new Error(`Source store not found: stores/${sourceStoreId}`);

  const source = snapshot.data();
  const storeName = source.name || sourceStoreId;
  const payload = sanitizeForFirestore({
    ...withStagingStoreId(source, sourceStoreId, targetStoreId),
    id: targetStoreId,
    name: storeName.startsWith(prefix) ? storeName : `${prefix}${storeName}`,
    originalProductionStoreId: sourceStoreId,
    stagingCopiedFrom: sourceStoreId,
    stagingCopiedAt: now,
    updatedAt: now,
  });

  writes.push({
    ref: stagingDb.collection("stores").doc(targetStoreId),
    data: payload,
  });
  return payload.name;
}

async function copyTopLevelCollection({ prodDb, stagingDb, collectionName, sourceStoreId, targetStoreId, now, writes }) {
  if (BLOCKED_COLLECTION_NAMES.has(collectionName)) return 0;
  const snapshot = await prodDb.collection(collectionName).where("storeId", "==", sourceStoreId).get();
  snapshot.forEach((docSnap) => {
    const payload = sanitizeForFirestore({
      ...withStagingStoreId(docSnap.data(), sourceStoreId, targetStoreId),
      stagingCopiedFrom: sourceStoreId,
      stagingCopiedAt: now,
      updatedAt: docSnap.data().updatedAt || now,
    });
    writes.push({
      ref: stagingDb.collection(collectionName).doc(targetDocId(docSnap.id, sourceStoreId, targetStoreId)),
      data: payload,
    });
  });
  return snapshot.size;
}

async function copyStoreSubcollection({ prodDb, stagingDb, collectionName, sourceStoreId, targetStoreId, now, writes }) {
  if (BLOCKED_COLLECTION_NAMES.has(collectionName)) return 0;
  const sourceCollection = prodDb.collection("stores").doc(sourceStoreId).collection(collectionName);
  const snapshot = await sourceCollection.get();
  snapshot.forEach((docSnap) => {
    const payload = sanitizeForFirestore({
      ...withStagingStoreId(docSnap.data(), sourceStoreId, targetStoreId),
      stagingCopiedFrom: sourceStoreId,
      stagingCopiedAt: now,
      updatedAt: docSnap.data().updatedAt || now,
    });
    writes.push({
      ref: stagingDb.collection("stores").doc(targetStoreId).collection(collectionName).doc(targetDocId(docSnap.id, sourceStoreId, targetStoreId)),
      data: payload,
    });
  });
  return snapshot.size;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceStoreId = args.storeId;
  if (!sourceStoreId) {
    throw new Error("Missing required argument: --storeId=PRODUCTION_STORE_ID");
  }
  if (!PROD_PROJECT_ID) {
    throw new Error("Missing PROD_FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID");
  }
  if (STAGING_PROJECT_ID !== "tapos-staging") {
    throw new Error(`Refusing to write staging data to non-staging project: ${STAGING_PROJECT_ID}`);
  }

  const targetStoreId = args.targetStoreId || sourceStoreId;
  const prefix = args.prefix ?? "[STAGING] ";
  const dryRun = args.dryRun === "true";
  const now = new Date().toISOString();

  const prodApp = appFor("production-source", PROD_PROJECT_ID, {
    base64Env: "PROD_FIREBASE_SERVICE_ACCOUNT_BASE64",
    jsonEnv: "PROD_FIREBASE_SERVICE_ACCOUNT_JSON",
    fileEnv: "PROD_GOOGLE_APPLICATION_CREDENTIALS",
  });
  const stagingApp = appFor("staging-target", STAGING_PROJECT_ID, {
    base64Env: "STAGING_FIREBASE_SERVICE_ACCOUNT_BASE64",
    jsonEnv: "STAGING_FIREBASE_SERVICE_ACCOUNT_JSON",
    fileEnv: "STAGING_GOOGLE_APPLICATION_CREDENTIALS",
  });

  const prodDb = getFirestore(prodApp);
  const stagingDb = getFirestore(stagingApp);
  const writes = [];
  const counts = {};

  const stagingStoreName = await copyStoreDoc({ prodDb, stagingDb, sourceStoreId, targetStoreId, prefix, now, writes });

  for (const collectionName of ALLOWED_TOP_LEVEL_COLLECTIONS) {
    counts[collectionName] = await copyTopLevelCollection({ prodDb, stagingDb, collectionName, sourceStoreId, targetStoreId, now, writes });
  }

  for (const collectionName of ALLOWED_STORE_SUBCOLLECTIONS) {
    counts[`stores/{storeId}/${collectionName}`] = await copyStoreSubcollection({ prodDb, stagingDb, collectionName, sourceStoreId, targetStoreId, now, writes });
  }

  await writeInBatches(stagingDb, writes, dryRun);

  console.log("[seed:staging-from-prod] completed", {
    dryRun,
    prodProjectId: PROD_PROJECT_ID,
    stagingProjectId: STAGING_PROJECT_ID,
    sourceStoreId,
    targetStoreId,
    stagingStoreName,
    writes: writes.length,
    copied: counts,
    skippedSensitiveCollections: Array.from(BLOCKED_COLLECTION_NAMES),
  });
}

main().catch((error) => {
  console.error("[seed:staging-from-prod] failed", error);
  process.exitCode = 1;
});
