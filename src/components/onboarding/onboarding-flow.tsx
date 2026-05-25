"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ArrowRight, ImagePlus, QrCode } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { firestore } from "@/lib/firebase";
import { createDefaultMenu } from "@/lib/menu-templates";
import type { BusinessType, Store, StoreType, User } from "@/lib/types";

type BusinessOption = { value: BusinessType; label: string; storeType: StoreType };

const businessTypes: BusinessOption[] = [
  { value: "breakfast",  label: "早餐店", storeType: "breakfast" },
  { value: "drink",      label: "飲料店", storeType: "drink" },
  { value: "snack",      label: "小吃店", storeType: "snack" },
  { value: "restaurant", label: "餐廳",   storeType: "hotpot" },
  { value: "other",      label: "其他",   storeType: "breakfast" },
];

const defaultLogo = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80";
const defaultBanner = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1400&q=80";

export function OnboardingFlow() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff"]} title="開始建立店家">
      {({ profile, firebaseUser }) => <OnboardingContent uid={firebaseUser?.uid ?? ""} profile={profile} />}
    </LoginGate>
  );
}

function OnboardingContent({ uid, profile }: { uid: string; profile: User | null }) {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [contactName, setContactName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("breakfast");
  const [logoUrl, setLogoUrl] = useState(defaultLogo);
  const [bannerUrl, setBannerUrl] = useState(defaultBanner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (profile?.status === "pending" || profile?.status === "rejected") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
          <div className="grid size-12 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <QrCode className="size-6" />
          </div>
          <h1 className="mt-4 text-3xl font-black text-ink">
            {profile.status === "rejected" ? "帳號已被拒絕" : "等待管理員審核"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-steel">
            {profile.status === "rejected"
              ? "您的帳號註冊已被管理員拒絕。如有疑問請聯繫管理員。"
              : "您的帳號已提交審核，管理員將盡快處理。請耐心等候。"}
          </p>
          <p className="mt-3 text-xs text-steel">審核通過後，您將可以建立店家並開始使用系統。</p>
        </div>
      </main>
    );
  }

  // 已有店家且不是 admin，跳轉後台
  if (profile?.storeId && profile.role !== "systemAdmin") {
    router.replace("/merchant");
  }

  async function readFile(file: File, setter: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function createStore() {
    if (!firestore) { setError("Firebase 尚未設定"); return; }
    if (!storeName.trim()) { setError("請輸入店家名稱"); return; }
    if (!contactName.trim()) { setError("請輸入聯絡人姓名"); return; }
    if (!phone.trim()) { setError("請輸入聯絡電話"); return; }

    setLoading(true);
    setError("");

    const db = firestore;
    const now = new Date().toISOString();
    const storeId = `store-${uid.slice(0, 8)}-${Date.now().toString(36)}`;
    const option = businessTypes.find((b) => b.value === businessType) ?? businessTypes[0];
    const storeType: StoreType = option.storeType;

    const store: Store = {
      id: storeId,
      ownerId: uid,
      name: storeName.trim(),
      logoUrl,
      bannerUrl,
      storeType,
      businessType,
      contactName: contactName.trim(),
      phone: phone.trim(),
      address: address.trim() || "",
      isOpen: true,
      demoBreakfastMenuImported: storeType === "breakfast",
      notice: "歡迎線上點餐，尖峰時段請稍候。",
      createdAt: now,
    };

    const menu = createDefaultMenu(storeId, storeType);

    const applicationRef = doc(collection(db, "storeApplications"));
    const application = {
      id: applicationRef.id,
      type: "store_registration" as const,
      status: "pending" as const,
      email: profile?.email ?? "",
      uid,
      storeId,
      storeName: storeName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      address: address.trim() || "",
      businessType,
      createdAt: now,
      updatedAt: now,
    };
    const notifRef = doc(collection(db, "platformNotifications"));
    const notification = {
      id: notifRef.id,
      type: "new_registration" as const,
      applicationId: applicationRef.id,
      email: profile?.email ?? "",
      storeId,
      storeName: storeName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      address: address.trim() || "",
      businessType,
      createdAt: serverTimestamp(),
      updatedAt: now,
      isRead: false,
      read: false,
      status: "new" as const,
    };

    try {
      // ── Step 1: Create the store document ──────────────────────────────────
      await setDoc(doc(db, "stores", storeId), store);

      // ── Step 2: Write notification + application NOW, before the user-profile
      // update.  These writes only require signedIn() so they succeed even if
      // the profile-update rule below fails.  We fire both in parallel and
      // log (but do NOT throw) on failure so onboarding always completes.
      await Promise.allSettled([
        setDoc(notifRef, notification).catch((notifErr: unknown) => {
          console.error("[Onboarding] platformNotifications write failed:", notifErr);
        }),
        setDoc(applicationRef, application).catch((appErr: unknown) => {
          console.error("[Onboarding] storeApplications write failed:", appErr);
        }),
      ]);

      // ── Step 3: Elevate the owner's profile (requires Firestore rule fix) ──
      await updateDoc(doc(db, "users", uid), {
        storeId,
        storeIds: [storeId],
        memberships: { [storeId]: "owner" },
        storeRoles: { [storeId]: "owner" },
        role: "owner",
        approved: true,
        status: "active",
        updatedAt: now,
      });

      // ── Step 4: Seed default menu categories + products ────────────────────
      await Promise.all([
        ...menu.categories.map((cat) => setDoc(doc(db, "categories", cat.id), cat)),
        ...menu.products.map((prod) => setDoc(doc(db, "products", prod.id), prod)),
      ]);

      router.push("/merchant");
    } catch (err) {
      console.error("[Onboarding] createStore failed:", err);
      const msg = err instanceof Error ? err.message : "建立失敗，請再試一次";
      const isPermission = /permission|PERMISSION_DENIED|insufficient/i.test(msg);
      setError(isPermission
        ? "建立失敗：權限不足，請確認 Firestore 規則已正確部署，或聯絡平台管理員。"
        : msg);
      setLoading(false);
    }
  }

  const email = profile?.email ?? "";
  const selectedBusiness = businessTypes.find((b) => b.value === businessType);

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_420px]">
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">Store Onboarding</p>
          <h1 className="mt-2 text-4xl font-black text-ink">建立你的第一間店</h1>
          <p className="mt-3 leading-7 text-steel">完成後會自動建立店家、預設菜單與 QR Code，馬上可以測試顧客點餐流程。</p>

          <div className="mt-6 grid gap-4">
            {/* 註冊信箱（唯讀） */}
            <label className="font-black text-steel">
              註冊信箱
              <input
                value={email}
                readOnly
                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 font-bold text-stone-400"
              />
            </label>

            {/* 店家名稱 */}
            <label className="font-black text-steel">
              店家名稱 <span className="text-tomato">*</span>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="例如：早安巷口"
                className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 text-lg font-bold"
              />
            </label>

            {/* 店家類型 */}
            <div>
              <p className="font-black text-steel">店家類型 <span className="text-tomato">*</span></p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {businessTypes.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setBusinessType(item.value)}
                    className={`rounded-lg px-4 py-4 font-black ${
                      businessType === item.value ? "bg-ink text-white" : "bg-stone-100 text-steel"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 聯絡人 + 電話 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="font-black text-steel">
                聯絡人姓名 <span className="text-tomato">*</span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="負責人姓名"
                  className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 font-bold"
                />
              </label>
              <label className="font-black text-steel">
                聯絡電話 <span className="text-tomato">*</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912-345-678"
                  type="tel"
                  className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 font-bold"
                />
              </label>
            </div>

            {/* 地址（可選） */}
            <label className="font-black text-steel">
              店家地址
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例如：台北市大安區復興南路一段 1 號（可略）"
                className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 font-bold"
              />
            </label>

            {/* Logo / Banner */}
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadBox label="Logo" value={logoUrl} onUrl={setLogoUrl} onFile={(file) => readFile(file, setLogoUrl)} />
              <UploadBox label="Banner" value={bannerUrl} onUrl={setBannerUrl} onFile={(file) => readFile(file, setBannerUrl)} />
            </div>

            {error && <p className="rounded-lg bg-tomato/10 p-3 font-bold text-tomato">{error}</p>}

            <button
              onClick={createStore}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-5 py-4 text-lg font-black text-white disabled:bg-stone-300"
            >
              {loading ? "建立中..." : "建立店家並產生菜單"}
              {!loading && <ArrowRight className="size-5" />}
            </button>
          </div>
        </section>

        <aside className="rounded-lg bg-ink p-5 text-white shadow-soft">
          <img src={bannerUrl} alt="Banner preview" className="aspect-[16/9] w-full rounded-lg object-cover opacity-80" />
          <div className="mt-4 flex items-center gap-3">
            <img src={logoUrl} alt="Logo preview" className="size-16 rounded-lg object-cover" />
            <div>
              <p className="text-2xl font-black">{storeName || "你的店名"}</p>
              <p className="text-sm font-bold text-white/60">{selectedBusiness?.label ?? "早餐店"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-white/10 p-4 space-y-1">
            <p className="text-xs font-black text-white/40">聯絡資訊</p>
            <p className="font-bold text-white/80">{contactName || "聯絡人"}</p>
            <p className="text-sm font-bold text-white/60">{phone || "電話"}</p>
            {address && <p className="text-sm font-bold text-white/40">{address}</p>}
          </div>
          <div className="mt-4 rounded-lg bg-white p-4 text-ink">
            <div className="flex items-center gap-3">
              <QrCode className="size-8" />
              <div>
                <p className="font-black">QR Code 會自動產生</p>
                <p className="text-sm font-bold text-steel">{"/order/{storeId}"}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function UploadBox({
  label,
  value,
  onUrl,
  onFile,
}: {
  label: string;
  value: string;
  onUrl: (value: string) => void;
  onFile: (file: File) => void;
}) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-center gap-2 font-black text-steel">
        <ImagePlus className="size-4" />
        {label}
      </div>
      <img src={value} alt={`${label} preview`} className="mt-3 aspect-[4/3] w-full rounded-lg object-cover" />
      <input value={value} onChange={(e) => onUrl(e.target.value)} className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="mt-3 w-full text-sm"
      />
    </div>
  );
}
