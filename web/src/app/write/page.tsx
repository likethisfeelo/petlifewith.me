import type { Metadata } from "next";
import { GUIDE_CATEGORIES_BY_TOPIC } from "@app/data";
import { requireMember } from "@/lib/member";
import { listTopics } from "@/lib/queries/guides";
import { TopicTagline } from "@/components/site-tagline";
import { MemberPostForm } from "./post-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "글쓰기",
  robots: { index: false, follow: false },
};

export default async function WritePage({ searchParams }: { searchParams: Promise<{ topic?: string; category?: string }> }) {
  const { topic: topicParam, category: categoryParam } = await searchParams;
  const qs = new URLSearchParams();
  if (topicParam) qs.set("topic", topicParam);
  if (categoryParam) qs.set("category", categoryParam);
  await requireMember(qs.size > 0 ? `/write?${qs.toString()}` : "/write");
  const topics = (await listTopics()).filter((t) => t.slug !== "spot");
  // 게시판에서 넘어온 경우 주제·카테고리를 미리 채운다 (정의에 있는 값만)
  const preTopic = topics.find((t) => t.slug === topicParam) ?? topics.find((t) => t.slug === "senior-life") ?? null;
  const preCategory =
    preTopic && categoryParam && (GUIDE_CATEGORIES_BY_TOPIC[preTopic.slug] ?? []).some((c) => c.slug === categoryParam) ? categoryParam : null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TopicTagline topic={preTopic?.slug ?? null} />
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">글쓰기</h1>
      <p className="mt-2 text-sm text-ink-soft">
        우리 개의 변화, 해봤던 것, 도움이 됐던 것. 주어가 사람이 아니라 반려동물인 이야기를 나눠 주세요.
      </p>
      <div className="mt-6">
        <MemberPostForm
          mode="create"
          post={{ topicId: preTopic?.id ?? null, category: preCategory, title: "", summary: null, bodyMd: "" }}
          topics={topics.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
          categoriesByTopic={GUIDE_CATEGORIES_BY_TOPIC}
        />
      </div>
    </div>
  );
}
