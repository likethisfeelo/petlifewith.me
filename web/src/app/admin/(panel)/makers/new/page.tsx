import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { MakerEditor } from "../[id]/maker-editor";

const { regions } = schema;

export default async function AdminMakerNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const regionRows = await getDb().select().from(regions).orderBy(regions.sidoName, regions.sigunguName);

  return (
    <div>
      <AdminPageHeader
        title="메이커 등록"
        description="직접 제조하는 브랜드만 다룹니다. 단순 사입·리브랜딩은 제외합니다."
      />
      <div className="mt-5">
        <MakerEditor
          mode="create"
          maker={{
            name: "",
            category: "treats",
            regionId: "",
            storyMd: null,
            badgeFeedRegistered: false,
            badgeIngredientRegistered: false,
            badgeVerifiedAt: null,
            badgeNote: null,
            selectionMemo: null,
            status: "draft",
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          links={[]}
        />
      </div>
    </div>
  );
}
