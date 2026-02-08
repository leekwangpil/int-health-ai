"use client";

import Link from "next/link";

/** 고정 외부 링크 (딥링크/파라미터 미사용 — 공식 메인 페이지로만 이동) */
const HIRA_URL = "https://www.hira.or.kr/ra/hosp/getHealthMap.do";
const EGEN_EMERGENCY_URL = "https://www.e-gen.or.kr/";
const EGEN_GENERAL_URL =
  "https://www.e-gen.or.kr/egen/search_hospital.do?searchType=general";
const PHARM114_URL = "https://www.pharm114.or.kr/";

export default function HospitalFinderPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 40 }}>
      {/* 뒤로가기 */}
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginBottom: 16,
          fontSize: 14,
          color: "#0070f3",
          textDecoration: "none",
        }}
      >
        ← 메인으로 돌아가기
      </Link>

      <h1>병원·약국 찾기 (공식 검색)</h1>
      <p style={{ color: "#666", marginTop: 4 }}>
        이 기능은 병원을 추천하지 않고, 공식 사이트로 이동합니다.
      </p>

      {/* 상단 안내 — 항상 표시 */}
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
        <div>
          <strong>응급 상황</strong>(흉통 · 호흡곤란 · 의식저하 · 편측마비 ·
          심한 출혈 등)은{" "}
          <strong style={{ color: "#d32f2f" }}>119 / 응급실</strong>로 즉시
          연락하세요.
        </div>
        <div style={{ marginTop: 4 }}>
          진단 · 처방 목적이 아닌 <strong>안내용</strong>입니다.
        </div>
      </div>

      {/* 안내 메시지 */}
      <p
        style={{
          marginTop: 20,
          fontSize: 14,
          color: "#555",
          lineHeight: 1.6,
        }}
      >
        아래 버튼을 누르면 공식 사이트가 새 탭으로 열립니다.
        <br />
        검색은 각 공식 사이트에서 직접 수행해 주세요.
      </p>

      {/* 공식 검색 이동 버튼 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* HIRA 병원·약국 찾기 */}
        <a
          href={HIRA_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 10,
            border: "none",
            backgroundColor: "#0070f3",
            color: "#fff",
            textDecoration: "none",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          병원 · 약국 찾기 (HIRA 공식)
        </a>

        {/* E-GEN 병원 찾기(일반) */}
        <a
          href={EGEN_GENERAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 10,
            border: "2px solid #0070f3",
            backgroundColor: "#fff",
            color: "#0070f3",
            textDecoration: "none",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          병원 찾기 (E-GEN 공식)
        </a>

        {/* E-GEN 응급실/당번 찾기 */}
        <a
          href={EGEN_EMERGENCY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 10,
            border: "2px solid #d32f2f",
            backgroundColor: "#fff",
            color: "#d32f2f",
            textDecoration: "none",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          응급실 / 당번 찾기 (E-GEN 공식)
        </a>

        {/* 휴일지킴이약국 */}
        <a
          href={PHARM114_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 10,
            border: "2px solid #43a047",
            backgroundColor: "#fff",
            color: "#2e7d32",
            textDecoration: "none",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          약국 찾기 (휴일지킴이약국)
        </a>
      </div>

      {/* 하단 참고 */}
      <div
        style={{
          marginTop: 32,
          padding: 12,
          backgroundColor: "#f0f4ff",
          borderRadius: 8,
          fontSize: 13,
          color: "#555",
          lineHeight: 1.7,
        }}
      >
        <div>
          <strong>병원·약국 찾기 (HIRA 공식)</strong>: 건강보험심사평가원 — 전국
          병원·약국 공식 검색
        </div>
        <div>
          <strong>병원 찾기 (E-GEN 공식)</strong>: 중앙응급의료센터 — 응급/당번
          포함 의료기관 검색
        </div>
        <div>
          <strong>응급실/당번 찾기 (E-GEN 공식)</strong>: 중앙응급의료센터 —
          실시간 응급실·당번 병원 현황
        </div>
        <div>
          <strong>약국 찾기 (휴일지킴이약국)</strong>: 대한약사회 — 운영 중 약국
          확인
        </div>
      </div>
    </main>
  );
}
