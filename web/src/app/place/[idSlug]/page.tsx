import { TrackContext } from "@/components/tracker";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carePersonLabel, isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReserveActions } from "@/components/reservation/reserve-actions";
import { JsonLd } from "@/components/jsonld";
import { B2BNote, DataReferenceNote, MedicalNotice, PharmacyNote } from "@/components/notices";
import { RememberRegion } from "@/components/region-banner";
import { contactEmail } from "@/lib/config";
import { ContactRow } from "@/components/contact/contact-row";
import { ReactionButtons } from "@/components/reactions/reaction-buttons";
import { SPOT_STATUS_LABEL, formatDate, idSlugPath, parseIdSlug } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { listDevicesForSpot } from "@/lib/queries/devices";
import { guidesMentioningSpot } from "@/lib/queries/guides";
import { listServiceAreasForSpot } from "@/lib/queries/care";
import { getPlace, getSpotLinks } from "@/lib/queries/spots";
import { spotLinkLabel } from "@/lib/links";
import { buildMeta, localBusinessLd, placeInfoItemCount, robotsMeta, shouldIndexPlace } from "@/lib/seo";
import { assetUrl } from "@/lib/assets";
import { siteUrl } from "@/lib/config";
import { spotLatLng } from "@/lib/geo";
import { UNVERIFIED_NOTICE, linkBaseUrl, linkPageUrl } from "@/lib/spot-pages";
import { PlaceMap } from "@/components/map/place-map";

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
  if (!found) return { robots: robotsMeta(false) };
  const { spot, typeName, region } = found;
  const linkCount = (await getSpotLinks(spot.id)).length;
  return buildMeta({
    title: spot.seoTitle ?? `${spot.name} — ${region.sigunguName} ${typeName}`,
    description:
      spot.seoDescription ?? spot.descriptionMd?.split("\n")[0] ?? `${region.sidoName} ${region.sigunguName}의 ${typeName}.`,
    path: idSlugPath("place", spot.id, spot.slug),
    // 얇은 콘텐츠 방지: 정보 3항목 미만 개별 장소 → noindex (claude.md 5-3)
    indexable: shouldIndexPlace(spot, linkCount),
    // 장묘·동물약국·B2B 유형 페이지에는 광고를 붙이지 않는다 (기획서 4-1·6-2)
    ads: found.typeMonetizable,
    ogImageUrl: assetUrl(spot.ogImageKey ?? spot.heroImageKey),
  });
}

export default async function PlacePage({ params }: Props) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (!id) notFound();
  const found = await getPlace(id);
  if (!found) notFound();

  const { spot, typeName, typeMonetizable, region } = found;
  const isCare = isCareType(found.typeSlug);
  const isRehab = found.typeSlug === "rehab";
  const [mentions, links, careAreas, devices] = await Promise.all([
    guidesMentioningSpot(spot.id),
    getSpotLinks(spot.id),
    isCare ? listServiceAreasForSpot(spot.id) : Promise.resolve([]),
    isRehab ? listDevicesForSpot(spot.id) : Promise.resolve([]),
  ]);
  const exposedAreas = careAreas.filter((a) => a.exposed);
  const description = spot.descriptionMd ? renderMarkdown(spot.descriptionMd) : null;
  const email = contactEmail();
  const infoCount = placeInfoItemCount(spot, links.length);

  const infoRows: Array<[string, React.ReactNode]> = [];
  // 돌봄 파트너는 주소 대신 활동 지역(시군구) — 개인 사업자의 주거지를 싣지 않는다 (claude.md 5-6)
  if (exposedAreas.length > 0) {
    infoRows.push([
      "활동 지역",
      <span key="areas" className="flex flex-wrap gap-1.5">
        {exposedAreas.map((a) => (
          <Link key={a.id} href={`/spot/${a.sidoSlug}/${a.sigunguSlug}/${found.typeSlug}`} className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea hover:bg-sea hover:text-white">
            {a.sidoName} {a.sigunguName}
          </Link>
        ))}
      </span>,
    ]);
  }
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
  // 링크 페이지가 있으면 바로가기, 사장님 확인이 없는 공공데이터 정보면 안내
  const linkUrl = found.page?.published ? linkPageUrl(linkBaseUrl(siteUrl()), spot.id, found.page) : null;
  const unverified = found.tier === "unlisted" && !spot.claimedBy && spot.source !== "sample";
  const coords = spotLatLng(spot);
  const showMap = exposedAreas.length === 0 && (coords || spot.addressRoad);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrackContext
        page_type="place"
        content_group="directory"
        entity_type="spot"
        entity_id={String(spot.id)}
        spot_type={found.typeSlug}
        region_sido={region.sidoName}
        region_sigungu={region.sigunguName}
      />
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
            <span className="rounded-full bg-honey-soft px-2.5 py-1 font-medium text-honey" title="화면 구성을 보여 주기 위한 가상의 예시 — 실제 업체가 아닙니다">
              예시 (가상 데이터)
            </span>
          )}
          <span className="ml-auto">
            <ReactionButtons target="spot" id={spot.id} kinds={["save"]} nextPath={idSlugPath("place", spot.id, spot.slug)} size="sm" />
          </span>
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

      {linkUrl && (
        <a href={linkUrl} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:opacity-90">
          {found.tier === "paid" ? "프리미엄 링크 페이지" : "업체 링크 페이지"} ↗
        </a>
      )}

      {unverified && (
        <p className="mt-5 rounded-lg border border-honey/40 bg-honey-soft px-4 py-3 text-sm text-ink">
          <strong className="font-semibold">확인 안내</strong> · {UNVERIFIED_NOTICE}
        </p>
      )}

      {/* 장묘·동물약국: 광고·추천 없이 사실 정보만 (기획서 4-1·6-2) */}
      {!typeMonetizable && (
        <p className="mt-5 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 페이지는 광고 없이 인허가 기반 사실 정보만 담담하게 정리합니다.
        </p>
      )}
      {found.typeSlug === "pharmacy" && <PharmacyNote />}
      {!found.typeListed && <B2BNote />}

      {/* 운동·재활: 주어는 기기다. 보유 장비를 사실로 적고, 효과·치료 표현은 쓰지 않는다 (claude.md 6-2) */}
      {isRehab && (
        <section className="mt-5 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">보유 장비</h2>
          {devices.length === 0 ? (
            <p className="mt-1 text-xs text-ink-soft">
              확인된 장비가 아직 없습니다. 장비를 보유하고 계시면 알려 주세요 — 기기 페이지의 체험 가능 업체로 함께 실립니다.
            </p>
          ) : (
            <>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {devices.map((d) => (
                  <li key={d.id}>
                    {d.published ? (
                      <Link href={`/device/${encodeURIComponent(d.slug)}`} className="rounded-full bg-sea-soft px-2.5 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white">
                        {d.name}
                      </Link>
                    ) : (
                      <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-soft">{d.name}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-faint">직접 확인한 보유 장비입니다. 이용 조건·비용은 업체에 확인해 주세요.</p>
            </>
          )}
          <div className="mt-3">
            <MedicalNotice />
          </div>
        </section>
      )}

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

      {showMap && (
        <section className="mt-4">
          <PlaceMap name={spot.name} lat={coords?.lat} lng={coords?.lng} address={spot.addressRoad} preferAddress={!!spot.claimedBy} height={220} />
        </section>
      )}

      {spot.status === "operating" && typeMonetizable && spot.source !== "sample" && (
        <section className="mt-4 rounded-xl border border-line bg-cream px-4 py-3">
          <p className="text-sm font-semibold text-ink">예약·상담</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {isCare
              ? `예약 요청을 보내면 ${carePersonLabel(found.typeSlug)} 또는 운영자가 확인하고, 결제 확인 뒤 서비스 안 채팅으로 약속을 잡습니다.`
              : "예약 요청을 보내면 업체 담당자 또는 운영자가 확인하고, 결제 확인 뒤 서비스 안 채팅으로 이어집니다. 카카오톡 채널이 있으면 바로 상담해도 됩니다."}
          </p>
          <ReserveActions spotId={spot.id} kakaoUrl={links.find((l) => l.kind === "kakao")?.url ?? null} />
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

      {links.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">연락·예약</h2>
          <p className="mt-1 text-xs text-ink-soft">예약·문의는 업체가 쓰는 채널에서 바로 이어 가세요. 로그인하면 연락한 업체가 내 페이지에 남습니다.</p>
          <div className="mt-3">
            <ContactRow spotId={spot.id} links={links.map((l) => ({ kind: l.kind, url: l.url, label: spotLinkLabel(l) }))} />
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm">
        <h2 className="font-bold text-ink">이 장소를 운영하시나요?</h2>
        <p className="mt-1 text-ink-soft">
          무료로 정보 관리를 요청할 수 있습니다. 운영시간·요금·예약 링크를 채우면 방문자에게 더 잘 보입니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/portal/spot?spot=${spot.id}#register`}
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
          >
            정보 관리 요청 (무료)
          </Link>
          {typeMonetizable && !isCare && (
            <Link
              href={`/portal/promo?spot=${spot.id}`}
              className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-sand"
            >
              지역 상단 노출 신청 (유료)
            </Link>
          )}
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
