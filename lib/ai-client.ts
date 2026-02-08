// lib/ai-client.ts

import OpenAI from "openai";
import type { CiteId } from "./sources-registry";

const apiKey = process.env.OPENAI_API_KEY ?? "";
if (!apiKey || /[^\x20-\x7E]/.test(apiKey)) {
  throw new Error(
    "OPENAI_API_KEY is missing or contains non-ASCII characters. " +
      "Please set a valid API key in .env.local"
  );
}

const openai = new OpenAI({ apiKey });

export type Claim = { text: string; cites: CiteId[] };

export type AIResponse = {
  answer: string;
  claims: Claim[];
};

const VALID_IDS: readonly string[] = [
  "kdca",
  "who",
  "cdc",
  "pubmed",
  "medlineplus",
  "nice",
];

const SYSTEM_PROMPT = `당신은 신뢰할 수 있는 건강 정보 안내 AI입니다.
사용자가 건강 관련 질문을 하면:
1. 정확하고 명확한 답변을 한국어로 제공하세요.
2. 의료 진단이나 처방을 하지 마세요. 정보 안내만 하세요.
3. URL이나 링크는 포함하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "answer": "1~2문장 요약",
  "claims": [
    { "text": "사실/의학정보 한 가지", "cites": ["kdca","who"] }
  ]
}

claims 규칙:
- claims는 3~6개 작성하세요.
- 각 claim의 text에는 사실 또는 의학정보를 1개만 적으세요.
- 각 claim의 cites에는 반드시 1~3개의 출처 ID를 넣으세요.
- 사용할 수 있는 출처 ID: ["kdca","who","cdc","pubmed","medlineplus","nice"]
- kdca = 한국질병관리청, who = WHO, cdc = 미국 CDC, pubmed = PubMed, medlineplus = MedlinePlus, nice = 영국 NICE
- 해당 claim과 확실히 관련된 출처만 넣으세요. 억지로 넣지 마세요.
- 확실히 연결할 출처가 없으면 그 claim은 작성하지 마세요.`;

export async function askHealthAI(question: string): Promise<AIResponse> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI로부터 응답을 받지 못했습니다.");
  }

  const parsed = JSON.parse(content);

  const answer: string = typeof parsed.answer === "string" ? parsed.answer : "";

  const rawClaims: unknown[] = Array.isArray(parsed.claims)
    ? parsed.claims
    : [];

  const claims: Claim[] = rawClaims
    .map((c: unknown) => {
      if (!c || typeof c !== "object") return null;
      const obj = c as Record<string, unknown>;
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      const rawCites = Array.isArray(obj.cites) ? obj.cites : [];
      const cites = rawCites.filter(
        (id: unknown): id is CiteId =>
          typeof id === "string" && VALID_IDS.includes(id),
      );
      if (!text || cites.length === 0) return null;
      return { text, cites };
    })
    .filter((c): c is Claim => c !== null);

  return { answer, claims };
}

/* ── Intake helpers ─────────────────────────────────────── */

export type PreVisitBriefing = {
  oneLiner: string;
  visitPurpose: string;
  topConcerns: string[];
  symptomsSummary: {
    onset: string;
    course: string;
    location: string;
    quality: string;
    severity0to10: string;
    frequencyDuration: string;
    worseFactors: string[];
    reliefFactors: string[];
    associatedSymptoms: string[];
    recentTriggers: string[];
  };
  medsSupplements: string;
  allergiesAdverseReactions: string;
  pastHistoryAndTests: string;
  familyHistory: string;
  lifestyleExposure: string;
  pregnancyRelated: string;
};

export type IntakeFinalResult = {
  preVisitBriefing: PreVisitBriefing;
  questionsForDoctor: string[];
  redFlags: string[];
};

const INTAKE_FINAL_PROMPT = `당신은 병원 방문 전 문진을 **구조화**하는 AI입니다.
사용자의 주호소(symptomText)와 체크리스트 응답(Q&A)을 보고 아래 JSON만 출력하세요.

─── 최우선 규칙 (반드시 준수) ───
★ 사용자가 제공하지 않은 사실·증상·기간·원인을 **절대 추가 금지**.
★ 진단·처방·약 추천·검사 지시 **금지**.
★ 불확실하거나 미입력인 필드는 빈 문자열("") 또는 빈 배열([])로 두세요.
★ redFlags는 체크리스트에서 "예"라고 체크된 항목만 그대로 옮기세요. 추론으로 추가 금지.
★ questionsForDoctor는 **1~3개**만 생성하세요. 빈 문자열로 채우지 마세요.
  - "어떤 약이 좋나요?" 같은 직접 약물 추천 유도 질문 금지.
  - 사용자 입력 맥락에 맞는, 의사에게 유용한 질문만 작성.
★ URL/링크 포함 금지.

─── 출력 길이 규칙 (반드시 준수) ───
★ oneLiner: 반드시 1문장, 최대 120자(한글 기준).
★ visitPurpose: 1~2문장, 최대 240자.
★ 각 배열(topConcerns, worseFactors, reliefFactors, associatedSymptoms, recentTriggers): 최대 6개.
★ questionsForDoctor: 최대 3개(부족하면 1~2개만 반환. 빈 문자열 금지).
★ redFlags: 최대 6개.
★ 전체 요약은 A4 반 페이지 이내로 간결하게. 장황한 서술 금지.

─── 응답 형식 (JSON only) ───
{
  "preVisitBriefing": {
    "oneLiner": "한줄 요약",
    "visitPurpose": "방문 목적",
    "topConcerns": ["주요 불편 1","주요 불편 2"],
    "symptomsSummary": {
      "onset": "시작 시점",
      "course": "경과",
      "location": "부위",
      "quality": "성질/느낌",
      "severity0to10": "강도",
      "frequencyDuration": "빈도/지속",
      "worseFactors": ["악화 요인"],
      "reliefFactors": ["완화 요인"],
      "associatedSymptoms": ["동반 증상"],
      "recentTriggers": ["최근 계기"]
    },
    "medsSupplements": "",
    "allergiesAdverseReactions": "",
    "pastHistoryAndTests": "",
    "familyHistory": "",
    "lifestyleExposure": "",
    "pregnancyRelated": ""
  },
  "questionsForDoctor": ["질문1","질문2","질문3"],
  "redFlags": []
}`;

const EMPTY_SYMPTOMS_SUMMARY: PreVisitBriefing["symptomsSummary"] = {
  onset: "",
  course: "",
  location: "",
  quality: "",
  severity0to10: "",
  frequencyDuration: "",
  worseFactors: [],
  reliefFactors: [],
  associatedSymptoms: [],
  recentTriggers: [],
};

const EMPTY_BRIEFING: PreVisitBriefing = {
  oneLiner: "",
  visitPurpose: "",
  topConcerns: [],
  symptomsSummary: EMPTY_SYMPTOMS_SUMMARY,
  medsSupplements: "",
  allergiesAdverseReactions: "",
  pastHistoryAndTests: "",
  familyHistory: "",
  lifestyleExposure: "",
  pregnancyRelated: "",
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
/* ── Post-processing clamp helpers (출력 길이 강제) ───── */

/** 문자열을 maxChars 이내로 자르고, 초과 시 끝에 '…' 추가 */
function clampText(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1) + "…";
}

/** 마침표·물음표·느낌표 기준으로 최대 maxSentences 문장만 유지 */
function clampSentenceCount(s: string, maxSentences: number): string {
  const t = s.trim();
  if (!t) return t;
  const matches = t.match(/[^.?!。]+[.?!。]+/g);
  if (!matches || matches.length <= maxSentences) return t;
  return matches.slice(0, maxSentences).join("").trim();
}

/** 배열을 문자열 요소만 남기고 maxLen 이내로 자름 */
function clampList(arr: unknown, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, maxLen);
}

/**
 * 문진 최종 요약 생성 (preVisitBriefing + questionsForDoctor 3개 + redFlags)
 */
export async function askIntakeFinal(
  input: string,
  qa: { q: string; a: string }[],
): Promise<IntakeFinalResult> {
  try {
    const qaText = qa
      .map((pair, i) => `Q${i + 1}: ${pair.q}\nA${i + 1}: ${pair.a || "(미응답)"}`)
      .join("\n\n");
    const userMessage = `[사용자 입력 원문 — 아래 내용에 명시된 사실만 사용할 것]\n\n주호소: ${input}\n\n체크리스트 응답:\n${qaText}\n\n[지시] 위 입력에 없는 증상·상황·시간대는 절대 추가하지 마세요. 빈값/(미응답) 항목은 빈 문자열/빈 배열로 두세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INTAKE_FINAL_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);

    const rawB =
      parsed.preVisitBriefing && typeof parsed.preVisitBriefing === "object"
        ? parsed.preVisitBriefing
        : {};
    const rawS =
      rawB.symptomsSummary && typeof rawB.symptomsSummary === "object"
        ? rawB.symptomsSummary
        : {};

    const preVisitBriefing: PreVisitBriefing = {
      oneLiner: clampText(clampSentenceCount(safeStr(rawB.oneLiner), 1), 120),
      visitPurpose: clampText(clampSentenceCount(safeStr(rawB.visitPurpose), 2), 240),
      topConcerns: clampList(rawB.topConcerns, 6),
      symptomsSummary: {
        onset: clampText(safeStr(rawS.onset), 240),
        course: clampText(safeStr(rawS.course), 240),
        location: clampText(safeStr(rawS.location), 240),
        quality: clampText(safeStr(rawS.quality), 240),
        severity0to10: safeStr(rawS.severity0to10),
        frequencyDuration: clampText(safeStr(rawS.frequencyDuration), 240),
        worseFactors: clampList(rawS.worseFactors, 6),
        reliefFactors: clampList(rawS.reliefFactors, 6),
        associatedSymptoms: clampList(rawS.associatedSymptoms, 6),
        recentTriggers: clampList(rawS.recentTriggers, 6),
      },
      medsSupplements: clampText(safeStr(rawB.medsSupplements), 240),
      allergiesAdverseReactions: clampText(safeStr(rawB.allergiesAdverseReactions), 240),
      pastHistoryAndTests: clampText(safeStr(rawB.pastHistoryAndTests), 240),
      familyHistory: clampText(safeStr(rawB.familyHistory), 240),
      lifestyleExposure: clampText(safeStr(rawB.lifestyleExposure), 240),
      pregnancyRelated: clampText(safeStr(rawB.pregnancyRelated), 240),
    };

    const questionsForDoctor: string[] = clampList(parsed.questionsForDoctor, 3);
    const redFlags: string[] = clampList(parsed.redFlags, 6);

    return { preVisitBriefing, questionsForDoctor, redFlags };
  } catch {
    return { preVisitBriefing: EMPTY_BRIEFING, questionsForDoctor: [], redFlags: [] };
  }
}
