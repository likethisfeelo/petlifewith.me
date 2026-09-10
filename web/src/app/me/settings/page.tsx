// 설정 — 닉네임·비밀번호
import { getCurrentMember } from "@/lib/member";
import { PasswordForm, ProfileForm } from "../profile-forms";

export default async function MeSettingsPage() {
  const member = (await getCurrentMember())!;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">닉네임</h2>
        <p className="mt-1 text-xs text-ink-faint">글·댓글·모임에 공개되는 이름입니다.</p>
        <div className="mt-3">
          <ProfileForm displayName={member.displayName} />
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">비밀번호</h2>
        <div className="mt-3">
          <PasswordForm />
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4 sm:col-span-2">
        <h2 className="text-sm font-bold text-ink">계정</h2>
        <p className="mt-1 text-xs text-ink-soft">이메일 {member.email}. 이메일 변경·탈퇴는 아직 화면에서 할 수 없습니다 — 문의해 주세요.</p>
      </section>
    </div>
  );
}
