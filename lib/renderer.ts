// lib/renderer.ts

export type LinkItem = {
    label: string;
    url: string;
  };
  
  export function renderLinks(items: LinkItem[]): string {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No links to render");
    }
  
    // 고정 포맷: 줄바꿈 + 라벨 | URL
    // 설명/요약/권고 문장 절대 없음
    return items
      .map((item) => {
        if (!item.label || !item.url) {
          throw new Error("Invalid link item");
        }
        return `${item.label} | ${item.url}`;
      })
      .join("\n");
  }
  