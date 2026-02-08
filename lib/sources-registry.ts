// lib/sources-registry.ts

export type SourceTier = "official" | "reference";
export type SourceKind = "direct" | "search";
export type SourceLang = "ko" | "en";

/** AI 프롬프트에서 사용하는 출처 ID (하위 호환) */
export type CiteId =
  | "kdca"
  | "who"
  | "cdc"
  | "pubmed"
  | "medlineplus"
  | "mfds"
  | "e-gen"
  | "nice";

/** 소스 레지스트리 내부 ID */
export type SourceId =
  | "kdca_direct"
  | "kdca_search"
  | "mfds_search"
  | "egen_search"
  | "who_search"
  | "cdc_search"
  | "pubmed_direct"
  | "medlineplus_search";

export type SourceItem = {
  id: SourceId;
  /** AI cite에서 참조되는 별칭 (claim.cites 매칭용) */
  citeAlias: CiteId;
  name: string;
  tier: SourceTier;
  kind: SourceKind;
  lang: SourceLang;
  visibleByDefault: boolean;
  url: string;
};

/** 고정 순서 레지스트리: ko/direct → ko/search → en/direct → en/search */
const REGISTRY: readonly {
  id: SourceId;
  citeAlias: CiteId;
  name: string;
  tier: SourceTier;
  kind: SourceKind;
  lang: SourceLang;
  visibleByDefault: boolean;
  buildUrl: (q: string) => string;
}[] = [
  // ── 한국어 direct (기본 노출) ──
  {
    id: "kdca_direct",
    citeAlias: "kdca",
    name: "질병관리청 건강정보포털",
    tier: "official",
    kind: "direct",
    lang: "ko",
    visibleByDefault: true,
    buildUrl: () =>
      "https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoMain.do",
  },
  // ── 한국어 search (기본 노출) ──
  {
    id: "kdca_search",
    citeAlias: "kdca",
    name: "질병관리청 (검색)",
    tier: "official",
    kind: "search",
    lang: "ko",
    visibleByDefault: true,
    buildUrl: (q) =>
      `https://www.google.com/search?q=site%3Akdca.go.kr+${q}`,
  },
  {
    id: "mfds_search",
    citeAlias: "mfds",
    name: "식품의약품안전처 (검색)",
    tier: "official",
    kind: "search",
    lang: "ko",
    visibleByDefault: true,
    buildUrl: (q) =>
      `https://www.google.com/search?q=site%3Amfds.go.kr+${q}`,
  },
  {
    id: "egen_search",
    citeAlias: "e-gen",
    name: "응급의료포털 (검색)",
    tier: "official",
    kind: "search",
    lang: "ko",
    visibleByDefault: true,
    buildUrl: (q) =>
      `https://www.google.com/search?q=site%3Ae-gen.or.kr+${q}`,
  },
  // ── 해외 direct (기본 숨김) ──
  {
    id: "pubmed_direct",
    citeAlias: "pubmed",
    name: "PubMed",
    tier: "reference",
    kind: "direct",
    lang: "en",
    visibleByDefault: false,
    buildUrl: (q) => `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`,
  },
  // ── 해외 search (기본 숨김) ──
  {
    id: "who_search",
    citeAlias: "who",
    name: "WHO (검색)",
    tier: "official",
    kind: "search",
    lang: "en",
    visibleByDefault: false,
    buildUrl: (q) =>
      `https://www.google.com/search?q=site%3Awho.int+${q}`,
  },
  {
    id: "cdc_search",
    citeAlias: "cdc",
    name: "CDC (검색)",
    tier: "reference",
    kind: "search",
    lang: "en",
    visibleByDefault: false,
    buildUrl: (q) =>
      `https://www.google.com/search?q=site%3Acdc.gov+${q}`,
  },
  {
    id: "medlineplus_search",
    citeAlias: "medlineplus",
    name: "MedlinePlus (검색)",
    tier: "reference",
    kind: "search",
    lang: "en",
    visibleByDefault: false,
    buildUrl: (q) =>
      `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?query=${q}&v%3Aproject=medlineplus&v%3Asources=medlineplus-bundle`,
  },
];

function toItem(r: (typeof REGISTRY)[number], q: string): SourceItem {
  return {
    id: r.id,
    citeAlias: r.citeAlias,
    name: r.name,
    tier: r.tier,
    kind: r.kind,
    lang: r.lang,
    visibleByDefault: r.visibleByDefault,
    url: r.buildUrl(q),
  };
}

/** 정렬 우선순위: ko/direct → ko/search → en/direct → en/search */
function sortKey(s: SourceItem): number {
  const langOrder = s.lang === "ko" ? 0 : 1;
  const kindOrder = s.kind === "direct" ? 0 : 1;
  return langOrder * 2 + kindOrder;
}

/**
 * 질문 문자열을 기반으로 소스 링크 배열을 생성합니다.
 * - citeIds가 없으면: visibleByDefault=true인 소스만 반환
 * - citeIds가 있으면: citeAlias 매칭 소스 + visibleByDefault=true 소스 (중복 제거)
 * 반환 순서: ko/direct → ko/search → en/direct → en/search
 * 주의: encodeURIComponent는 여기서 1회만 적용.
 */
export function buildSources(
  question: string,
  citeIds?: CiteId[],
): SourceItem[] {
  const q = encodeURIComponent(question.trim().replace(/\s+/g, " "));

  let items: SourceItem[];

  if (!citeIds || citeIds.length === 0) {
    items = REGISTRY.filter((r) => r.visibleByDefault).map((r) =>
      toItem(r, q),
    );
  } else {
    const idSet = new Set(citeIds);
    const seen = new Set<SourceId>();
    items = [];

    for (const r of REGISTRY) {
      if (idSet.has(r.citeAlias) || r.visibleByDefault) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          items.push(toItem(r, q));
        }
      }
    }
  }

  items.sort((a, b) => sortKey(a) - sortKey(b));
  return items;
}
