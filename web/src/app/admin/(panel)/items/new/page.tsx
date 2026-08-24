import { asc } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { ItemEditor } from "../[id]/item-editor";

const { makers } = schema;

export default async function AdminItemNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const makerRows = await getDb().select({ id: makers.id, name: makers.name }).from(makers).orderBy(asc(makers.name));

  return (
    <div>
      <AdminPageHeader
        title="상품 등록"
        description="글에 태깅해 쓸 상품입니다. 쿠팡 파트너스 링크를 넣으면 노출 페이지에 수수료 고지가 자동으로 붙습니다."
      />
      <div className="mt-5">
        <ItemEditor
          mode="create"
          item={{ name: "", category: "toy", makerId: "", summary: null, descriptionMd: null }}
          makers={makerRows.map((m) => ({ id: m.id, label: m.name }))}
          offers={[]}
        />
      </div>
    </div>
  );
}
