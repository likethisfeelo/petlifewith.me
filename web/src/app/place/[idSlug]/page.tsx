import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/jsonld";
import { DataReferenceNote, PharmacyNote } from "@/components/notices";
import { RememberRegion } from "@/components/region-banner";
import { contactEmail } from "@/lib/config";
import { SPOT_STATUS_LABEL, formatDate, idSlugPath, parseIdSlug } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { guidesMentioningSpot } from "@/lib/queries/guides";
import { getPlace, getSpotLinks } from "@/lib/queries/spots";
import { spotLinkLabel } from "@/lib/links";
import { buildMeta, localBusinessLd, placeInfoItemCount, robotsMeta, shouldIndexPlace } from "@/lib/seo";
import { assetUrl } from "@/lib/assets";

export const revalidate = 21600; // REVALIDATE.place

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ idSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  const found = id ? await getPlace(id) : null;
  // 비공개 유형(B2B 인허가)의 개별 페이지는 만들지 않는다
  if (!found || !found.typeListed) return { robots: robotsMeta(false) };
  const { spot, typeName, region } = found;
  const linkCount = (await getSpotLinks(spot.id)).length;
  return buildMeta({
    title: spot.seoTitle ?? `${spot.name} — ${region.sigunguName} ${typeName}`,
    description:
      spot.seoDescription ?? spot.descriptionMd?.split("\n")[0] ?? `${region.sidoName} ${region.sigunguName}의 ${typeName}.`,
    path: idSlugPath("place", spot.id, spot.slug),
    // 얇은 콘텐츠 방지: 정보 3항목 미만 개별 장소 → noindex (claude.md 5-3)
    indexable: shouldIndexPlace(spot, linkCount),
    ogImageUrl: assetUrl(spot.ogImageKey ?? spot.heroImageKey),
  });
}

export default async function PlacePage({ params }: Props) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (!id) notFound();
  const found = await getPlace(id);
  if (!found || !found.typeListed) notFound();

  const { spot, typeName, typeMonetizable, region } = found;
  const [mentions, links] = await Promise.all([guidesMentioningSpot(spot.id), getSpotLinks(spot.id)]);
  const description = spot.descriptionMd ? renderMarkdown(spot.descriptionMd) : null;
  const email = contactEmail();
  const infoCount = placeInfoItemCount(spot, links.length);

  const infoRows: Array<[string, React.ReactNode]> = [];
  if (spot.addressRoad) infoRows.push(["주소", spot.addressRoad]);
  if (spot.phone) infoRows.push(["전화", <a key="tel" className="hover:underline" href={`tel:${spot.phone}`}>{spot.phone}</a>]);
  if (spot.hoursText) infoRows.push(["운영시간", spot.hoursText]);
  if (spot.priceText) infoRows.push(["요금", spot.priceText]);
  if (spot.parkingText) infoRows.push(["주차", spot.parkingText]);
  // 등록된 외부 링크만 노출한다 (홈페이지·카카오톡·예약 등 — 업체마다 다르다)
  for (const link of links) {
    infoRows.push([
      spotLinkLabel(link),
      <a
        key={`link-${link.id}`}
        className="text-sea hover:underline"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {link.url.replace(/^https?:\/\//, "").slice(0, 42)} ↗
      </a>,
    ]);
  }

  const regionPath = `/spot/${region.sidoSlug}/${region.sigunguSlug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <RememberRegion
        region={{ sidoSlug: region.sidoSlug, sigunguSlug: region.sigunguSlug, label: `${region.sidoName} ${region.sigunguName}` }}
      />
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: region.sidoName, path: `/spot/${region.sidoSlug}` },
          { name: region.sigunguName, path: regionPath },
          { name: spot.name, path: idSlugPath("place", spot.id, spot.slug) },
        ]}
      />

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href={`${regionPath}/${found.typeSlug}`} className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea">
            {typeName}
          </Link>
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              spot.status === "operating" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-soft"
            }`}
          >
            {SPOT_STATUS_LABEL[spot.status] ?? spot.status}
          </span>
          {spot.source === "direct" && (
            <span className="rounded-full bg-honey-soft px-2.5 py-1 font-medium text-honey">직접 발굴</span>
          )}
          {spot.source === "sample" && (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-deep">개발용 샘플</span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{spot.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {region.sidoName} {region.sigunguName}
        </p>
        {assetUrl(spot.heroImageKey) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(spot.heroImageKey)} alt={spot.name} className="mt-4 w-full rounded-2xl bg-sand" decoding="async" />
        )}
      </header>

      {/* 장묘·동물약국: 광고·추천 없이 사실 정보만 (기획서 4-1·6-2) */}
      {!typeMonetizable && (
        <p className="mt-5 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 페이지는 광고 없이 인허가 기반 사실 정보만 담담하게 정리합니다.
        </p>
      )}
      {found.typeSlug === "pharmacy" && <PharmacyNote />}

      {infoRows.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          <dl className="divide-y divide-line text-sm">
            {infoRows.map(([label, value], i) => (
              <div key={`${label}-${i}`} className="grid grid-cols-[5.5rem_1fr] gap-3 px-4 py-3">
                <dt className="text-ink-faint">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DataReferenceNote date={spot.dataReferenceDate} source={spot.source} licenseMgmtNo={spot.licenseMgmtNo} />
        {spot.licenseDate && <p className="text-xs text-ink-faint">인허가일: {formatDate(spot.licenseDate)}</p>}
      </div>

      {description && (
        <div className="guide-prose prose prose-neutral mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: description.html }} />
      )}

      {infoCount < 3 && (
        <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-3 text-xs text-ink-faint">
          아직 정보가 부족한 장소입니다. 확인된 정보가 채워지기 전까지 검색 색인에서 제외됩니다.
        </p>
      )}

      {mentions.length > 0 && (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-lg font-bold text-ink">이 장소가 등장한 이야기</h2>
          <ul className="mt-4 space-y-3">
            {mentions.map((g) => (
              <li key={g.id} className="rounded-xl border border-line bg-surface p-4">
                <Link href={`/guide/${g.slug}`} className="font-bold text-ink hover:underline">
                  {g.title}
                </Link>
                {g.summary && <p className="mt-1 text-sm text-ink-soft">{g.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm">
        <h2 className="font-bold text-ink">이 장소를 운영하시나요?</h2>
        <p className="mt-1 text-ink-soft">
          무료로 정보 관리를 요청할 수 있습니다. 운영시간·요금·예약 링크를 채우면 방문자에게 더 잘 보입니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/claim/spot/${spot.id}`}
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
          >
            정보 관리 요청 (무료)
          </Link>
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`[정정] ${spot.name} (place/${spot.id})`)}`}
              className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-sand"
            >
              잘못된 정보 신고
            </a>
          )}
        </div>
      </section>

      <JsonLd
        data={localBusinessLd({
          name: spot.name,
          path: idSlugPath("place", spot.id, spot.slug),
          addressRegion: region.sidoName,
          addressLocality: region.sigunguName,
          streetAddress: spot.addressRoad,
          telephone: spot.phone,
        })}
      />
    </div>
  );
}
