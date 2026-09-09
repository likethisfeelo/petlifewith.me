"use client";

// 모임 게시판 글쓰기 — 참여 회원만. 평문, 시간당 20건.
import { useActionState } from "react";
import { addMeetupPostAction, type MeetupActionState } from "@/app/meetup-actions";
import { MEETUP_LIMITS } from "@/lib/meetups";

export function MeetupPostForm({ meetupId }: { meetupId: number }) {
  const [state, formAction, pending] = useActionState<MeetupActionState, FormData>(addMeetupPostAction, {});
  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-line bg-surface p-3">
      <input type="hidden" name="meetupId" value={meetupId} />
      <textarea
        name="body"
        rows={3}
        required
        minLength={2}
        maxLength={MEETUP_LIMITS.post}
        defaultValue={state.values?.body}
        placeholder="약속·후기·질문을 남겨 주세요. 참여 회원에게만 보입니다."
        className="w-full rounded-lg border border-line bg-cream/60 px-3 py-2 text-sm outline-none focus:border-ink"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream disabled:opacity-50">
          {pending ? "올리는 중..." : "글 올리기"}
        </button>
        {state.error && <span className="text-xs font-medium text-accent-deep">{state.error}</span>}
      </div>
    </form>
  );
}
