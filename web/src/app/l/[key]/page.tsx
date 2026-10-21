// 업체 링크 페이지 — link.<apex>/<번호> (무료), link.<apex>/<짧은 주소> (유료)
// 미들웨어가 link 호스트의 경로를 /l/... 로 바꿔 여기로 온다. 사이트 머리글·푸터는 data-linkpage 로 감춘다(globals.css).
// link 호스트에서는 상대 경로가 다시 /l/... 로 바뀌므로 본 사이트로 가는 링크는 모두 절대 주소(siteUrl)로 쓴다.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LinkBeacon } from "@/components/linkpage/link-beacon";
import { PlaceMap } from "@/components/map/place-map";
import { assetUrl } from "@/lib/assets";
import { siteUrl } from "@/lib/config";
import { SPOT_STATUS_LABEL, idSlugPath } from "@/lib/format";
import { spotLatLng } from "@/lib/geo";
import { spotLinkLabel } from "@/lib/links";
import { getLinkPage, type LinkPageData } from "@/lib/queries/spot-pages";
import { buildMeta, robotsMeta } from "@/lib/seo";
import { linkBaseUrl, linkPageUrl, parseLinkKey, premiumTheme } from "@/lib/spot-pages";

export const revalidate = 3600; // REVALIDATE.linkPage

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ key: string }>;
}

async function load(rawKey: string): Promise<LinkPageData | null> {
  const key = parseLinkKey(rawKey);
  return key ? getLinkPage(key) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).key);
  if (!data) return { robots: robotsMeta(false) };
  const { spot, region, typeName } = data;
  const cover = data.media.find((m) => m.kind === "image");
  return buildMeta({
    title: `${spot.name} — ${region.sigunguName} ${typeName}`,
    description: introOf(data) ?? `${region.sidoName} ${region.sigunguName}의 ${typeName}. 채널·예약·위치를 한 곳에서.`,
    // 정식 주소는 장소 페이지 — 링크 페이지는 색인하지 않는다
    path: idSlugPath("place", spot.id, spot.slug),
    indexable: false,
    ads: false,
    ogImageUrl: assetUrl(cover?.objectKey ?? spot.ogImageKey ?? spot.heroImageKey),
  });
}

/** 소개 한 문단 — 사장님이 적은 소개, 없으면 장소 설명의 첫 문단 */
function introOf(data: LinkPageData): string | null {
  if (data.page.intro?.trim()) return data.page.intro.trim();
  const first = data.spot.descriptionMd
    ?.split(/\n\s*\n/)
    .map((p) => p.replace(/[#*_>`[\]]/g, "").replace(/\(https?:[^)]*\)/g, "").trim())
    .find(Boolean);
  return first ? first.slice(0, 300) : null;
}

export default async function LinkPage({ params }: Props) {
  const rawKey = (await params).key;
  const data = await load(rawKey);
  if (!data) notFound();
  const { spot, region, page, paid, links, media } = data;

  // 주소 정리: 유료+짧은 주소면 짧은 주소, 아니면 번호 (유료 기간이 끝난 짧은 주소는 번호로)
  const site = siteUrl().replace(/\/$/, "");
  const canonical = linkPageUrl(linkBaseUrl(site), spot.id, page);
  const wantKey = canonical.slice(canonical.lastIndexOf("/") + 1);
  if (decodeURIComponent(rawKey).toLowerCase() !== wantKey) redirect(canonical);

  const dark = paid;
  // 프리미엄 배경 테마 — 진한 색 + 흰 글자 (lib/spot-pages.ts PREMIUM_THEMES)
  const theme = premiumTheme(page.theme);
  const themeVars = dark ? ({ "--lp-bg": theme.bg, "--lp-box": theme.box, "--lp-card": theme.card, "--lp-line": theme.line, "--lp-head": theme.head } as React.CSSProperties) : undefined;
  const intro = introOf(data);
  const placeUrl = `${site}${idSlugPath("place", spot.id, spot.slug)}`;
  const kakao = links.find((l) => l.kind === "kakao")?.url ?? null;
  const canBook = data.typeMonetizable && spot.status === "operating" && spot.source !== "sample";
  const cta = kakao
    ? { href: kakao, label: paid ? "카카오톡으로 바로 상담" : "카카오톡으로 상담하기", external: true }
    : canBook
      ? { href: `${site}/book/spot/${spot.id}`, label: paid ? "바로 상담 / 예약 요청" : "상담 / 예약 문의하기", external: false }
      : null;
  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");
  const coords = spotLatLng(spot);

  const info: Array<[string, React.ReactNode]> = [];
  if (spot.addressRoad) info.push(["주소", spot.addressRoad]);
  if (spot.hoursText) info.push(["영업시간", spot.hoursText]);
  if (spot.phone)
    info.push([
      "연락처",
      <a key="tel" href={`tel:${spot.phone}`} data-link-click className="hover:underline">
        {spot.phone}
      </a>,
    ]);
  if (spot.priceText) info.push(["요금", spot.priceText]);
  if (spot.parkingText) info.push(["주차", spot.parkingText]);

  const t = dark
    ? {
        page: "bg-[var(--lp-bg)] text-white",
        box: "bg-[var(--lp-box)]",
        section: "border-b border-[var(--lp-line)]",
        soft: "text-white/60",
        card: "bg-[var(--lp-card)]",
        btn: "border border-[var(--lp-line)] bg-[var(--lp-card)] text-white hover:brightness-125",
        cta: "bg-white text-black",
      }
    : {
        page: "bg-[#f5f5f5] text-[#111]",
        box: "bg-white shadow-[0_0_20px_rgba(0,0,0,0.08)]",
        section: "border-b-8 border-[#f5f5f5]",
        soft: "text-[#666]",
        card: "",
        btn: "border border-[#ddd] bg-white text-[#111] hover:bg-[#fafafa]",
        cta: "bg-black text-white",
      };

  return (
    <div data-linkpage style={themeVars} className={`min-h-screen ${t.page}`}>
      <LinkBeacon spotId={spot.id} />
      <div className={`mx-auto min-h-screen max-w-[480px] ${t.box}`}>
        <header className={`px-4 pb-5 pt-6 text-center ${dark ? "border-b border-[var(--lp-line)] bg-gradient-to-b from-[var(--lp-bg)] to-[var(--lp-head)]" : "bg-black text-white"}`}>
          {paid ? (
            <span className="mb-3 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-[1.5px] text-black">PREMIUM</span>
          ) : (
            <p className="mb-2 text-[11px] tracking-[1px] opacity-70">펫라이프위드미 등록 업체</p>
          )}
          <h1 className={`font-extrabold tracking-tight ${paid ? "text-2xl" : "text-[22px]"}`}>{spot.name}</h1>
          <p className="mt-1 text-[13px] opacity-80">
            {region.sidoName} {region.sigunguName} · {data.typeName}
          </p>
          <span className="mt-2.5 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-black">
            {SPOT_STATUS_LABEL[spot.status] ?? spot.status}
          </span>
        </header>

        {images.length > 0 && (paid ? <Gallery images={images} name={spot.name} /> : <FreeGallery images={images} name={spot.name} />)}

        {intro && (
          <Section title="업체 소개" className={t.section}>
            <p className={`whitespace-pre-line text-sm ${dark ? "text-white/85" : "text-[#333]"}`}>{intro}</p>
          </Section>
        )}

        {page.services.length > 0 && (
          <Section title="주요 서비스" className={t.section}>
            {dark ? (
              <div className="flex flex-wrap gap-2">
                {page.services.map((s) => (
                  <span key={s} className="rounded-full bg-[var(--lp-card)] px-3 py-1.5 text-[13px]">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <ul>
                {page.services.map((s) => (
                  <li key={s} className="relative border-b border-[#f0f0f0] py-2 pl-[18px] text-sm last:border-b-0 before:absolute before:left-0 before:font-bold before:content-['•']">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {info.length > 0 && (
          <Section title="기본 정보" className={t.section}>
            {dark ? (
              <div className="grid gap-2.5">
                {info.map(([label, value]) => (
                  <div key={label} className="rounded-[10px] bg-[var(--lp-card)] px-3.5 py-3 text-sm">
                    <span className="mb-0.5 block text-xs text-white/60">{label}</span>
                    {value}
                  </div>
                ))}
              </div>
            ) : (
              <dl>
                {info.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-[#eee] py-2.5 text-sm last:border-b-0">
                    <dt className="shrink-0 text-[#666]">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>
        )}

        {(links.length > 0 || cta) && (
          <Section title={paid ? "채널 & 예약" : "채널 바로가기"} className={t.section}>
            {links.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {links.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-link-click
                    className={`flex items-center justify-center rounded-[10px] px-2 text-center text-[13px] font-medium ${paid ? "py-3.5" : "py-3"} ${t.btn}`}
                  >
                    {spotLinkLabel(l)}
                  </a>
                ))}
              </div>
            )}
            {cta && (
              <a
                href={cta.href}
                {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                data-link-click
                className={`mt-3.5 block w-full rounded-[10px] py-4 text-center text-[15px] font-bold ${t.cta}`}
              >
                {cta.label}
              </a>
            )}
          </Section>
        )}

        {videos.length > 0 && (
          <Section title="영상" className={t.section}>
            <div className="grid gap-3">
              {videos.map((v) => (
                <video
                  key={v.id}
                  controls
                  playsInline
                  preload="none"
                  poster={assetUrl(v.posterKey) ?? undefined}
                  src={assetUrl(v.objectKey)}
                  className="w-full rounded-[10px] bg-[var(--lp-card)]"
                />
              ))}
            </div>
          </Section>
        )}

        {(spot.addressRoad || coords) && (
          <Section title="위치" className={t.section}>
            <PlaceMap name={spot.name} lat={coords?.lat} lng={coords?.lng} address={spot.addressRoad} dark={dark} preferAddress={!!spot.claimedBy} height={paid ? 190 : 170} />
          </Section>
        )}

        <footer className={`px-4 py-6 text-center text-xs ${dark ? "text-white/50" : "text-[#999]"}`}>
          <a href={placeUrl} className={`font-medium hover:underline ${dark ? "text-white/80" : "text-[#333]"}`}>
            펫라이프위드미에서 자세히 보기 →
          </a>
          <p className="mt-3">
            <a href={site} className="hover:underline">
              펫라이프위드미
            </a>
            {!paid && (
              <>
                {" · "}
                <a href={`${site}/portal/spot#register`} className="hover:underline">
                  내 업체도 링크 페이지 만들기
                </a>
              </>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return (
    <section className={`px-4 py-5 ${className}`}>
      <h2 className="mb-3 text-[15px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** 무료 갤러리 — 사진 최대 3장, 흰 디자인에 맞춘 작은 3열 */
function FreeGallery({ images, name }: { images: LinkPageData["media"]; name: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 border-b-8 border-[#f5f5f5] bg-white p-1">
      {images.map((m, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.id} src={assetUrl(m.objectKey)} alt={`${name} 사진 ${i + 1}`} loading={i ? "lazy" : undefined} className="aspect-square w-full rounded bg-[#eee] object-cover" />
      ))}
    </div>
  );
}

/** 유료 갤러리 — 큰 사진 1 + 옆 2, 나머지는 아래 3열 */
function Gallery({ images, name }: { images: LinkPageData["media"]; name: string }) {
  const src = (i: number) => assetUrl(images[i]?.objectKey);
  const rest = images.slice(1);
  const side = rest.slice(0, 2);
  const more = rest.slice(2);
  return (
    <div className="bg-black">
      <div className={`grid gap-0.5 ${side.length ? "grid-cols-[2fr_1fr]" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(0)} alt={`${name} 대표 사진`} className="h-[220px] w-full bg-[var(--lp-card)] object-cover" />
        {side.length > 0 && (
          <div className="grid gap-0.5" style={{ gridTemplateRows: `repeat(${side.length}, 1fr)` }}>
            {side.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={src(i + 1)} alt={`${name} 사진 ${i + 2}`} loading="lazy" className="h-full min-h-0 w-full bg-[var(--lp-card)] object-cover" />
            ))}
          </div>
        )}
      </div>
      {more.length > 0 && (
        <div className="mt-0.5 grid grid-cols-3 gap-0.5">
          {more.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={src(i + 3)} alt={`${name} 사진 ${i + 4}`} loading="lazy" className="aspect-square w-full bg-[var(--lp-card)] object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
