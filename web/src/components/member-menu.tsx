"use client";

// 헤더의 회원 메뉴 — 마운트 후 /api/me 로 로그인 상태를 알아낸다.
// (서버에서 쿠키를 읽으면 모든 페이지가 동적 렌더가 되어 ISR 이 깨진다)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { memberLogoutAction } from "@/app/member-actions";

export interface MeResponse {
  member: { id: string; displayName: string } | null;
}

export function useCurrentMember(): { loading: boolean; member: MeResponse["member"] } {
  const [state, setState] = useState<{ loading: boolean; member: MeResponse["member"] }>({ loading: true, member: null });
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : { member: null }))
      .then((d) => alive && setState({ loading: false, member: d.member }))
      .catch(() => alive && setState({ loading: false, member: null }));
    return () => {
      alive = false;
    };
  }, [pathname]);
  return state;
}

export function MemberMenu() {
  const { loading, member } = useCurrentMember();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || "/");
  if (loading) return <span className="inline-block w-16" aria-hidden />;
  if (!member) {
    return (
      <Link href={`/login?next=${next}`} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink">
        로그인
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      <Link href="/write" className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-cream hover:opacity-90">
        글쓰기
      </Link>
      <Link href="/me" className="max-w-[8rem] truncate rounded-full px-3 py-1.5 text-ink-soft hover:bg-sand hover:text-ink" title={member.displayName}>
        {member.displayName}
      </Link>
      <form action={memberLogoutAction}>
        <button type="submit" className="rounded-full px-2 py-1.5 text-xs text-ink-faint hover:text-ink">
          로그아웃
        </button>
      </form>
    </div>
  );
}
