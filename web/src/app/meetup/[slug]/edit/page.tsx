// 모임 수정 — 주최자 전용
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MeetupForm } from "@/components/meetup/meetup-form";
import { requireMember } from "@/lib/member";
import { getMeetupBySlug } from "@/lib/queries/meetups";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "모임 수정 — 펫모임", robots: robotsMeta(false) };

export default async function MeetupEditPage({ params }: { params: Promise<{ slug: string }> }) {
  // 한글 슬러그는 퍼센트 인코딩된 채 들어온다
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const member = await requireMember(`/meetup/${slug}/edit`);
  const meetup = await getMeetupBySlug(slug);
  if (!meetup || meetup.hostUserId !== member.id || meetup.hiddenAt) notFound();
  const [sidoName, ...rest] = meetup.regionLabel.split(" ");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "펫모임", path: "/meetup" }, { name: meetup.title, path: `/meetup/${slug}` }, { name: "수정", path: `/meetup/${slug}/edit` }]} />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">모임 수정</h1>
      <MeetupForm
        mode="edit"
        regions={[{ id: meetup.regionId, sidoName: sidoName ?? "", sidoSlug: meetup.sidoSlug, sigunguName: rest.join(" ") }]}
        initial={{ id: meetup.id, title: meetup.title, descriptionMd: meetup.descriptionMd, placeText: meetup.placeText, meetingAt: meetup.meetingAt, capacity: meetup.capacity }}
      />
    </div>
  );
}
