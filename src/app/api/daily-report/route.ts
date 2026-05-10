import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { storeId, date, storeName } = await req.json() as { storeId?: string; date?: string; storeName?: string };
    if (!storeId || !date) {
      return NextResponse.json({ ok: false, error: "Missing storeId or date" }, { status: 400 });
    }

    // Email integration stub — replace with your SMTP/SendGrid/Resend client here.
    // The actual report data should be fetched server-side via Firebase Admin SDK
    // once firebase-admin is added as a dependency.
    console.log("[daily-report] 模擬寄送 Email");
    console.log("[daily-report] 店家:", storeName ?? storeId, "日期:", date);

    return NextResponse.json({ ok: true, storeId, date });
  } catch (err) {
    console.error("[daily-report] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
