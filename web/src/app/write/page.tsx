import type { Metadata } from "next";
import { GUIDE_CATEGORIES_BY_TOPIC } from "@app/data";
import { requireMember } from "@/lib/member";
import { listTopics } from "@/lib/queries/guides";
import { MemberPostForm } from "./post-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "글쓰기",
  robots: { index: false, follow: false },
};

export default async function WritePage() {
  await requireMember("/write");
  const topics = (await listTopics()).filter((t) => t.slug !== "spot");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">글쓰기</h1>
      <p className="mt-2 text-sm text-ink-soft">
        우리 개의 변화, 해봤던 것, 도움이 됐던 것. 주어가 사람이 아니라 반려동물인 이야기를 나눠 주세요.
      </p>
      <div className="mt-6">
        <MemberPostForm
          mode="create"
          post={{ topicId: topics.find((t) => t.slug === "senior-life")?.id ?? null, category: null, title: "", summary: null, bodyMd: "" }}
          topics={topics.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
          categoriesByTopic={GUIDE_CATEGORIES_BY_TOPIC}
        />
      </div>
    </div>
  );
}
