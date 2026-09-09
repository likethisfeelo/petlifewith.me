import { GUIDE_CATEGORIES_BY_TOPIC } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { getMemberMediaSettings } from "@/lib/queries/settings";
import { uploadPolicyFor } from "@/lib/settings";
import { NewPostForm } from "./new-post-form";

const { topics } = schema;

export default async function AdminGuideNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const topicRows = await getDb().select().from(topics).orderBy(topics.sortOrder);

  return (
    <div>
      <AdminPageHeader
        title="게시글 작성"
        description="관리자에서 바로 쓰는 경로입니다. 마크다운 파일로 관리하고 싶다면 data/content/guides 에 두고 시드를 돌려도 됩니다."
      />
      {topicRows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
          토픽이 없습니다. 먼저 <code>pnpm seed</code> 로 기본 토픽을 넣으세요.
        </p>
      ) : (
        <div className="mt-5">
          <NewPostForm policy={uploadPolicyFor("admin", await getMemberMediaSettings())}
            topics={topicRows.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
            categoriesByTopic={GUIDE_CATEGORIES_BY_TOPIC}
          />
        </div>
      )}
    </div>
  );
}
