import { AdminPageHeader } from "../../../_components/fields";
import { CurationEditor } from "../[id]/curation-editor";

export default function AdminCurationNewPage() {
  return (
    <div>
      <AdminPageHeader title="큐레이션 등록" description="테마 단위로 묶고, 각 항목에 창작자와 원본 링크를 표기합니다." />
      <div className="mt-5">
        <CurationEditor mode="create" curation={{ title: "", introMd: null, status: "draft" }} entries={[]} />
      </div>
    </div>
  );
}
