import { getMemberMediaSettings } from "@/lib/queries/settings";
import { AdminPageHeader } from "../../_components/fields";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const current = await getMemberMediaSettings();
  return (
    <div>
      <AdminPageHeader
        title="설정"
        description="회원 미디어 업로드 한도(글당 개수·용량·영상 길이)와 회원 글 승인 대기. 저장하면 바로 적용됩니다 — 이미 올라간 글은 그대로 둡니다."
      />
      <div className="mt-5">
        <SettingsForm current={current} />
      </div>
    </div>
  );
}
