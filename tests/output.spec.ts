import { describe, it, expect } from "vitest";
import { validateLinks } from "../lib/validator";
import { renderLinks } from "../lib/renderer";

describe("인트의 건강AI output rules", () => {
  it("허용된 링크만 통과한다", () => {
    const urls = ["https://health.kdca.go.kr/healthinfo"];

    expect(() => validateLinks(urls)).not.toThrow();

    const output = renderLinks([
      { label: "국가건강정보포털", url: urls[0] },
    ]);

    expect(output).toBe(
      "국가건강정보포털 | https://health.kdca.go.kr/healthinfo"
    );
  });

  it("허용되지 않은 도메인은 실패한다", () => {
    expect(() =>
      validateLinks(["https://google.com"])
    ).toThrow();
  });
});
