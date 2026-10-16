"use client";

// 내장 도구 고르기 — tool_key → 화면 (lib/tools.ts BUILTIN_TOOLS 와 짝을 맞춘다)
// 도구 코드는 그 글을 열 때만 받도록 나눠 싣는다.
import dynamic from "next/dynamic";

const CctvSignTool = dynamic(() => import("./cctv-sign/cctv-sign-tool").then((m) => m.CctvSignTool), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-sand/60" aria-busy="true" />,
});

export function BuiltinToolView({ toolKey }: { toolKey: string }) {
  switch (toolKey) {
    case "cctv-sign":
      return <CctvSignTool />;
    default:
      return null;
  }
}
