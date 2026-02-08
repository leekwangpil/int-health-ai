// lib/validator.ts

const ALLOWED_DOMAINS = [
    "kdca.go.kr",
    "health.kdca.go.kr",
    "nip.kdca.go.kr",
    "mfds.go.kr",
    "nedrug.mfds.go.kr",
    "e-gen.or.kr",
    "ncmh.go.kr",
    "kfsp.or.kr",
    "129.go.kr",
    "who.int",
    "cdc.gov",
    "medlineplus.gov",
    "pubmed.ncbi.nlm.nih.gov",
    "pmc.ncbi.nlm.nih.gov",
    "cochranelibrary.com",
    "nice.org.uk",
    "vsearch.nlm.nih.gov",
    "google.com",
  ];
  
  function isValidLink(raw: string): boolean {
    try {
      const url = new URL(raw);

      if (url.protocol !== "https:") return false;

      const hostname = url.hostname.replace(/^www\./, "");
      const allowed = ALLOWED_DOMAINS.some(
        (domain) =>
          hostname === domain || hostname.endsWith(`.${domain}`)
      );
      if (!allowed) return false;

      const blockedParams = ["utm_source", "utm_medium", "utm_campaign"];
      for (const p of blockedParams) {
        if (url.searchParams.has(p)) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /** 기존 API: 하나라도 실패하면 throw */
  export function validateLinks(urls: string[]): void {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error("URL list is empty or invalid");
    }
  
    for (const raw of urls) {
      let url: URL;
  
      try {
        url = new URL(raw);
      } catch {
        throw new Error(`Invalid URL format: ${raw}`);
      }
  
      if (url.protocol !== "https:") {
        throw new Error(`Non-HTTPS URL blocked: ${raw}`);
      }
  
      const hostname = url.hostname.replace(/^www\./, "");
      const allowed = ALLOWED_DOMAINS.some(
        (domain) =>
          hostname === domain || hostname.endsWith(`.${domain}`)
      );
  
      if (!allowed) {
        throw new Error(`Domain not allowed: ${hostname}`);
      }
  
      const blockedParams = ["utm_source", "utm_medium", "utm_campaign"];
      for (const p of blockedParams) {
        if (url.searchParams.has(p)) {
          throw new Error(`Tracking parameter blocked: ${raw}`);
        }
      }
    }
  }

  /** AI 응답용: 유효한 URL만 필터링하여 반환 (throw하지 않음) */
  export function filterValidLinks(urls: string[]): string[] {
    if (!Array.isArray(urls)) return [];
    return urls.filter(isValidLink);
  }
  