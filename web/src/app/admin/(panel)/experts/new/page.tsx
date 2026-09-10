import { listRegionOptions } from "@/lib/queries/requests";
import { AdminPageHeader } from "../../../_components/fields";
import { ExpertEditor, type ExpertFormValues } from "../[id]/expert-editor";

const EMPTY: ExpertFormValues = { kind: "trainer", displayName: "", introMd: null, credentialsText: null, credentialsVerifiedAt: null, topics: [], modes: ["video"], priceText: null, heroImageKey: null, userEmail: "", contact: null, status: "draft", sortOrder: 0, regionIds: [] };

export default async function AdminExpertNewPage() {
  const regions = await listRegionOptions();
  return (
    <div>
      <AdminPageHeader title="상담 파트너 등록" description="회원은 내 페이지에서 직접 만듭니다(멘토 즉시 공개, 훈련사는 여기서 자격 확인 뒤 공개). 운영자가 대신 만들 때만 이 화면을 씁니다." />
      <div className="mt-5">
        <ExpertEditor mode="create" expert={EMPTY} slots={[]} regions={regions} />
      </div>
    </div>
  );
}
