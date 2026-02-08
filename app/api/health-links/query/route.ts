// app/api/health-links/query/route.ts

import { NextResponse } from "next/server";
import { askHealthAI, askIntakeFinal } from "@/lib/ai-client";
import { filterValidLinks } from "@/lib/validator";
import { buildSources } from "@/lib/sources-registry";
import type { CiteId } from "@/lib/sources-registry";
import { PREVISIT_CHECKLIST_V1 } from "@/lib/previsit-checklist";
import { checkAndConsumeGlobalQuota } from "@/lib/global-daily-cap";

/** 상단 안전 안내 — 모든 응답에 포함 */
const SAFETY_NOTICE =
  "본 정보는 의료 진단/처방이 아닌 참고용 안내입니다. 응급/위험 증상 시 119 또는 의료기관에 즉시 연락하세요.";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Health Link API is alive",
  });
}

/** sources 생성 + 화이트리스트 필터 (공용 헬퍼) */
function safeSources(keyword: string, citeIds?: CiteId[]) {
  const allSources =
    citeIds && citeIds.length > 0
      ? buildSources(keyword, citeIds)
      : buildSources(keyword);

  const validUrls = new Set(
    filterValidLinks(allSources.map((s) => s.url)),
  );
  return allSources.filter((s) => validUrls.has(s.url));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── 신규 payload 판별 ──────────────────────────────
    const mode: string | undefined = body.mode;
    const stage: string | undefined = body.stage;

    // ── intake/followup: 체크리스트만 반환 (OpenAI 호출 없음 → 쿼터 미소비) ──
    if (mode === "intake" && stage === "followup") {
      const input: string = body.input;
      if (!input || typeof input !== "string" || !input.trim()) {
        return NextResponse.json(
          { error: "input is required" },
          { status: 400 },
        );
      }
      const sources = safeSources(input.trim());
      return NextResponse.json({
        mode: "intake",
        stage: "followup",
        checklist: PREVISIT_CHECKLIST_V1,
        safety: { notice: SAFETY_NOTICE },
        sources,
      });
    }

    // ── 이하 경로는 OpenAI 호출 포함 → 전역 일일 하드 리밋 체크 ─────────
    const quota = await checkAndConsumeGlobalQuota();

    if ("error" in quota) {
      // production env 미설정 또는 Upstash 장애 → 안전하게 차단
      return NextResponse.json(
        { error: "서비스 점검 중입니다. 잠시 후 다시 시도해주세요." },
        { status: 503 },
      );
    }

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            "오늘은 공개 테스트 사용량이 모두 소진되었습니다. 내일 다시 이용해주세요.",
        },
        { status: 429 },
      );
    }

    // mode/stage 없고 question만 있으면 기존 info/answer 호환
    if (!mode && !stage && typeof body.question === "string") {
      return handleInfo(body.question);
    }

    // mode가 "info"면 기존 처리
    if (mode === "info" && stage === "answer") {
      const input: string = body.input;
      if (!input || typeof input !== "string" || !input.trim()) {
        return NextResponse.json(
          { error: "input is required" },
          { status: 400 },
        );
      }
      return handleInfo(input);
    }

    // ── intake 모드 ──────────────────────────────────
    if (mode === "intake") {
      const input: string = body.input;
      if (!input || typeof input !== "string" || !input.trim()) {
        return NextResponse.json(
          { error: "input is required" },
          { status: 400 },
        );
      }
      const trimmed = input.trim();

      if (stage === "final") {
        const qa: { q: string; a: string }[] = Array.isArray(body.qa)
          ? body.qa
          : [];
        const result = await askIntakeFinal(trimmed, qa);
        const sources = safeSources(trimmed);
        return NextResponse.json({
          safety: { notice: SAFETY_NOTICE },
          preVisitBriefing: result.preVisitBriefing,
          questionsForDoctor: result.questionsForDoctor,
          redFlags: result.redFlags,
          sources,
        });
      }

      return NextResponse.json(
        { error: "stage must be 'followup' or 'final'" },
        { status: 400 },
      );
    }

    // 알 수 없는 조합
    return NextResponse.json(
      { error: "question or valid mode/stage is required" },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 기존 info/answer 처리 (하위호환) */
async function handleInfo(rawQuestion: string) {
  const trimmed = rawQuestion.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 },
    );
  }

  // 1. OpenAI 호출
  const aiResponse = await askHealthAI(trimmed);

  // 2. citeIds 수집
  const citeIds: CiteId[] = [
    ...new Set(aiResponse.claims.flatMap((c) => c.cites)),
  ];

  // 3-4. sources 생성 + 필터
  const sources = safeSources(trimmed, citeIds);

  // 5. 응답
  return NextResponse.json({
    safety: SAFETY_NOTICE,
    answer: aiResponse.answer,
    claims: aiResponse.claims,
    sources,
  });
}
