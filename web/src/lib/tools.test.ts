import { describe, expect, it } from "vitest";
import { TOOL_BRIDGE_TAG, TOOL_IFRAME_SANDBOX, buildToolSrcDoc, parseToolMessage, safeFilename, toolBridgeScript } from "./tools";
import { parseSignData } from "./tools/sign-data";
import { CCTV_CHECKLIST_HTML } from "./tools/cctv-checklist-html";

describe("HTML 도구 브리지", () => {
  it("sandbox 에 allow-same-origin 을 주지 않는다", () => {
    expect(TOOL_IFRAME_SANDBOX).toContain("allow-scripts");
    expect(TOOL_IFRAME_SANDBOX).not.toContain("allow-same-origin");
  });

  it("<head> 바로 뒤에 브리지를 넣는다", () => {
    const out = buildToolSrcDoc('<!doctype html><html><head><meta charset="utf-8"></head><body>x</body></html>');
    expect(out.indexOf("<script>")).toBeGreaterThan(out.indexOf("<head>"));
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("<meta"));
  });

  it("어두운 모드 조건은 절대 맞지 않게 바꾼다 (CSS·matchMedia 모두)", () => {
    const out = buildToolSrcDoc('<style>@media (prefers-color-scheme: dark){:root{--bg:#000}}</style><script>matchMedia("(prefers-color-scheme:dark)")</script>');
    expect(out).not.toMatch(/\(prefers-color-scheme:\s*dark\)(?! and \(max-width: 0px\))/);
    expect(out.match(/and \(max-width: 0px\)/g)).toHaveLength(2);
  });

  it("head 가 없으면 맨 앞에 넣는다", () => {
    expect(buildToolSrcDoc("<p>hi</p>").startsWith("<script>")).toBe(true);
  });

  it("보관값에 </script> 가 있어도 스크립트를 깨지 않는다", () => {
    const s = toolBridgeScript({ k: "</script><script>alert(1)</script>" });
    expect(s.match(/<\/script>/g)).toHaveLength(1);
  });

  it("메시지 모양을 검사한다", () => {
    expect(parseToolMessage({ type: "height", height: 1200 })).toBeNull(); // 표시 없음
    expect(parseToolMessage({ tag: TOOL_BRIDGE_TAG, type: "height", height: 1e9 })).toEqual({ type: "height", height: 20000 });
    expect(parseToolMessage({ tag: TOOL_BRIDGE_TAG, type: "storage", data: { a: "1", b: 2 } })).toEqual({ type: "storage", data: { a: "1" } });
    expect(parseToolMessage({ tag: TOOL_BRIDGE_TAG, type: "download", filename: "../../a/b.html", data: "x" })).toEqual({ type: "download", filename: "....ab.html", data: "x" });
    expect(parseToolMessage({ tag: TOOL_BRIDGE_TAG, type: "eval", code: "x" })).toBeNull();
  });

  it("파일 이름에서 경로·제어 문자를 지운다", () => {
    expect(safeFilename('a/b\\c:"d".html')).toBe("abcd.html");
    expect(safeFilename("   ")).toBe("download");
  });

  it("CCTV 점검표는 claude 전용 API·외부 안내판 링크를 쓰지 않는다", () => {
    expect(CCTV_CHECKLIST_HTML).not.toContain("window.claude");
    expect(CCTV_CHECKLIST_HTML).not.toContain("claude.ai");
    expect(CCTV_CHECKLIST_HTML).toContain("'/news/cctv-sign'");
    expect(CCTV_CHECKLIST_HTML).toContain("window.petlife");
  });
});

describe("CCTV 안내판 저장 데이터", () => {
  const base = { tpl: "clean", orient: "land", fields: { name: "○○펫", tel: "02-123-4567" }, logo: null };

  it("모르는 키는 버리고 빈 칸을 채운다", () => {
    const d = parseSignData({ ...base, fields: { ...base.fields, hack: "x" } });
    expect(d?.fields.name).toBe("○○펫");
    expect(d?.fields.purpose).toBe("");
    expect(d?.fields).not.toHaveProperty("hack");
  });

  it("템플릿·방향·로고 형식이 틀리면 거부한다", () => {
    expect(parseSignData({ ...base, tpl: "neon" })).toBeNull();
    expect(parseSignData({ ...base, orient: "up" })).toBeNull();
    expect(parseSignData({ ...base, logo: "https://evil.example/logo.png" })).toBeNull();
    expect(parseSignData({ ...base, logo: "data:image/svg+xml;base64,PHN2Zz4=" })).toBeNull();
    expect(parseSignData({ ...base, logo: "data:image/png;base64,iVBORw0KGgo=" })?.logo).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("너무 긴 칸은 거부한다", () => {
    expect(parseSignData({ ...base, fields: { name: "가".repeat(121) } })).toBeNull();
  });
});
