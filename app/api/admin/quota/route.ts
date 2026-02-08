// app/api/admin/quota/route.ts — 관리자 전용: 전역 일일 쿼터 스냅샷 조회

import { NextResponse } from "next/server";
import { getGlobalQuotaSnapshot } from "@/lib/global-daily-cap";

/** 하드코딩 fallback 비밀번호 */
const FALLBACK_PASSWORD = "int358";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password: unknown = body?.password;

    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const expected = process.env.ADMIN_PASSWORD || FALLBACK_PASSWORD;

    if (password !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const snapshot = await getGlobalQuotaSnapshot();

    if ("error" in snapshot) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      cap: snapshot.cap,
      count: snapshot.count,
      remaining: snapshot.remaining,
      dateKey: snapshot.dateKey,
    });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
