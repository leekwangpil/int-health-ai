// lib/global-daily-cap.ts — 서버 전역 일일 API 하드 리밋 (Upstash Redis REST, fetch 기반)

/** 하루 최대 허용 호출 수 */
export const GLOBAL_DAILY_CAP = 500;

// ─── 환경변수 ────────────────────────────────────────────
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

// ─── 유틸 ────────────────────────────────────────────────

/** 현재 시각을 Asia/Seoul(UTC+9) 기준 YYYY-MM-DD 문자열로 반환 */
function seoulDateKey(): string {
  const now = new Date();
  // UTC ms + 9h offset
  const seoulMs = now.getTime() + 9 * 60 * 60 * 1000;
  const seoul = new Date(seoulMs);
  const y = seoul.getUTCFullYear();
  const m = String(seoul.getUTCMonth() + 1).padStart(2, "0");
  const d = String(seoul.getUTCDate()).padStart(2, "0");
  return `global_daily_api_count:${y}-${m}-${d}`;
}

/** 다음 날 00:00(서울) 까지 남은 초 + 여유 120초 */
function secondsUntilSeoulMidnight(): number {
  const now = new Date();
  const seoulMs = now.getTime() + 9 * 60 * 60 * 1000;
  const seoul = new Date(seoulMs);
  const nextMidnight = new Date(
    Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate() + 1),
  );
  // nextMidnight(UTC) → 서울 시간 기준이므로 다시 -9h 해서 실제 UTC 시점으로 변환
  const realNextMidnightMs = nextMidnight.getTime() - 9 * 60 * 60 * 1000;
  const diffSec = Math.ceil((realNextMidnightMs - now.getTime()) / 1000);
  return diffSec + 120; // 여유 2분
}

// ─── Upstash REST 호출 ──────────────────────────────────

async function upstashIncr(key: string): Promise<number> {
  const res = await fetch(
    `${UPSTASH_URL}/incr/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Upstash INCR failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { result: number };
  return json.result;
}

async function upstashExpire(key: string, seconds: number): Promise<void> {
  const res = await fetch(
    `${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${seconds}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Upstash EXPIRE failed: ${res.status} ${res.statusText}`);
  }
}

// ─── 퍼블릭 API ─────────────────────────────────────────

export type QuotaResult =
  | { allowed: true; remaining: number }
  | { allowed: false; count: number }
  | { error: "no_env"; message: string }
  | { error: "upstash_failure"; message: string };

/**
 * 전역 일일 쿼터를 원자적으로 소비하고 결과를 반환한다.
 *
 * - dev(로컬)에서 env 미설정이면 체크를 건너뛰고 허용(allowed:true) 반환
 * - production에서 env 미설정이면 { error: "no_env" } 반환 → 호출부에서 503 처리
 * - Upstash 장애 시 { error: "upstash_failure" } 반환 → 호출부에서 503 처리
 */
// ─── 스냅샷 조회 (소비 X, 읽기 전용) ────────────────────

export type QuotaSnapshot =
  | { cap: number; count: number; remaining: number; dateKey: string }
  | { error: string };

/**
 * 현재 전역 일일 사용량을 읽기 전용으로 조회한다.
 * - Upstash REST GET 사용 (카운터를 증가시키지 않음)
 * - env 미설정(dev) → count=0 반환 / production → error 반환
 */
export async function getGlobalQuotaSnapshot(): Promise<QuotaSnapshot> {
  const isProd = process.env.NODE_ENV === "production";

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    if (isProd) {
      return { error: "Upstash env vars not configured in production" };
    }
    // dev: env 없으면 count=0 으로 간주
    const key = seoulDateKey();
    const dateOnly = key.replace("global_daily_api_count:", "");
    return { cap: GLOBAL_DAILY_CAP, count: 0, remaining: GLOBAL_DAILY_CAP, dateKey: dateOnly };
  }

  try {
    const key = seoulDateKey();
    const res = await fetch(
      `${UPSTASH_URL}/get/${encodeURIComponent(key)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      },
    );
    if (!res.ok) {
      throw new Error(`Upstash GET failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { result: string | null };
    const raw = json.result;
    const count = raw === null ? 0 : (Number(raw) || 0);
    const remaining = Math.max(0, GLOBAL_DAILY_CAP - count);
    const dateOnly = key.replace("global_daily_api_count:", "");
    return { cap: GLOBAL_DAILY_CAP, count, remaining, dateKey: dateOnly };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Upstash error";
    if (isProd) {
      return { error: msg };
    }
    const key = seoulDateKey();
    const dateOnly = key.replace("global_daily_api_count:", "");
    return { cap: GLOBAL_DAILY_CAP, count: 0, remaining: GLOBAL_DAILY_CAP, dateKey: dateOnly };
  }
}

// ─── 소비형 API ─────────────────────────────────────────

export async function checkAndConsumeGlobalQuota(): Promise<QuotaResult> {
  const isProd = process.env.NODE_ENV === "production";

  // 환경변수 미설정 처리
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    if (isProd) {
      return {
        error: "no_env",
        message: "Upstash env vars not configured in production",
      };
    }
    // dev에서는 무제한 허용
    return { allowed: true, remaining: GLOBAL_DAILY_CAP };
  }

  try {
    const key = seoulDateKey();
    const count = await upstashIncr(key);

    // 첫 INCR(카운트 1)이면 TTL 설정
    if (count === 1) {
      await upstashExpire(key, secondsUntilSeoulMidnight());
    }

    if (count > GLOBAL_DAILY_CAP) {
      return { allowed: false, count };
    }

    return { allowed: true, remaining: GLOBAL_DAILY_CAP - count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Upstash error";
    if (isProd) {
      return { error: "upstash_failure", message: msg };
    }
    // dev에서 장애 시 허용
    return { allowed: true, remaining: GLOBAL_DAILY_CAP };
  }
}
