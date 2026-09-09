"use client";

// 브랜드 태그라인 — 놀이 클러스터에서는 "즐거운 삶"으로 바뀐다 (lib/tagline.ts).
// 머리글·푸터는 루트 레이아웃에 있어 페이지를 모르므로,
//  1) /topic/… 주소는 pathname 으로 바로 안다 (서버 렌더부터 맞는 문구)
//  2) 글 페이지(/guide/…)처럼 주소에 토픽이 없는 곳은 <TopicTagline topic=…/> 로 알려 준다 (마운트 뒤 전환 —
//     두 문구의 길이가 같아 레이아웃은 흔들리지 않는다)
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { topicFromPath } from "@/lib/tagline";

interface TaglineTopic {
  topic: string | null;
  setTopic: (topic: string | null) => void;
}

const Ctx = createContext<TaglineTopic>({ topic: null, setTopic: () => {} });

export function TopicTaglineProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<string | null>(null);
  return <Ctx.Provider value={{ topic, setTopic }}>{children}</Ctx.Provider>;
}

/**
 * 태그라인 한 줄. 문구는 서버가 env 를 반영해 넘긴다 (NEXT_PUBLIC_* 를 동적 키로 읽으면 클라이언트 번들에 안 들어간다).
 * byTopic 에 없는 토픽은 fallback.
 */
export function SiteTagline({ fallback, byTopic, className }: { fallback: string; byTopic: Record<string, string>; className?: string }) {
  const pathname = usePathname();
  const { topic } = useContext(Ctx);
  const slug = topic ?? topicFromPath(pathname);
  const text = (slug && byTopic[slug]) || fallback;
  return <span className={className}>{text}</span>;
}

/** 주소에 토픽이 없는 페이지(글·글쓰기)가 머리글·푸터에 토픽을 알려 준다 */
export function TopicTagline({ topic }: { topic: string | null }) {
  const { setTopic } = useContext(Ctx);
  useEffect(() => {
    setTopic(topic);
    return () => setTopic(null);
  }, [topic, setTopic]);
  return null;
}
