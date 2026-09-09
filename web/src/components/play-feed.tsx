// 놀이 영상 피드 — 운영진·회원 글 전체를 영상 카드로. 서버 컴포넌트: 대표 영상·섬네일을 정하고 날짜를 만든 뒤
// 클라이언트 카드(components/media/media-card.tsx)에 넘긴다. 카드 미디어 규칙은 lib/media-ref.ts pickCardMedia.
import { assetUrl } from "@/lib/assets";
import { formatDate } from "@/lib/format";
import { pickCardMedia } from "@/lib/media-ref";
import type { GuideListItem } from "@/lib/queries/guides";
import { listPostersForKeys } from "@/lib/queries/media";
import { MediaCard, type CardMediaProps } from "./media/media-card";

export async function PlayFeed({ posts }: { posts: GuideListItem[] }) {
  // 업로드 영상의 포스터를 한 번에 찾는다 (대표 이미지가 없는 글만 필요하지만 단순하게 전부)
  const picks = posts.map((p) => ({ item: p, media: pickCardMedia(p.guide) }));
  const videoKeys = picks.flatMap((p) => (p.media.video?.kind === "video" ? [p.media.video.key] : []));
  const posters = await listPostersForKeys(videoKeys);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {picks.map(({ item, media: first }) => {
        const media = first.video?.kind === "video" && !first.thumbKey ? pickCardMedia(item.guide, posters) : first;
        const thumbSrc = (media.thumbKey ? assetUrl(media.thumbKey) : null) ?? media.thumbUrl ?? null;
        let card: CardMediaProps;
        if (media.video?.kind === "video") card = { kind: "video", videoSrc: assetUrl(media.video.key) ?? null, thumbSrc };
        else if (media.video?.kind === "youtube") card = { kind: "youtube", youtubeId: media.video.id, thumbSrc };
        else if (media.video?.kind === "instagram") card = { kind: "instagram", thumbSrc };
        else card = { kind: thumbSrc ? "image" : "none", thumbSrc };
        return (
          <MediaCard
            key={item.guide.id}
            href={`/guide/${item.guide.slug}`}
            title={item.guide.title}
            summary={item.guide.summary}
            authorName={item.authorName}
            dateLabel={formatDate(item.guide.publishedAt)}
            badge={item.guide.curatedOrder ? `큐레이션 ${item.guide.curatedOrder}` : null}
            media={card}
          />
        );
      })}
    </div>
  );
}
