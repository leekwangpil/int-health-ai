export const DAILY_LIMIT = 30;

const STORAGE_KEY = "healthai_daily_usage";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function checkDailyLimit(): { allowed: boolean; remaining: number } {
  if (typeof window === "undefined") {
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  const today = getToday();
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: 0 })
    );
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  try {
    const data = JSON.parse(saved);

    // 날짜가 바뀌면 초기화
    if (data.date !== today) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: today, count: 0 })
      );
      return { allowed: true, remaining: DAILY_LIMIT };
    }

    const remaining = DAILY_LIMIT - (data.count || 0);

    if (remaining <= 0) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining };
  } catch {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: 0 })
    );
    return { allowed: true, remaining: DAILY_LIMIT };
  }
}

export function increaseUsage() {
  if (typeof window === "undefined") return;

  const today = getToday();
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: 1 })
    );
    return;
  }

  try {
    const data = JSON.parse(saved);

    if (data.date !== today) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: today, count: 1 })
      );
      return;
    }

    data.count = (data.count || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: 1 })
    );
  }
}

/** 오늘 날짜 기준 사용 횟수를 0으로 리셋 → 30회 복구 */
export function resetUsage(): { allowed: boolean; remaining: number } {
  if (typeof window === "undefined") {
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  try {
    const today = getToday();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: 0 })
    );
  } catch {
    // localStorage 접근 실패 시 무시
  }

  return checkDailyLimit();
}
