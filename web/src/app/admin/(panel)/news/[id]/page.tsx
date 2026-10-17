import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getMemberMediaSettings } from "@/lib/queries/settings";
import { uploadPolicyFor } from "@/lib/settings";
import { AdminPageHeader } from "../../../_components/fields";
import { deleteNewsAction } from "../../../news-actions";
import { NewsEditor } from "./news-editor";
import { STARTER_NEWS } from "@/lib/tools/starter-news";

const { newsPosts } = schema;

/** 처음 쓰는 글이면 코드에 들어 있는 최신 기본 HTML */
function starterHtml(slug: string): string | undefined {
  const starter = STARTER_NEWS.find((n) => n.slug === slug);
  return starter && "toolHtml" in starter ? starter.toolHtml : undefined;
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminNewsEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const newsId = Number(id);
  if (!Number.isSafeInteger(newsId)) notFound();
  const post = (await getDb().select().from(newsPosts).where(eq(newsPosts.id, newsId)).limit(1))[0];
  if (!post) notFound();

  return (
    <div>
      <AdminPageHeader
        title={post.title}
        description={`URL /news/${post.slug}`}
        right={
          post.status === "published" ? (
            <Link href={`/news/${post.slug}`} className="text-sm font-medium text-sea hover:underline">
              공개 페이지 보기 →
            </Link>
          ) : undefined
        }
      />
      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">등록되었습니다.</p>
      )}
      <div className="mt-5">
        <NewsEditor
          mode="edit"
          defaultHtml={starterHtml(post.slug)}
          policy={uploadPolicyFor("admin", await getMemberMediaSettings())}
          post={{
            id: post.id,
            title: post.title,
            category: post.category,
            status: post.status,
            summary: post.summary,
            bodyMd: post.bodyMd,
            heroImageKey: post.heroImageKey,
            toolKey: post.toolKey,
            toolHtml: post.toolHtml,
            toolHeight: post.toolHeight,
            seo: { seoTitle: post.seoTitle, seoDescription: post.seoDescription, ogImageKey: post.ogImageKey },
          }}
        />
      </div>
      <form action={deleteNewsAction} className="mt-10 border-t border-line pt-4">
        <input type="hidden" name="id" value={post.id} />
        <button type="submit" className="text-xs text-accent-deep hover:underline">
          이 글 삭제 (되돌릴 수 없음 — 내리기만 하려면 상태를 보관으로)
        </button>
      </form>
    </div>
  );
}
