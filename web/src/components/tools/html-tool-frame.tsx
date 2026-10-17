"use client";

// 관리자가 올린 HTML 도구 — sandbox iframe(allow-same-origin 없음)으로 띄우고 브리지로 높이·저장·인쇄를 대신한다 (lib/tools.ts).
// srcdoc 은 마운트 뒤에 만든다: 방문자 브라우저에 글별로 보관한 값(localStorage)을 iframe 에 넘겨야 하기 때문.
import { useEffect, useRef, useState } from "react";
import { track } from "@/components/tracker";
import { TOOL_IFRAME_SANDBOX, buildToolSrcDoc, parseToolMessage } from "@/lib/tools";

const STORE_PREFIX = "pl-tool:";

function readStore(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStore(key: string, data: Record<string, string>) {
  try {
    window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(data));
  } catch {
    // 사파리 개인 정보 보호 모드 등 — 저장 못 해도 도구는 동작한다
  }
}

/** 인쇄 — 보이지 않는 iframe 에 문서를 넣고 그 창을 인쇄한다(팝업 차단과 무관).
 *  allow-scripts 가 없어 넘겨받은 HTML 의 스크립트는 사이트 출처에서 돌지 않는다(인쇄 문서는 HTML·CSS 만 있으면 된다) */
export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    if (!w) return;
    // 웹폰트·이미지가 그려진 뒤
    window.setTimeout(() => {
      w.focus();
      w.print();
      window.setTimeout(() => frame.remove(), 60_000);
    }, 400);
  };
  document.body.appendChild(frame);
}

/** 파일 저장 — data: 주소면 그대로, 아니면 HTML 텍스트로 */
export function downloadData(filename: string, data: string | Blob) {
  const isDataUrl = typeof data === "string" && data.startsWith("data:");
  const href = isDataUrl ? (data as string) : URL.createObjectURL(typeof data === "string" ? new Blob([data], { type: "text/html;charset=utf-8" }) : data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (!isDataUrl) window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function HtmlToolFrame({ html, title, storageKey, minHeight }: { html: string; title: string; storageKey: string; minHeight: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    setSrcDoc(buildToolSrcDoc(html, readStore(storageKey)));
  }, [html, storageKey]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      // 이 iframe 이 보낸 것만 — 출처는 불투명("null")이라 창 객체로 확인한다
      if (!ref.current || ev.source !== ref.current.contentWindow) return;
      const m = parseToolMessage(ev.data);
      if (!m) return;
      switch (m.type) {
        case "height":
          setHeight(m.height);
          break;
        case "scroll": {
          const top = ref.current.getBoundingClientRect().top + window.scrollY + m.y - 72; // 고정 헤더만큼
          window.scrollTo({ top, behavior: "smooth" });
          break;
        }
        case "storage":
          writeStore(storageKey, m.data);
          break;
        case "print":
          printHtml(m.html);
          track("tool_action", { kind: "print", tool: storageKey });
          break;
        case "download":
          downloadData(m.filename, m.data);
          track("tool_action", { kind: "download", tool: storageKey });
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [storageKey]);

  if (!srcDoc) {
    return <div style={{ height: minHeight }} className="animate-pulse rounded-xl bg-sand/60" aria-busy="true" />;
  }
  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={srcDoc}
      sandbox={TOOL_IFRAME_SANDBOX}
      referrerPolicy="no-referrer"
      // 사이트는 밝은 화면만 쓴다 — iframe 의 color-scheme 이 안쪽 문서의 prefers-color-scheme 이 되므로,
      // 방문자 기기가 어두운 모드여도 도구의 어두운 테마(검은 바탕·흰 글자)가 켜지지 않는다
      style={{ height, minHeight: 200, colorScheme: "light" }}
      className="block w-full border-0 sm:rounded-xl"
    />
  );
}
