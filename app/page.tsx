"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

import type {
  ChecklistSection,
  ChecklistItem,
} from "@/lib/previsit-checklist";
import { checkDailyLimit, increaseUsage, resetUsage } from "@/lib/usage-limit";

type ClaimItem = { text: string; cites: string[] };
type SourceItem = {
  id: string;
  citeAlias: string;
  name: string;
  tier: string;
  kind: string;
  lang: string;
  visibleByDefault: boolean;
  url: string;
};

type AppMode = "intake" | "info";
type IntakeStage = "input" | "followup" | "final";

type PreVisitBriefing = {
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

/** 관리자 비밀번호: env 우선, fallback "int358" (개발용) */
const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || "int358";

const MAX_DEFAULT = 3;
const MAX_EXPANDED = 15;

export default function Home() {
  /* ── 공통 상태 ── */
  const [mode, setMode] = useState<AppMode>("intake");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showEn, setShowEn] = useState(false);

  /* ── info 모드 상태 (기존) ── */
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [claims, setClaims] = useState<ClaimItem[]>([]);

  /* ── intake 모드 상태 ── */
  const [intakeStage, setIntakeStage] = useState<IntakeStage>("input");
  const [symptom, setSymptom] = useState("");
  const [checklist, setChecklist] = useState<ChecklistSection[]>([]);
  const [checkVals, setCheckVals] = useState<Record<string, string>>({});
  const [briefing, setBriefing] = useState<PreVisitBriefing | null>(null);
  const [questionsForDoctor, setQuestionsForDoctor] = useState<string[]>([]);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [showOriginalQA, setShowOriginalQA] = useState(false);
  const [symptomExpanded, setSymptomExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [remainingCount, setRemainingCount] = useState<number>(30);

  /* ── 관리자 리셋 상태 ── */
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminMsg, setAdminMsg] = useState("");

  /* ── 관리자: 전역 쿼터 조회 상태 ── */
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [globalQuota, setGlobalQuota] = useState<{
    cap: number; count: number; remaining: number; dateKey: string;
  } | null>(null);

  /* ── 페이지 로드 시 남은 횟수 조회 ── */
  useEffect(() => {
    const limit = checkDailyLimit();
    setRemainingCount(limit.remaining);
  }, []);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ── 모드 전환 시 초기화 ── */
  function switchMode(next: AppMode) {
    setMode(next);
    resetAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAll() {
    setLoading(false);
    setError("");
    setSources([]);
    setExpanded({});
    setShowEn(false);
    // info
    setQuestion("");
    setAnswer("");
    setClaims([]);
    // intake
    setIntakeStage("input");
    setSymptom("");
    setChecklist([]);
    setCheckVals({});
    setBriefing(null);
    setQuestionsForDoctor([]);
    setRedFlags([]);
    setShowOriginalQA(false);
    setSymptomExpanded(false);
    setCollapsedSections({});
    setCopyStatus("idle");
  }

  /* ── info 모드: 기존 질문 제출 ── */
  async function handleInfoSubmit() {
    if (!question.trim()) return;

    const limit = checkDailyLimit();
    if (!limit.allowed) {
      alert("오늘 사용 가능 횟수(30회)를 모두 사용했습니다. 내일 다시 이용해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setClaims([]);
    setSources([]);
    setExpanded({});
    setShowEn(false);

    try {
      const res = await fetch("/api/health-links/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "요청 처리 중 오류가 발생했습니다.");
        return;
      }
      increaseUsage();
      const updated = checkDailyLimit();
      setRemainingCount(updated.remaining);
      setAnswer(data.answer || "");
      setClaims(Array.isArray(data.claims) ? data.claims : []);
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /* ── intake: 1단계 → followup(체크리스트) 받기 ── */
  async function handleIntakeStart() {
    if (!symptom.trim()) return;

    const limit = checkDailyLimit();
    if (!limit.allowed) {
      alert("오늘 사용 가능 횟수(30회)를 모두 사용했습니다. 내일 다시 이용해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/health-links/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "intake",
          stage: "followup",
          input: symptom.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "요청 처리 중 오류가 발생했습니다.");
        return;
      }
      const cl: ChecklistSection[] = Array.isArray(data.checklist) ? data.checklist : [];
      setChecklist(cl);
      setCheckVals({});
      setSources(Array.isArray(data.sources) ? data.sources : []);
      // optional 섹션은 기본 접힘
      const collapsed: Record<string, boolean> = {};
      cl.forEach((sec) => { if (sec.optional) collapsed[sec.id] = true; });
      setCollapsedSections(collapsed);
      setIntakeStage("followup");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /** 체크리스트 값 업데이트 헬퍼 */
  function setVal(itemId: string, value: string) {
    setCheckVals((prev) => ({ ...prev, [itemId]: value }));
  }

  /** multi 체크박스 토글 헬퍼 */
  function toggleMulti(itemId: string, opt: string) {
    setCheckVals((prev) => {
      const cur = prev[itemId] ?? "";
      const arr = cur ? cur.split("||") : [];
      const idx = arr.indexOf(opt);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(opt);
      return { ...prev, [itemId]: arr.join("||") };
    });
  }

  /** 체크리스트 입력값을 qa 배열로 직렬화 */
  function buildChecklistQA(): { q: string; a: string }[] {
    const result: { q: string; a: string }[] = [];
    for (const sec of checklist) {
      for (const item of sec.items) {
        const v = (checkVals[item.id] ?? "").trim();
        if (!v) continue;
        result.push({ q: `${sec.title}:${item.label}`, a: v });
      }
    }
    return result;
  }

  /* ── intake: 2단계 → 최종 요약 받기 ── */
  async function handleIntakeFinal() {
    const limit = checkDailyLimit();
    if (!limit.allowed) {
      alert("오늘 사용 가능 횟수(30회)를 모두 사용했습니다. 내일 다시 이용해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const qa = buildChecklistQA();

    try {
      const res = await fetch("/api/health-links/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "intake",
          stage: "final",
          input: symptom.trim(),
          qa,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "요청 처리 중 오류가 발생했습니다.");
        return;
      }
      increaseUsage();
      const updated = checkDailyLimit();
      setRemainingCount(updated.remaining);
      setBriefing(data.preVisitBriefing ?? null);
      setQuestionsForDoctor(
        Array.isArray(data.questionsForDoctor) ? data.questionsForDoctor : [],
      );
      setRedFlags(Array.isArray(data.redFlags) ? data.redFlags : []);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setIntakeStage("final");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /* ── sources 분류 (기존 로직 그대로) ── */
  const sourceByCite = new Map<string, SourceItem[]>();
  sources.forEach((s) => {
    const key = s.citeAlias ?? s.id;
    const list = sourceByCite.get(key) ?? [];
    list.push(s);
    sourceByCite.set(key, list);
  });

  const koDirectSrc = sources.filter(
    (s) => s.lang === "ko" && s.kind === "direct",
  );
  const koSearchSrc = sources.filter(
    (s) => s.lang === "ko" && s.kind === "search",
  );
  const enDirectSrc = sources.filter(
    (s) => s.lang === "en" && s.kind === "direct",
  );
  const enSearchSrc = sources.filter(
    (s) => s.lang === "en" && s.kind === "search",
  );
  const hasEnSrc = enDirectSrc.length > 0 || enSearchSrc.length > 0;

  /** 링크 목록 렌더: 기본 3개 + 더보기(최대 15) */
  function renderLinkList(
    items: SourceItem[],
    sectionKey: string,
    linkColor: string,
    linkLabel: string,
  ) {
    if (items.length === 0) return null;
    const isOpen = expanded[sectionKey] ?? false;
    const visible = isOpen
      ? items.slice(0, MAX_EXPANDED)
      : items.slice(0, MAX_DEFAULT);
    const hasMore = items.length > MAX_DEFAULT;

    return (
      <>
        {visible.map((s) => (
          <div key={s.id} style={{ marginBottom: 4 }}>
            <strong>{s.name}</strong>
            {" · "}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: linkColor, wordBreak: "break-all" }}
            >
              {linkLabel}
            </a>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => toggle(sectionKey)}
            style={{
              marginTop: 4,
              background: "none",
              border: "none",
              color: linkColor,
              cursor: "pointer",
              fontSize: 13,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {isOpen
              ? "접기"
              : `더보기 (+${Math.min(items.length, MAX_EXPANDED) - MAX_DEFAULT}개)`}
          </button>
        )}
      </>
    );
  }

  /** 참고자료(sources) 섹션 — 양 모드에서 재사용 */
  function renderSourcesSection() {
    if (sources.length === 0) return null;
    return (
      <>
        {/* 참고자료 라벨 */}
        <h2 style={{ marginTop: 28 }}>참고자료 (공식/검색)</h2>

        {koDirectSrc.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                padding: 16,
                backgroundColor: "#f0f7ff",
                borderRadius: 8,
                lineHeight: 1.8,
              }}
            >
              <div
                style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}
              >
                공식 참고자료 (한국어)
              </div>
              {renderLinkList(koDirectSrc, "src-ko-d", "#0070f3", "바로가기")}
            </div>
          </div>
        )}

        {koSearchSrc.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                padding: 16,
                backgroundColor: "#f9f9f9",
                borderRadius: 8,
                lineHeight: 1.8,
              }}
            >
              <div
                style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}
              >
                검색 참고자료 (한국어)
              </div>
              {renderLinkList(
                koSearchSrc,
                "src-ko-s",
                "#5a9bd5",
                "검색결과 보기",
              )}
            </div>
          </div>
        )}

        {hasEnSrc && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setShowEn((v) => !v)}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                borderRadius: 8,
                backgroundColor: "#eee",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              {showEn ? "영문 참고자료 접기 ▲" : "추가(영문) 참고자료 보기 ▼"}
            </button>

            {showEn && (
              <div style={{ marginTop: 12 }}>
                {enDirectSrc.length > 0 && (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: "#f0f7ff",
                      borderRadius: 8,
                      lineHeight: 1.8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 6,
                      }}
                    >
                      공식 참고자료 (영문)
                    </div>
                    {renderLinkList(
                      enDirectSrc,
                      "src-en-d",
                      "#0070f3",
                      "바로가기",
                    )}
                  </div>
                )}

                {enSearchSrc.length > 0 && (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: "#f9f9f9",
                      borderRadius: 8,
                      lineHeight: 1.8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 6,
                      }}
                    >
                      검색 참고자료 (영문)
                    </div>
                    {renderLinkList(
                      enSearchSrc,
                      "src-en-s",
                      "#5a9bd5",
                      "검색결과 보기",
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  /** 체크리스트 아이템 렌더러 */
  function renderChecklistItem(item: ChecklistItem) {
    const val = checkVals[item.id] ?? "";
    return (
      <div key={item.id}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 14, lineHeight: 1.5 }}>
          {item.label}
          {item.optional && <span style={{ fontWeight: 400, color: "#999", marginLeft: 4 }}>(선택)</span>}
        </label>
        {item.help && <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{item.help}</div>}

        {item.type === "text" && (
          item.label.length > 30 ? (
            <textarea
              rows={2}
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
              value={val}
              onChange={(e) => setVal(item.id, e.target.value)}
            />
          ) : (
            <input
              type="text"
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 8, border: "1px solid #ddd" }}
              value={val}
              onChange={(e) => setVal(item.id, e.target.value)}
            />
          )
        )}

        {item.type === "yesno" && (
          <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
            {["예", "아니오", "모름"].map((opt) => (
              <label key={opt} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 14 }}>
                <input type="radio" name={`yn_${item.id}`} checked={val === opt} onChange={() => setVal(item.id, opt)} />
                {opt}
              </label>
            ))}
          </div>
        )}

        {item.type === "scale" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 13, color: "#888" }}>0</span>
            <input
              type="range" min={0} max={10}
              value={val ? Number(val) : 5}
              onChange={(e) => setVal(item.id, e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, color: "#888" }}>10</span>
            <span style={{ fontWeight: 600, fontSize: 16, minWidth: 28, textAlign: "center" }}>{val || "5"}</span>
          </div>
        )}

        {item.type === "multi" && item.options && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
            {item.options.map((opt) => {
              const selected = val ? val.split("||").includes(opt) : false;
              return (
                <label key={opt} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14 }}>
                  <input type="checkbox" checked={selected} onChange={() => toggleMulti(item.id, opt)} />
                  {opt}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /** 클립보드 복사 (fallback 포함) */
  async function copyToClipboard(text: string): Promise<boolean> {
    // 1차: Clipboard API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* 권한 거부 또는 비보안 컨텍스트 → fallback */
      }
    }
    // 2차: execCommand fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  /** 복사용 plain text 빌드 (빈 값 제외, 줄바꿈 포함) */
  function buildCopyText(): string {
    if (!briefing) return "";
    const lines: string[] = [];
    lines.push("[의사에게 전달할 요약]");
    if (briefing.oneLiner) lines.push(`한줄 요약: ${briefing.oneLiner}`);
    if (briefing.visitPurpose) lines.push(`방문 목적: ${briefing.visitPurpose}`);
    if (briefing.topConcerns.length > 0)
      lines.push(`주요 불편: ${briefing.topConcerns.join(", ")}`);

    const s = briefing.symptomsSummary;
    if (s.onset) lines.push(`시작 시점: ${s.onset}`);
    if (s.course) lines.push(`경과: ${s.course}`);
    if (s.location) lines.push(`부위: ${s.location}`);
    if (s.quality) lines.push(`성질/느낌: ${s.quality}`);
    if (s.severity0to10) lines.push(`강도(0~10): ${s.severity0to10}`);
    if (s.frequencyDuration) lines.push(`빈도/지속: ${s.frequencyDuration}`);
    if (s.worseFactors.length > 0)
      lines.push(`악화 요인: ${s.worseFactors.join(", ")}`);
    if (s.reliefFactors.length > 0)
      lines.push(`완화 요인: ${s.reliefFactors.join(", ")}`);
    if (s.associatedSymptoms.length > 0) {
      lines.push("동반 증상:");
      s.associatedSymptoms.forEach((v) => lines.push(`- ${v}`));
    }
    if (s.recentTriggers.length > 0)
      lines.push(`최근 계기: ${s.recentTriggers.join(", ")}`);

    if (briefing.medsSupplements)
      lines.push(`복용 약/보충제: ${briefing.medsSupplements}`);
    if (briefing.allergiesAdverseReactions)
      lines.push(`알레르기/이상반응: ${briefing.allergiesAdverseReactions}`);
    if (briefing.pastHistoryAndTests)
      lines.push(`과거 병력/검사: ${briefing.pastHistoryAndTests}`);
    if (briefing.familyHistory)
      lines.push(`가족력: ${briefing.familyHistory}`);
    if (briefing.lifestyleExposure)
      lines.push(`생활습관/노출: ${briefing.lifestyleExposure}`);
    if (briefing.pregnancyRelated)
      lines.push(`임신 관련: ${briefing.pregnancyRelated}`);

    if (redFlags.length > 0) {
      lines.push("");
      lines.push("위험 신호 체크:");
      redFlags.forEach((r) => lines.push(`- ${r}`));
    }

    return lines.join("\n");
  }

  /** 관리자 비밀번호 확인 */
  function handleAdminAuth() {
    if (adminPw === ADMIN_PASS) {
      setAdminAuthed(true);
      setAdminMsg("");
    } else {
      setAdminAuthed(false);
      setAdminMsg("비밀번호가 올바르지 않습니다.");
    }
  }

  /** 관리자 로컬 사용 횟수 리셋 핸들러 */
  function handleAdminReset() {
    const result = resetUsage();
    setRemainingCount(result.remaining);
    setAdminMsg("사용 횟수가 30회로 초기화되었습니다.");
  }

  /** 관리자 전역 쿼터 조회 핸들러 */
  async function handleGlobalQuota() {
    if (!adminPw) {
      setAdminMsg("비밀번호를 입력해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/admin/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPw }),
      });
      if (res.status === 401) {
        setAdminAuthed(false);
        setGlobalQuota(null);
        setAdminMsg("비밀번호가 올바르지 않습니다.");
        return;
      }
      if (!res.ok) {
        setAdminAuthed(false);
        setGlobalQuota(null);
        setAdminMsg("조회 불가 (서버 오류)");
        return;
      }
      const data = await res.json();
      setAdminAuthed(true);
      setGlobalQuota(data);
      setAdminMsg("조회 완료");
    } catch {
      setAdminAuthed(false);
      setGlobalQuota(null);
      setAdminMsg("네트워크 오류로 조회할 수 없습니다.");
    }
  }

  /** 복사 버튼 클릭 핸들러 */
  async function handleCopy() {
    const text = buildCopyText();
    const ok = await copyToClipboard(text);
    setCopyStatus(ok ? "success" : "error");
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

  /** briefing 행 렌더 (빈값이면 렌더하지 않음) */
  function renderBriefingRow(label: string, value: string) {
    if (!value) return null;
    return (
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: "#4a5568", marginRight: 8 }}>{label}:</span>
        <span style={{ color: "#333" }}>{value}</span>
      </div>
    );
  }

  /** 증상 입력 요약 sticky 카드 (followup/final 공통) */
  function renderSymptomCard() {
    if (!symptom.trim()) return null;
    return (
      <div
        style={{
          marginTop: 8,
          marginBottom: 16,
          padding: "12px 16px",
          backgroundColor: "#f0f4ff",
          borderRadius: 8,
          border: "1px solid #d0d9f0",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: "#4a5568", marginBottom: 4 }}>
          내가 입력한 증상
        </div>
        {symptomExpanded ? (
          <>
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 14,
                lineHeight: 1.6,
                color: "#333",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {symptom}
            </div>
            <button
              onClick={() => setSymptomExpanded(false)}
              style={{
                marginTop: 4,
                background: "none",
                border: "none",
                color: "#5a7bd5",
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
              }}
            >
              접기 ▲
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                maxHeight: "3.2em",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                fontSize: 14,
                lineHeight: 1.6,
                color: "#333",
              }}
            >
              {symptom}
            </div>
            <button
              onClick={() => setSymptomExpanded(true)}
              style={{
                marginTop: 4,
                background: "none",
                border: "none",
                color: "#5a7bd5",
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
              }}
            >
              전체 보기 ▼
            </button>
          </>
        )}
      </div>
    );
  }

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      {/* ── 상단 로고 + 타이틀 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Image
          src="/logo-health-ai.png"
          alt="인트의 건강AI 로고"
          width={90}
          height={90}
          style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1a202c" }}>
            인트의 건강AI
          </div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
            진료 전에 필요한 정보를 정리하고 의사에게 전달할 수 있도록 도와드립니다.
          </div>
        </div>
      </div>

      {/* 상단 고정 안내 (Safety) */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          backgroundColor: "#fff8e1",
          borderRadius: 8,
          fontSize: 14,
          color: "#795548",
          lineHeight: 1.6,
        }}
      >
        <div>의료 진단/처방이 아닌 정보 안내입니다.</div>
        <div>응급/위험 증상 시 119 또는 의료기관에 연락하세요.</div>
      </div>

      {/* 사용 횟수 안내 */}
      <div style={{
        fontSize: 13,
        color: "#4f6ef7",
        marginBottom: 4,
        marginTop: 8,
        fontWeight: 600,
      }}>
        오늘 남은 사용 횟수: {remainingCount}회
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
        ※ 하루 최대 30회까지 이용 가능합니다.
      </div>

      {/* 모드 토글 — 탭 스타일 카드 버튼 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => switchMode("intake")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            borderRadius: 10,
            fontWeight: 600,
            border: mode === "intake" ? "none" : "1px solid #d0d7e2",
            backgroundColor: mode === "intake" ? "#4f6ef7" : "#ffffff",
            color: mode === "intake" ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          ① 상담 준비(의사에게 전달)
        </button>
        <button
          onClick={() => switchMode("info")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            borderRadius: 10,
            fontWeight: 600,
            border: mode === "info" ? "none" : "1px solid #d0d7e2",
            backgroundColor: mode === "info" ? "#4f6ef7" : "#ffffff",
            color: mode === "info" ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          ② 정보/링크 참고(미완성, 개발 진행중)
        </button>
        <Link
          href="/hospital-finder"
          style={{
            padding: "10px 18px",
            fontSize: 14,
            borderRadius: 10,
            fontWeight: 600,
            border: "1px solid #d0d7e2",
            backgroundColor: "#ffffff",
            color: "#333",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          ③ 병원, 약국 찾기(공식 검색)
        </Link>
      </div>

      {/* ──────────────────────────────────────────────
           INFO 모드 (기존 동작 그대로)
           ────────────────────────────────────────────── */}
      {mode === "info" && (
        <>
          <div
            style={{
              marginTop: 16,
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <textarea
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                fontSize: 16,
                borderRadius: 8,
                border: "1px solid #d0d7e2",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              placeholder="예: 당뇨병 초기 증상은 무엇인가요?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleInfoSubmit();
                }
              }}
            />
            <button
              style={{
                marginTop: 12,
                padding: "10px 24px",
                fontSize: 16,
                borderRadius: 8,
                backgroundColor: loading ? "#ccc" : "#4f6ef7",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
              onClick={handleInfoSubmit}
              disabled={loading}
            >
              {loading ? "답변 생성 중..." : "질문하기"}
            </button>
          </div>

          {/* 답변 */}
          {answer && (
            <div style={{ marginTop: 24 }}>
              <h2>답변</h2>
              <div
                style={{
                  marginTop: 8,
                  padding: 16,
                  backgroundColor: "#f8f9fa",
                  borderRadius: 8,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {answer}
              </div>
            </div>
          )}

          {/* 핵심 근거 (claims) */}
          {claims.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2>핵심 근거 (항목별)</h2>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {claims.map((claim, i) => {
                  const citeSources = claim.cites.flatMap(
                    (citeId) => sourceByCite.get(citeId) ?? [],
                  );
                  const langSort = (a: SourceItem, b: SourceItem) =>
                    a.lang === b.lang ? 0 : a.lang === "ko" ? -1 : 1;
                  const directAll = citeSources
                    .filter((s) => s.kind === "direct")
                    .sort(langSort);
                  const searchAll = citeSources
                    .filter((s) => s.kind === "search")
                    .sort(langSort);

                  const dKey = `c${i}d`;
                  const sKey = `c${i}s`;
                  const dOpen = expanded[dKey] ?? false;
                  const sOpen = expanded[sKey] ?? false;
                  const dVis = dOpen
                    ? directAll.slice(0, MAX_EXPANDED)
                    : directAll.slice(0, MAX_DEFAULT);
                  const sVis = sOpen
                    ? searchAll.slice(0, MAX_EXPANDED)
                    : searchAll.slice(0, MAX_DEFAULT);

                  return (
                    <div
                      key={i}
                      style={{
                        padding: 14,
                        backgroundColor: "#f0f7ff",
                        borderRadius: 8,
                        borderLeft: "4px solid #0070f3",
                      }}
                    >
                      <div style={{ lineHeight: 1.6 }}>{claim.text}</div>

                      {dVis.length > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 14,
                            color: "#555",
                          }}
                        >
                          참고(공식):{" "}
                          {dVis.map((s, j) => (
                            <span key={s.id}>
                              {j > 0 && " | "}
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#0070f3" }}
                              >
                                {s.name} 바로가기
                              </a>
                            </span>
                          ))}
                          {directAll.length > MAX_DEFAULT && (
                            <>
                              {" "}
                              <button
                                onClick={() => toggle(dKey)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#0070f3",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  padding: 0,
                                  textDecoration: "underline",
                                }}
                              >
                                {dOpen ? "접기" : "더보기"}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {sVis.length > 0 && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: "#888",
                          }}
                        >
                          검색(참고):{" "}
                          {sVis.map((s, j) => (
                            <span key={s.id}>
                              {j > 0 && " | "}
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#5a9bd5" }}
                              >
                                {s.name} 검색결과
                              </a>
                            </span>
                          ))}
                          {searchAll.length > MAX_DEFAULT && (
                            <>
                              {" "}
                              <button
                                onClick={() => toggle(sKey)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#5a9bd5",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  padding: 0,
                                  textDecoration: "underline",
                                }}
                              >
                                {sOpen ? "접기" : "더보기"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* sources */}
          {renderSourcesSection()}
        </>
      )}

      {/* ──────────────────────────────────────────────
           INTAKE 모드 (문진 2턴)
           ────────────────────────────────────────────── */}
      {mode === "intake" && (
        <>
          {/* ---- input 단계 ---- */}
          {intakeStage === "input" && (
            <div
              style={{
                marginTop: 16,
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>증상을 알려주세요</h2>
              <textarea
                rows={4}
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 16,
                  borderRadius: 8,
                  border: "1px solid #d0d7e2",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                placeholder="예: 3일 전부터 머리 오른쪽이 욱신거려요"
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleIntakeStart();
                  }
                }}
              />
              <button
                style={{
                  marginTop: 12,
                  padding: "10px 24px",
                  fontSize: 16,
                  borderRadius: 8,
                  backgroundColor: loading ? "#ccc" : "#4f6ef7",
                  color: "#fff",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
                onClick={handleIntakeStart}
                disabled={loading}
              >
                {loading ? "질문 생성 중..." : "다음"}
              </button>
            </div>
          )}

          {/* ---- followup 단계 (체크리스트 렌더러) ---- */}
          {intakeStage === "followup" && (
            <div style={{ marginTop: 20 }}>
              <h2>진료 전 사전 브리핑 체크리스트</h2>
              {renderSymptomCard()}
              <p style={{ color: "#555", fontSize: 14 }}>
                아래 항목을 체크/기입해 주세요. 모르는 항목은 비워도 됩니다.
              </p>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
                {checklist.map((sec) => {
                  const isCollapsed = !!collapsedSections[sec.id];
                  return (
                    <div key={sec.id} style={{ borderRadius: 8, border: "1px solid #e0e0e0", overflow: "hidden" }}>
                      {/* 섹션 헤더 */}
                      <button
                        onClick={() => setCollapsedSections((p) => ({ ...p, [sec.id]: !p[sec.id] }))}
                        style={{
                          width: "100%", textAlign: "left", padding: "10px 14px",
                          backgroundColor: sec.optional ? "#f9f9f9" : "#f0f4ff",
                          border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <span>{sec.title}{sec.optional ? " (선택)" : ""}</span>
                        <span style={{ fontSize: 12 }}>{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
                      </button>
                      {/* 섹션 바디 */}
                      {!isCollapsed && (
                        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                          {sec.items.map((item) => renderChecklistItem(item))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                style={{
                  marginTop: 16, padding: "10px 24px", fontSize: 16, borderRadius: 8,
                  backgroundColor: loading ? "#ccc" : "#0070f3", color: "#fff",
                  border: "none", cursor: loading ? "not-allowed" : "pointer",
                }}
                onClick={handleIntakeFinal}
                disabled={loading}
              >
                {loading ? "요약 생성 중..." : "완료"}
              </button>
            </div>
          )}

          {/* ---- final 단계 ---- */}
          {intakeStage === "final" && (
            <div style={{ marginTop: 20 }}>
              {renderSymptomCard()}

              {/* ── 의사에게 전달할 요약 ── */}
              {briefing && (
                <div
                  style={{
                    marginTop: 16,
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>의사에게 전달할 요약</h2>
                    <button
                      onClick={handleCopy}
                      style={{
                        padding: "4px 12px",
                        fontSize: 13,
                        borderRadius: 6,
                        border: "1px solid #4f6ef7",
                        backgroundColor: copyStatus === "success" ? "#e8f5e9" : "#f0f4ff",
                        color: copyStatus === "success" ? "#2e7d32" : "#4f6ef7",
                        cursor: "pointer",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copyStatus === "success" ? "✓ 복사됨" : "복사"}
                    </button>
                    {copyStatus === "error" && (
                      <span style={{ fontSize: 12, color: "#c53030" }}>
                        복사에 실패했어요. 길게 눌러 선택 후 복사해 주세요.
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    복사해서 휴대폰 메모장 등에 저장한 다음 의사에게 보여주면 편리합니다.
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "#e8f5e9", borderRadius: 6, fontSize: 13, color: "#2e7d32", lineHeight: 1.5 }}>
                    ※ 아래 요약은 사용자 입력을 구조화한 것이며, 입력에 없는 내용은 포함하지 않습니다. (사용자 입력 기반, 추론 없음)
                  </div>
                  <div style={{ marginTop: 12, padding: 16, backgroundColor: "#f8f9fb", borderRadius: 8, lineHeight: 1.8, maxHeight: 520, overflowY: "auto" }}>
                    {/* 한줄 요약 */}
                    {briefing.oneLiner && (
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: "#1a202c" }}>
                        {briefing.oneLiner}
                      </div>
                    )}
                    {renderBriefingRow("방문 목적", briefing.visitPurpose)}
                    {briefing.topConcerns.length > 0 && renderBriefingRow("주요 불편", briefing.topConcerns.join(", "))}
                    {/* 증상 상세 */}
                    {renderBriefingRow("시작 시점", briefing.symptomsSummary.onset)}
                    {renderBriefingRow("경과", briefing.symptomsSummary.course)}
                    {renderBriefingRow("부위", briefing.symptomsSummary.location)}
                    {renderBriefingRow("성질/느낌", briefing.symptomsSummary.quality)}
                    {renderBriefingRow("강도(0~10)", briefing.symptomsSummary.severity0to10)}
                    {renderBriefingRow("빈도/지속", briefing.symptomsSummary.frequencyDuration)}
                    {briefing.symptomsSummary.worseFactors.length > 0 && renderBriefingRow("악화 요인", briefing.symptomsSummary.worseFactors.join(", "))}
                    {briefing.symptomsSummary.reliefFactors.length > 0 && renderBriefingRow("완화 요인", briefing.symptomsSummary.reliefFactors.join(", "))}
                    {briefing.symptomsSummary.associatedSymptoms.length > 0 && renderBriefingRow("동반 증상", briefing.symptomsSummary.associatedSymptoms.join(", "))}
                    {briefing.symptomsSummary.recentTriggers.length > 0 && renderBriefingRow("최근 계기", briefing.symptomsSummary.recentTriggers.join(", "))}
                    {renderBriefingRow("복용 약/보충제", briefing.medsSupplements)}
                    {renderBriefingRow("알레르기/이상반응", briefing.allergiesAdverseReactions)}
                    {renderBriefingRow("과거 병력/검사", briefing.pastHistoryAndTests)}
                    {renderBriefingRow("가족력", briefing.familyHistory)}
                    {renderBriefingRow("생활습관/노출", briefing.lifestyleExposure)}
                    {renderBriefingRow("임신 관련", briefing.pregnancyRelated)}
                  </div>
                </div>
              )}

              {/* 원문 QA 접기/펼치기 */}
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => setShowOriginalQA((v) => !v)}
                  style={{ padding: "6px 14px", fontSize: 13, borderRadius: 6, backgroundColor: "#f5f5f5", border: "1px solid #ddd", cursor: "pointer", color: "#555" }}
                >
                  {showOriginalQA ? "내가 입력한 내용(원문) 접기 ▲" : "내가 입력한 내용(원문) 보기 ▼"}
                </button>
                {showOriginalQA && (
                  <div style={{ marginTop: 8, padding: 14, backgroundColor: "#fafbfc", borderRadius: 8, border: "1px solid #eee", fontSize: 14, lineHeight: 1.7 }}>
                    <div style={{ marginBottom: 8, fontWeight: 600, color: "#333" }}>주호소:</div>
                    <div style={{ marginBottom: 12, color: "#555" }}>{symptom}</div>
                    {buildChecklistQA().map((pair, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, color: "#333" }}>Q{i + 1}: {pair.q}</div>
                        <div style={{ color: "#555", marginTop: 2 }}>A{i + 1}: {pair.a || "(미응답)"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 의사 상담 질문 리스트 (3개) */}
              {questionsForDoctor.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h2>의사에게 물어볼 질문</h2>
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
                    {questionsForDoctor.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 레드플래그 + 응급안내 */}
              {redFlags.length > 0 && (
                <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fff0f0", borderRadius: 8, borderLeft: "4px solid #e53e3e" }}>
                  <h3 style={{ margin: 0, color: "#c53030" }}>위험 신호 체크</h3>
                  <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8, color: "#c53030" }}>
                    {redFlags.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10, fontSize: 13, color: "#c53030", fontWeight: 600 }}>
                    위 증상이 있으면 즉시 119에 전화하거나 가까운 응급실을 방문하세요.
                  </div>
                </div>
              )}

              {/* 안전문구 (서버 상수) */}
              <div style={{ marginTop: 16, padding: 12, backgroundColor: "#fff8e1", borderRadius: 8, fontSize: 13, color: "#795548", lineHeight: 1.6 }}>
                본 정보는 의료 진단/처방이 아닌 참고용 안내입니다. 응급/위험 증상 시 119 또는 의료기관에 즉시 연락하세요.
              </div>

            </div>
          )}

          {/* sources — intake 모드에서도 재사용 */}
          {renderSourcesSection()}
        </>
      )}

      {/* 에러 (모드 공통) */}
      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            backgroundColor: "#fee",
            borderRadius: 8,
            color: "#c00",
          }}
        >
          {error}
        </div>
      )}

      {/* 하단 신뢰 안내 */}
      <div
        style={{
          fontSize: 12,
          color: "#888",
          textAlign: "center",
          marginTop: 30,
        }}
      >
        ※ 본 서비스는 진단·처방이 아닌 진료 준비용 정보 정리 도구입니다.
      </div>

      {/* ── 관리자 영역 (비밀번호 인증 후에만 기능 노출) ── */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button
          onClick={() => {
            if (adminOpen) {
              setAdminAuthed(false);
              setAdminPw("");
              setGlobalQuota(null);
            }
            setAdminOpen((v) => !v);
            setAdminMsg("");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#999",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {adminOpen ? "관리자 ▲" : "관리자"}
        </button>

        {adminOpen && (
          <div
            style={{
              marginTop: 8,
              padding: 14,
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              backgroundColor: "#fafafa",
              textAlign: "left",
              maxWidth: 320,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {!adminAuthed ? (
              /* ── 비밀번호 입력 단계 ── */
              <>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
                  관리자 비밀번호
                </label>
                <input
                  type="password"
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdminAuth();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: 6,
                    fontSize: 13,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleAdminAuth}
                  style={{
                    marginTop: 8,
                    padding: "5px 14px",
                    fontSize: 13,
                    borderRadius: 6,
                    backgroundColor: "#555",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  확인
                </button>
                {adminMsg && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#c00" }}>
                    {adminMsg}
                  </div>
                )}
              </>
            ) : (
              /* ── 인증 완료: 관리 기능 ── */
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={handleAdminReset}
                    style={{
                      padding: "5px 14px",
                      fontSize: 13,
                      borderRadius: 6,
                      backgroundColor: "#555",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    로컬 사용 횟수 리셋
                  </button>
                  <button
                    onClick={handleGlobalQuota}
                    style={{
                      padding: "5px 14px",
                      fontSize: 13,
                      borderRadius: 6,
                      backgroundColor: "#4f6ef7",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    전역 남은 횟수 보기
                  </button>
                </div>
                {adminMsg && (
                  <div style={{ marginTop: 6, fontSize: 12, color: adminMsg.includes("초기화") || adminMsg.includes("조회 완료") ? "#2e7d32" : "#c00" }}>
                    {adminMsg}
                  </div>
                )}
                {globalQuota && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      backgroundColor: "#f0f4ff",
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: "#333",
                    }}
                  >
                    <div>전역 사용량(오늘): {globalQuota.count} / {globalQuota.cap}</div>
                    <div>전역 남은 횟수: {globalQuota.remaining}</div>
                    <div style={{ color: "#888", fontSize: 12 }}>기준일: {globalQuota.dateKey}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
