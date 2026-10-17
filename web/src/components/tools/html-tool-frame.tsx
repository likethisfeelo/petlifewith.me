"use client";

// 관리자가 올린 HTML 도구 — sandbox iframe(allow-same-origin 없음)으로 띄우고 브리지로 높이·저장·인쇄를 대신한다 (lib/tools.ts).
// srcdoc 은 마운트 뒤에 만든다: 방문자 브라우저에 글별로 보관한 값(localStorage)을 iframe 에 넘겨야 하기 때문.
import { useCallback, useEffect, useRef, useState } from "react";
import { submitInfoRequestAction } from "@/app/tool-lead-actions";
import { useCurrentMember } from "@/components/member-menu";
import { track } from "@/components/tracker";
import { MembersOnlyPrompt } from "./members-only-prompt";
import { TOOL_BRIDGE_TAG, TOOL_IFRAME_SANDBOX, buildToolSrcDoc, parseToolMessage } from "@/lib/tools";

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
  // 인쇄·파일 저장은 회원만 — 손님이 누르면 가입 안내 팝업
  const { loading: memberLoading, member } = useCurrentMember();
  const isMember = Boolean(member);
  const memberRef = useRef<boolean | null>(null);
  memberRef.current = memberLoading ? null : isMember;
  const [prompt, setPrompt] = useState<string | null>(null);

  const reply = useCallback((msg: Record<string, unknown>) => {
    ref.current?.contentWindow?.postMessage({ tag: TOOL_BRIDGE_TAG, ...msg }, "*");
  }, []);

  // 로그인 상태를 도구에 알린다 (도구가 "회원 전용" 안내 문구를 바꾸는 데 쓴다)
  useEffect(() => {
    if (!memberLoading) reply({ type: "member", member: isMember });
  }, [memberLoading, isMember, reply, srcDoc]);

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
        case "ready":
          if (memberRef.current !== null) reply({ type: "member", member: memberRef.current });
          break;
        case "print":
          if (!memberRef.current) {
            setPrompt("인쇄");
            break;
          }
          printHtml(m.html);
          track("tool_action", { kind: "print", tool: storageKey });
          break;
        case "download":
          if (!memberRef.current) {
            setPrompt("인쇄용 파일 저장");
            break;
          }
          downloadData(m.filename, m.data);
          track("tool_action", { kind: "download", tool: storageKey });
          break;
        case "info_request":
          void submitInfoRequestAction({ email: m.email, phone: m.phone, topic: m.topic, source: window.location.pathname })
            .then((r) => {
              reply({ type: "info_result", id: m.id, ok: r.ok, error: r.ok ? undefined : r.error });
              if (r.ok) track("request_submit", { request_kind: "info_request", tool: storageKey });
            })
            .catch(() => reply({ type: "info_result", id: m.id, ok: false, error: "보내지 못했습니다. 잠시 후 다시 시도해 주세요." }));
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [storageKey, reply]);

  if (!srcDoc) {
    return <div style={{ height: minHeight }} className="animate-pulse rounded-xl bg-sand/60" aria-busy="true" />;
  }
  return (
    <>
      {prompt && <MembersOnlyPrompt feature={prompt} onClose={() => setPrompt(null)} />}
      <iframe
      ref={ref}
      title={title}
      srcDoc={srcDoc}
      sandbox={TOOL_IFRAME_SANDBOX}
      referrerPolicy="no-referrer"
      // 사이트는 밝은 화면만 쓴다 (어두운 테마는 buildToolSrcDoc 이 꺼 둔다)
      style={{ height, minHeight: 200, colorScheme: "light" }}
      className="block w-full border-0 sm:rounded-xl"
      />
    </>
  );
}
