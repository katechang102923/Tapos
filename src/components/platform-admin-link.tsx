"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
import { auth, firebaseEnabled } from "@/lib/firebase";
import { isPlatformAdminEmail } from "@/lib/store-access";

export function PlatformAdminLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setShow(true); // demo mode: always show for convenience
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setShow(isPlatformAdminEmail(user?.email));
    });
    return unsub;
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/platform"
      className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-tomato hover:shadow-soft"
    >
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-tomato text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h2 className="font-black text-ink">平台管理中心</h2>
          <p className="mt-2 text-sm leading-6 text-steel">管理所有店家、功能開關、帳號審核與平台設定。</p>
        </div>
      </div>
    </Link>
  );
}
