"use client";

// 뉴스레터 구독 큰 배너 + 그 아래 회원가입 안내 — 도구 결과 아래에 붙인다.
// 구독은 요청함(뉴스레터 구독)에 저장되고 슬랙으로 알린다 (app/tool-lead-actions.ts). 발송은 운영자가 한다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { submitNewsletterAction } from "@/app/tool-lead-actions";
import { useCurrentMember } from "@/components/member-menu";
import { track } from "@/components/tracker";

export function NewsletterCta({
  title,
  description,
  topic,
  signupTitle = "회원가입하면 다양한 분석을 받아볼 수 있어요",
  signupDescription,
}: {
  title: string;
  description: string;
  /** 어디서·무엇에 관심을 두고 구독했는지 (요청함·슬랙에 남는다) */
  topic: string;
  signupTitle?: string;
  signupDescription?: string;
}) {
  const pathname = usePathname() || "/";
  const { loading, member } = useCurrentMember();
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const next = encodeURIComponent(pathname);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const r = await submitNewsletterAction({ email, agree, topic, source: pathname });
        if (!r.ok) return setError(r.error);
        setDone(true);
        track("request_submit", { request_kind: "newsletter" });
      } catch {
        setError("보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="newsletter-cta-title" className="overflow-hidden rounded-2xl bg-ink px-5 py-7 text-cream sm:px-8 sm:py-9">
        <p className="text-xs font-semibold tracking-wide text-cream/60">펫라이프위드미 뉴스레터</p>
        <h2 id="newsletter-cta-title" className="mt-2 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/75 sm:text-[15px]">{description}</p>

        {done ? (
          <p className="mt-6 rounded-xl bg-cream/10 px-4 py-3 text-sm font-medium" role="status">
            구독 신청이 접수됐어요. 새 분석이 나오면 {email} 로 보내 드릴게요.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                이메일
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                maxLength={60}
                autoComplete="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 rounded-full border-0 bg-cream px-5 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-accent-deep disabled:opacity-60"
              >
                {pending ? "보내는 중..." : "무료 구독하기"}
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-cream/75">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required className="mt-0.5" />
              <span>
                [필수] 개인정보 수집·이용 동의 — 수집 항목: 이메일 / 목적: 뉴스레터·분석 자료 발송 / 보유 기간: 구독 해지 요청 시까지. 동의하지 않으면 구독할 수 없습니다.
              </span>
            </label>
            {error && (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-deep" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </section>

      {!loading && !member && (
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h3 className="text-base font-bold text-ink">{signupTitle}</h3>
            {signupDescription && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{signupDescription}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={`/signup?next=${next}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:opacity-90">
              무료 회원가입
            </Link>
            <Link href={`/login?next=${next}`} className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:bg-sand">
              로그인
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
