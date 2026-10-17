"use client";

// 내장 도구 고르기 — tool_key → 화면 (lib/tools.ts BUILTIN_TOOLS 와 짝을 맞춘다)
// 도구 코드는 그 글을 열 때만 받도록 나눠 싣는다.
import dynamic from "next/dynamic";
import type { PetsegwonStats } from "@/lib/petsegwon/stats";

const CctvSignTool = dynamic(() => import("./cctv-sign/cctv-sign-tool").then((m) => m.CctvSignTool), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-sand/60" aria-busy="true" />,
});

const PetsegwonTool = dynamic(() => import("./petsegwon/petsegwon-tool").then((m) => m.PetsegwonTool), {
  ssr: false,
  loading: () => <div className="h-[640px] animate-pulse rounded-2xl bg-sand/60" aria-busy="true" />,
});

/** petsegwonStats: 펫세권 분석 글에서만 서버가 넘긴다 (lib/queries/settings.ts getPetsegwonStats) */
export function BuiltinToolView({ toolKey, petsegwonStats }: { toolKey: string; petsegwonStats?: PetsegwonStats }) {
  switch (toolKey) {
    case "cctv-sign":
      return <CctvSignTool />;
    case "petsegwon":
      return petsegwonStats ? <PetsegwonTool stats={petsegwonStats} /> : null;
    default:
      return null;
  }
}
