"use client";

// 첫 로그인 온보딩 — 닉네임 정하기 팝업.
// 가입·첫 로그인(이메일·카카오) 뒤 원래 가려던 페이지로 돌아오면, 그 위에 이 팝업이 뜬다 (lib/identity.ts 가 흐름 쿠키를 남긴다).
// 닉네임을 정해야 회원 세션이 생긴다 — 그 전까지는 로그인되지 않은 상태다. 카카오 닉네임은 입력칸에 미리 채운다.
// 로그인 상태는 /api/me 로만 알아낸다 (페이지 HTML 은 로그인과 무관하게 같다 — ISR 유지).
import { usePathname } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { onboardingCancelAction, onboardingProfileAction, type AuthActionState } from "@/app/auth-actions";
import { inputClass } from "@/app/admin/_components/fields";

interface MeOnboarding {
  onboarding?: { suggested: string } | null;
}

/** 팝업을 띄우지 않는 곳 — 관리자 화면, 같은 일을 하는 전용 페이지 */
function suppressed(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/signup/profile");
}

export function OnboardingModal() {
  const pathname = usePathname() || "/";
  const [suggested, setSuggested] = useState<string | null>(null);

  useEffect(() => {
    if (suppressed(pathname)) return;
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<MeOnboarding>) : {}))
      .then((d: MeOnboarding) => alive && setSuggested(d.onboarding ? d.onboarding.suggested : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (suggested === null || suppressed(pathname)) return null;
  return <OnboardingDialog suggested={suggested} onClose={() => setSuggested(null)} />;
}

function OnboardingDialog({ suggested, onClose }: { suggested: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(onboardingProfileAction, {});
  const [cancelling, startCancel] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // 입력값은 직접 들고 있는다
  const [name, setName] = useState(suggested);
  const [agree, setAgree] = useState(false);

  // 열린 동안 뒤 페이지가 스크롤되지 않게
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 저장되면 회원 세션이 생겼다 — 헤더·댓글 등 로그인 상태를 다시 읽도록 페이지를 새로 연다
  useEffect(() => {
    if (state.saved) window.location.reload();
  }, [state.saved]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-2xl sm:rounded-2xl">
        <p className="text-sm font-medium text-sea">환영합니다 🐾</p>
        <h2 id="onboarding-title" className="mt-1 text-xl font-extrabold tracking-tight text-ink">
          닉네임을 정해 주세요
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          글·댓글·펫모임에 보이는 이름입니다. 실명을 쓸 필요는 없고, 나중에 설정에서 바꿀 수 있습니다.
        </p>

        {/* action 대신 onSubmit — React 가 액션 뒤에 폼을 초기화하지 않게(오류 뒤에도 입력·체크 유지) */}
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="mt-5 space-y-4"
        >
          <div>
            <label htmlFor="onboarding-name" className="block text-sm font-medium text-ink">
              닉네임
            </label>
            <input
              ref={inputRef}
              id="onboarding-name"
              name="displayName"
              required
              minLength={2}
              maxLength={20}
              placeholder="2~20자 (한글·영문·숫자)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            {suggested && name === suggested && <p className="mt-1 text-xs text-ink-faint">카카오 닉네임을 넣어 두었습니다. 그대로 써도, 바꿔도 됩니다.</p>}
          </div>

          <div className="rounded-lg border border-line bg-sand px-4 py-3 text-xs leading-relaxed text-ink-soft">
            회원 글은 운영진 확인 후 공개되고, 댓글은 바로 보입니다. 진단·처방 단정이나 병원·상품 광고는 승인되지 않습니다. 다른 사람의 연락처·주소는 올리지 마세요.
          </div>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="agree" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            위 안내를 확인했습니다.
          </label>

          {state.error && <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={pending || state.saved}
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream hover:opacity-90 disabled:opacity-50"
            >
              {pending || state.saved ? "저장 중..." : "시작하기"}
            </button>
            <button
              type="button"
              disabled={pending || cancelling}
              onClick={() =>
                startCancel(async () => {
                  await onboardingCancelAction();
                  onClose();
                })
              }
              className="w-full rounded-full px-5 py-2 text-xs text-ink-faint hover:text-ink"
            >
              다음에 할게요 (닉네임을 정해야 로그인이 완료됩니다)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
