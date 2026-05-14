"use client";

import Link from "next/link";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { LoginGate } from "@/components/auth/login-gate";
import { defaultStoreId } from "@/lib/store-access";

export default function KdsPage() {
  return (
    <LoginGate allowedRoles={["systemAdmin", "owner", "manager", "staff"]} title="廚房 KDS 登入">
      {({ profile }) => {
        const storeId = defaultStoreId(profile);
        if (!storeId) {
          return (
            <main className="grid min-h-screen place-items-center bg-[#111111] p-4 text-white">
              <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
                <p className="text-sm font-black text-tomato">尚未綁定店家</p>
                <h1 className="mt-2 text-2xl font-black">請先在使用者角色管理設定 storeId</h1>
                <Link href="/merchant" className="mt-4 inline-flex rounded-lg bg-ink px-4 py-3 font-black text-white">回店家後台</Link>
              </div>
            </main>
          );
        }
        return <KitchenBoard storeId={storeId} />;
      }}
    </LoginGate>
  );
}
