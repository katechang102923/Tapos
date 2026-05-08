"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { ArrowRight, ImagePlus, QrCode } from "lucide-react";
import { LoginGate } from "@/components/auth/login-gate";
import { firestore } from "@/lib/firebase";
import { createDefaultMenu } from "@/lib/menu-templates";
import type { Store, StoreType } from "@/lib/types";

const storeTypes: Array<{ value: StoreType; label: string }> = [
  { value: "breakfast", label: "餐飲店" },
  { value: "drink", label: "飲料店" },
  { value: "snack", label: "小吃店" },
  { value: "hotpot", label: "火鍋店" }
];

const defaultLogo = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80";
const defaultBanner = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1400&q=80";

export function OnboardingFlow() {
  return (
    <LoginGate allowedRoles={["user", "merchant", "admin"]} title="開始建立店家">
      {({ profile, firebaseUser }) => <OnboardingContent uid={firebaseUser?.uid ?? ""} currentStoreId={profile?.storeId ?? null} />}
    </LoginGate>
  );
}

function OnboardingContent({ uid, currentStoreId }: { uid: string; currentStoreId: string | null }) {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("breakfast");
  const [logoUrl, setLogoUrl] = useState(defaultLogo);
  const [bannerUrl, setBannerUrl] = useState(defaultBanner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (currentStoreId) {
    router.replace("/merchant");
  }

  async function readFile(file: File, setter: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function createStore() {
    if (!firestore) {
      setError("Firebase 尚未設定");
      return;
    }
    const db = firestore;
    if (!storeName.trim()) {
      setError("請輸入店名");
      return;
    }

    setLoading(true);
    setError("");
    const storeId = `store-${uid.slice(0, 8)}-${Date.now().toString(36)}`;
    const store: Store = {
      id: storeId,
      ownerId: uid,
      name: storeName.trim(),
      logoUrl,
      bannerUrl,
      storeType,
      isOpen: true,
      demoBreakfastMenuImported: storeType === "breakfast",
      notice: "歡迎線上點餐，尖峰時段請稍候。",
      createdAt: new Date().toISOString()
    };
    const menu = createDefaultMenu(storeId, storeType);

    await setDoc(doc(db, "stores", storeId), store);
    await updateDoc(doc(db, "users", uid), { storeId, role: "merchant" });
    await Promise.all([
      ...menu.categories.map((category) => setDoc(doc(db, "categories", category.id), category)),
      ...menu.products.map((product) => setDoc(doc(db, "products", product.id), product))
    ]);

    router.push("/merchant");
  }

  return (
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_420px]">
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <p className="text-sm font-black text-leaf">Store Onboarding</p>
          <h1 className="mt-2 text-4xl font-black text-ink">建立你的第一間店</h1>
          <p className="mt-3 leading-7 text-steel">完成後會自動建立店家、預設菜單與 QR Code，馬上可以測試顧客點餐流程。</p>

          <div className="mt-6 grid gap-4">
            <label className="font-black text-steel">
              店家名稱
              <input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="例如：早安巷口" className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 text-lg font-bold" />
            </label>

            <div>
              <p className="font-black text-steel">店家類型</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {storeTypes.map((item) => (
                  <button key={item.value} onClick={() => setStoreType(item.value)} className={`rounded-lg px-4 py-4 font-black ${storeType === item.value ? "bg-ink text-white" : "bg-stone-100 text-steel"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadBox label="Logo" value={logoUrl} onUrl={setLogoUrl} onFile={(file) => readFile(file, setLogoUrl)} />
              <UploadBox label="Banner" value={bannerUrl} onUrl={setBannerUrl} onFile={(file) => readFile(file, setBannerUrl)} />
            </div>

            {error && <p className="rounded-lg bg-tomato/10 p-3 font-bold text-tomato">{error}</p>}
            <button onClick={createStore} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-5 py-4 text-lg font-black text-white disabled:bg-stone-300">
              建立店家並產生菜單
              <ArrowRight className="size-5" />
            </button>
          </div>
        </section>

        <aside className="rounded-lg bg-ink p-5 text-white shadow-soft">
          <img src={bannerUrl} alt="Banner preview" className="aspect-[16/9] w-full rounded-lg object-cover opacity-80" />
          <div className="mt-4 flex items-center gap-3">
            <img src={logoUrl} alt="Logo preview" className="size-16 rounded-lg object-cover" />
            <div>
              <p className="text-2xl font-black">{storeName || "你的店名"}</p>
              <p className="text-sm font-bold text-white/60">{storeTypes.find((item) => item.value === storeType)?.label}</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg bg-white p-4 text-ink">
            <div className="flex items-center gap-3">
              <QrCode className="size-8" />
              <div>
                <p className="font-black">QR Code 會自動產生</p>
                <p className="text-sm font-bold text-steel">/order/&lbrace;storeId&rbrace;</p>
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
  onFile
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
      <input value={value} onChange={(event) => onUrl(event.target.value)} className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} className="mt-3 w-full text-sm" />
    </div>
  );
}
