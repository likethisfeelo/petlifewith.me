"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** 몇 초 뒤 메인으로 — 남은 시간을 보여 준다 */
export function SignedOutRedirect({ seconds }: { seconds: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) {
      router.replace("/");
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, router]);
  return <>{left > 0 ? `${left}초 뒤 메인으로 이동합니다.` : "메인으로 이동합니다."}</>;
}
