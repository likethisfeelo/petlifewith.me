import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { GUIDE_CATEGORIES_BY_TOPIC } from "@app/data";
import { getDb, schema } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { listTopics } from "@/lib/queries/guides";
import { MemberPostForm } from "../post-form";

const { guides } = schema;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "글 수정",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guideId = Number(id);
  if (!Number.isSafeInteger(guideId)) notFound();
  const member = await requireMember(`/write/${guideId}`);
  const guide = (await getDb().select().from(guides).where(eq(guides.id, guideId)).limit(1))[0];
  // 내 글이 아니면 존재 자체를 드러내지 않는다
  if (!guide || guide.authorUserId !== member.id) notFound();
  const editable = guide.status === "pending" || guide.status === "published";
  const topics = (await listTopics()).filter((t) => t.slug !== "spot");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">글 수정</h1>
      {!editable ? (
        <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 글은 지금 상태에서 수정할 수 없습니다. 문의해 주세요.
        </p>
      ) : (
        <div className="mt-6">
          <MemberPostForm
            mode="edit"
            post={{ id: guide.id, topicId: guide.topicId, category: guide.category, title: guide.title, summary: guide.summary, bodyMd: guide.bodyMd, status: guide.status }}
            topics={topics.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
            categoriesByTopic={GUIDE_CATEGORIES_BY_TOPIC}
          />
        </div>
      )}
    </div>
  );
}
