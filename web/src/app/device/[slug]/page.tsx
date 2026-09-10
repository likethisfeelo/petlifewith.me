// 기기 한 대 — 원리·스펙 → 본사 → 대리점 → 지역별 체험 가능 업체 → 보유 병원(무료·순위 없음) → 다룬 글.
// 협찬 글은 "광고·협찬" 표기와 함께 맨 위에 둔다 (표시광고법). 효과 단정 표현은 쓰지 않는다 (claude.md 6-2).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AdLabel, MedicalNotice } from "@/components/notices";
import { SpotTypeIcon } from "@/components/spot-type-banners";
import { assetUrl } from "@/lib/assets";
import { contactEmail } from "@/lib/config";
import { DEVICE_CATEGORY_BLURB, DEVICE_CATEGORY_LABEL, deviceIndexable } from "@/lib/devices";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { getDeviceBySlug } from "@/lib/queries/devices";
import { buildMeta, robotsMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDeviceBySlug(decodeURIComponent(slug));
  if (!d) return { robots: robotsMeta(false) };
  return buildMeta({
    title: `${d.name}${d.makerName ? ` (${d.makerName})` : ""} — 무엇이고 어디서 써 볼 수 있나`,
    description: d.summaryExcerpt ?? `${DEVICE_CATEGORY_LABEL[d.category]} — 원리와 쓰임, 대리점·체험 가능 업체를 정리했습니다.`,
    path: `/device/${encodeURIComponent(d.slug)}`,
    indexable: deviceIndexable({ published: d.published, summaryMd: d.summaryMd }),
    ogImageUrl: assetUrl(d.imageKey) ?? undefined,
  });
}

export default async function DevicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const d = await getDeviceBySlug(decodeURIComponent(raw));
  if (!d || !d.published) notFound();
  const summary = d.summaryMd ? renderMarkdown(d.summaryMd) : null;
  const specs = d.specsMd ? renderMarkdown(d.specsMd) : null;
  const email = contactEmail();
  const path = `/device/${encodeURIComponent(d.slug)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "관리·재활 도구", path: "/device" },
          { name: DEVICE_CATEGORY_LABEL[d.category], path: `/device?category=${d.category}` },
          { name: d.name, path },
        ]}
      />

      <header className="mt-6 flex flex-wrap gap-5">
        {assetUrl(d.imageKey) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(d.imageKey)} alt={d.name} className="h-40 w-40 shrink-0 rounded-2xl bg-sand object-cover" />
        ) : (
          <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl bg-sea-soft text-sea">
            <SpotTypeIcon slug={d.category === "monitor" ? "monitor" : d.category === "rehab_equipment" ? "rehab" : "device"} className="h-16 w-16" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link href={`/device?category=${d.category}`} className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea hover:bg-sea hover:text-white">
              {DEVICE_CATEGORY_LABEL[d.category]}
            </Link>
            {d.homeUse && <span className="rounded-full bg-sand px-2.5 py-1 font-medium text-ink-soft">집에서 사용</span>}
            {d.featuredOrder !== null && <AdLabel />}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{d.name}</h1>
          {d.makerName && <p className="mt-1 text-sm text-ink-soft">{d.makerName}</p>}
          {d.priceText && <p className="mt-1 text-sm font-medium text-ink">{d.priceText}</p>}
          <p className="mt-2 text-xs text-ink-faint">{DEVICE_CATEGORY_BLURB[d.category]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.makerUrl && (
              <a href={d.makerUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream hover:opacity-90">
                본사 사이트
              </a>
            )}
            {d.makerContactUrl && (
              <a href={d.makerContactUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sand">
                본사 문의
              </a>
            )}
            {d.trialCount > 0 && (
              <a href="#trial" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sand">
                체험 가능한 곳 {d.trialCount}곳
              </a>
            )}
          </div>
        </div>
      </header>

      {summary && <div className="guide-prose prose prose-neutral mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: summary.html }} />}

      {specs && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-ink">사양·사용 조건</h2>
          <div className="guide-prose prose prose-neutral mt-2 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: specs.html }} />
        </section>
      )}

      {d.dealers.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-ink">대리점·취급처</h2>
          <p className="mt-1 text-sm text-ink-soft">본사가 알려 준 판매·설치 창구입니다. 가격과 조건은 각 대리점에 확인해 주세요.</p>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {d.dealers.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-semibold text-ink">{x.name}</span>
                {x.regionLabel && <span className="text-xs text-ink-faint">{x.regionLabel}</span>}
                {x.note && <span className="text-xs text-ink-soft">{x.note}</span>}
                <span className="ml-auto flex gap-2">
                  {x.phone && <span className="text-xs text-ink-soft">{x.phone}</span>}
                  {x.url && (
                    <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs font-medium text-sea hover:underline">
                      바로가기 →
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="trial" className="mt-10">
        <h2 className="text-lg font-extrabold text-ink">지역별 체험 가능 업체</h2>
        <p className="mt-1 text-sm text-ink-soft">
          이 기기를 갖춘 곳입니다. 업체 페이지에서 예약 요청을 보내거나 카카오톡으로 바로 물어볼 수 있어요. 이용 조건·비용은 업체마다 다릅니다.
        </p>
        {d.trials.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            아직 확인된 곳이 없습니다. 이 기기를 갖춘 업체를 알려 주시면 확인 후 싣습니다{email ? ` (${email})` : ""}.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {d.trials.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line bg-surface p-4">
                <Link href={t.path} className="text-sm font-bold text-ink hover:underline">
                  {t.name}
                </Link>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {[t.regionLabel, t.typeName].filter(Boolean).join(" · ")}
                  {t.status && t.status !== "operating" ? " · 영업 상태 확인 필요" : ""}
                </p>
                {t.note && <p className="mt-1 text-xs text-ink-soft">{t.note}</p>}
                <Link href={`/book/spot/${t.spotId}`} className="mt-3 inline-block rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
                  예약 요청
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs">
          <Link href="/spot/type/rehab" className="text-sea hover:underline">
            운동·재활 지도에서 지역별로 보기 →
          </Link>
        </p>
      </section>

      {d.hospitals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-ink">이 기기를 갖춘 동물병원</h2>
          <p className="mt-1 text-sm text-ink-soft">
            공개된 정보를 확인해 가나다순으로 적습니다. 광고·순위·추천이 아니며, 진료 여부와 조건은 병원에 직접 확인해 주세요.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {[...d.hospitals].sort((a, b) => a.facilityName.localeCompare(b.facilityName, "ko-KR")).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-medium text-ink">{h.facilityName}</span>
                {h.regionLabel && <span className="text-xs text-ink-faint">{h.regionLabel}</span>}
                {h.note && <span className="text-xs text-ink-soft">{h.note}</span>}
                {h.verifiedAt && <span className="ml-auto text-xs text-ink-faint">확인 {formatDate(h.verifiedAt)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.guides.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-ink">이 기기를 다룬 글</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {d.guides.map((g) => (
              <li key={g.id} className={`rounded-2xl border p-4 ${g.sponsorName ? "border-accent/30 bg-accent-soft/30" : "border-line bg-surface"}`}>
                {g.sponsorName && (
                  <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <AdLabel />
                    <span className="text-[11px] text-ink-faint">{g.sponsorName} 협찬</span>
                  </p>
                )}
                <Link href={`/guide/${encodeURIComponent(g.slug)}`} className="text-sm font-bold text-ink hover:underline">
                  {g.title}
                </Link>
                {g.summary && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{g.summary}</p>}
                {g.publishedAt && <p className="mt-1 text-[11px] text-ink-faint">{formatDate(g.publishedAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <MedicalNotice />
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        정보가 다르거나 빠진 곳이 있으면 알려 주세요{email ? ` — ${email}` : ""}. 확인 후 고칩니다. 마지막 갱신 {formatDate(d.updatedAt)}
      </p>
    </div>
  );
}
