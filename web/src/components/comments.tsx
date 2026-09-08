"use client";

// 댓글 목록 + 작성 폼. 목록은 서버(ISR)에서 온 데이터를 그대로 그리고,
// 작성 가능 여부는 마운트 후 /api/me 로 판단한다 (페이지 HTML 은 로그인과 무관).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, deleteOwnCommentAction, type MemberActionState } from "@/app/member-actions";
import { COMMENT_MAX } from "@/lib/member-limits";
import type { PublicComment } from "@/lib/queries/comments";
import { useCurrentMember } from "./member-menu";

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function CommentSection({ guideId, slug, comments }: { guideId: number; slug: string; comments: PublicComment[] }) {
  const { loading, member } = useCurrentMember();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(addCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.saved) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.saved, router]);

  return (
    <section className="mt-12 border-t border-line pt-8" id="comments">
      <h2 className="text-sm font-bold text-ink">댓글 {comments.length > 0 ? comments.length : ""}</h2>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">아직 댓글이 없습니다. 비슷한 경험이 있다면 남겨 주세요.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-faint">
                <span className="font-semibold text-ink">{c.authorName}</span>
                <span>{formatDateTime(c.createdAt)}</span>
                {member?.id === c.authorId && (
                  <form action={deleteOwnCommentAction} className="ml-auto">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-ink-faint hover:text-accent-deep">
                      삭제
                    </button>
                  </form>
                )}
              </div>
              {/* 평문 — 링크를 활성화하지 않는다 */}
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        {loading ? null : member ? (
          <form ref={formRef} action={formAction} className="space-y-2">
            <input type="hidden" name="guideId" value={guideId} />
            <textarea
              name="body"
              rows={3}
              required
              maxLength={COMMENT_MAX}
              defaultValue={state.saved ? "" : state.values?.body}
              placeholder={`${member.displayName} 님, 비슷한 경험이나 해본 것을 남겨 주세요. 진단·처방 단정과 광고는 숨김 처리됩니다.`}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
            />
            {state.error && <p className="text-sm text-accent-deep">{state.error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-faint">최대 {COMMENT_MAX}자</span>
              <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
                {pending ? "등록 중..." : "댓글 남기기"}
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-soft">
            댓글은 회원만 쓸 수 있습니다.{" "}
            <Link href={`/login?next=${encodeURIComponent(`/guide/${slug}#comments`)}`} className="font-medium text-sea underline">
              로그인
            </Link>{" "}
            또는{" "}
            <Link href={`/signup?next=${encodeURIComponent(`/guide/${slug}#comments`)}`} className="font-medium text-sea underline">
              가입
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
