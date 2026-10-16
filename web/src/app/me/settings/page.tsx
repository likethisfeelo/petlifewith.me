// 설정 — 닉네임 · 비밀번호 · 2단계 인증 · 탈퇴 (계정은 Cognito, lib/cognito.ts)
import { hasTotp } from "@/lib/cognito";
import { cognitoConfig } from "@/lib/config";
import { getCurrentMember } from "@/lib/member";
import { PasswordForm, ProfileForm } from "../profile-forms";
import { DeleteAccountForm, TotpForm } from "../security-forms";

export default async function MeSettingsPage() {
  const member = (await getCurrentMember())!;
  const cognito = Boolean(cognitoConfig());
  // 이메일로 가입한 계정만 비밀번호·인증 앱이 있다 (카카오 계정은 이메일을 받지 않는다)
  const emailAccount = Boolean(member.email);
  const totp = cognito && member.email ? await hasTotp(member.email) : false;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">닉네임</h2>
        <p className="mt-1 text-xs text-ink-faint">글·댓글·모임에 공개되는 이름입니다.</p>
        <div className="mt-3">
          <ProfileForm displayName={member.displayName} />
        </div>
      </section>
      {emailAccount ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">비밀번호</h2>
          <div className="mt-3">
            <PasswordForm />
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">로그인 방식</h2>
          <p className="mt-2 text-sm text-ink-soft">카카오 계정으로 로그인합니다. 비밀번호·2단계 인증은 카카오 계정 설정을 따릅니다.</p>
        </section>
      )}
      {emailAccount && cognito && (
        <section className="rounded-xl border border-line bg-surface p-4 sm:col-span-2">
          <h2 className="text-sm font-bold text-ink">2단계 인증 (인증 앱)</h2>
          <div className="mt-3 max-w-sm">
            <TotpForm enabled={totp} />
          </div>
        </section>
      )}
      <section className="rounded-xl border border-line bg-surface p-4 sm:col-span-2">
        <h2 className="text-sm font-bold text-ink">계정</h2>
        <p className="mt-1 text-xs text-ink-soft">{member.email ? `이메일 ${member.email}` : "카카오 계정"} · 이메일 변경은 문의해 주세요.</p>
        <div className="mt-3 max-w-sm">
          <DeleteAccountForm needsPassword={emailAccount} />
        </div>
      </section>
    </div>
  );
}
