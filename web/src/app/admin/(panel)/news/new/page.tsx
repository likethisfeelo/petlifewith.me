import { getMemberMediaSettings } from "@/lib/queries/settings";
import { uploadPolicyFor } from "@/lib/settings";
import { AdminPageHeader } from "../../../_components/fields";
import { NewsEditor } from "../[id]/news-editor";

export default async function AdminNewsNewPage() {
  return (
    <div>
      <AdminPageHeader title="뉴스 쓰기" description="발행하면 /news 목록 맨 위에 올라갑니다." />
      <div className="mt-5">
        <NewsEditor
          mode="create"
          policy={uploadPolicyFor("admin", await getMemberMediaSettings())}
          post={{ title: "", category: "news", status: "draft", summary: null, bodyMd: null, heroImageKey: null, toolKey: null, toolHtml: null, toolHeight: null }}
        />
      </div>
    </div>
  );
}
