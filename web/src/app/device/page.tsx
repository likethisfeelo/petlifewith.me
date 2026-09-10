// 관리·재활 도구 허브 — 주어는 기기다. 기기 → 본사 → 대리점 → 지역별 체험 가능 업체로 이어진다 (claude.md 6-2).
// 병원 목록이 아니라 기기 목록이다. 보유 병원은 기기 페이지 안에서 무료·순위 없이만 싣는다.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AdLabel, MedicalNotice } from "@/components/notices";
import { SpotTypeIcon } from "@/components/spot-type-banners";
import { assetUrl } from "@/lib/assets";
import { contactEmail } from "@/lib/config";
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_BLURB, DEVICE_CATEGORY_LABEL, isDeviceCategory } from "@/lib/devices";
import { formatNumber } from "@/lib/format";
import { countPublishedDevicesByCategory, listFeaturedDevices, listPublishedDevices, type DeviceCard } from "@/lib/queries/devices";
import { buildMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string }> }): Promise<Metadata> {
  const { category } = await searchParams;
  const cat = isDeviceCategory(category) ? category : null;
  const devices = await listPublishedDevices(cat);
  return buildMeta({
    title: cat ? `${DEVICE_CATEGORY_LABEL[cat]} — 관리·재활 도구` : "관리·재활 도구 — 기기부터 체험 가능한 곳까지",
    description:
      "노령견의 관절·근력·일상 관리에 쓰이는 기기를 원리 그대로 정리하고, 만든 곳(본사)·대리점·직접 써 볼 수 있는 지역 업체까지 이어 줍니다. 효과를 단정하지 않고 사실만 적습니다.",
    path: cat ? `/device?category=${cat}` : "/device",
    indexable: devices.length >= 3,
  });
}

function DeviceItem({ d, ad = false }: { d: DeviceCard; ad?: boolean }) {
  return (
    <li className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-sea/60">
      <div className="flex gap-3">
        <Link href={`/device/${encodeURIComponent(d.slug)}`} aria-label={d.name} className="shrink-0">
          {assetUrl(d.imageKey) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(d.imageKey)} alt="" className="h-16 w-16 rounded-xl bg-sand object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-sea-soft text-sea">
              <SpotTypeIcon slug={d.category === "monitor" ? "monitor" : d.category === "rehab_equipment" ? "rehab" : "device"} className="h-7 w-7" />
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{DEVICE_CATEGORY_LABEL[d.category]}</span>
            {d.homeUse && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">집에서 사용</span>}
            {ad && <AdLabel />}
          </div>
          <Link href={`/device/${encodeURIComponent(d.slug)}`} className="mt-1 block text-base font-bold text-ink hover:underline">
            {d.name}
          </Link>
          {d.makerName && <span className="mt-0.5 block text-xs text-ink-soft">{d.makerName}</span>}
          {d.priceText && <span className="mt-0.5 block text-xs font-medium text-ink">{d.priceText}</span>}
        </div>
      </div>
      {d.summaryExcerpt && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">{d.summaryExcerpt}</p>}
      <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-[11px] text-ink-faint">
        {d.trialCount > 0 && <span>체험 가능 {d.trialCount}곳</span>}
        {d.hospitalCount > 0 && <span>보유 병원 {d.hospitalCount}곳</span>}
        {d.guideCount > 0 && <span>관련 글 {d.guideCount}편</span>}
      </p>
    </li>
  );
}

export default async function DeviceHubPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const cat = isDeviceCategory(category) ? category : null;
  const [devices, featured, counts] = await Promise.all([listPublishedDevices(cat), cat ? Promise.resolve([]) : listFeaturedDevices(), countPublishedDevicesByCategory()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const email = contactEmail();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "노견생활", path: "/topic/senior-life" }, { name: "관리·재활 도구", path: "/device" }]} />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          관리·재활 도구 — <span className="text-sea">무엇이고, 어디서 써 볼 수 있나</span>
        </h1>
        <p className="mt-3 text-ink-soft">
          수중 러닝머신부터 집에서 쓰는 활동량 측정까지, 기기를 원리 그대로 정리합니다. 기기마다 만든 곳(본사)과 대리점, 직접 써 볼 수 있는 지역 업체,
          그 기기를 다룬 글을 한 자리에 모았습니다. 효과를 단정하지 않고, 어떤 목적으로 쓰이는지까지만 적습니다.
        </p>
        <p className="mt-2 text-sm text-ink-faint">공개된 기기 {formatNumber(total)}개 · 순위·평점 없이 가나다순</p>
      </header>

      <nav aria-label="분류" className="mt-6 flex flex-wrap gap-1.5 text-xs">
        <Link href="/device" className={`rounded-full px-3 py-1.5 font-medium ${!cat ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
          전체 {total > 0 ? total : ""}
        </Link>
        {DEVICE_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || c === cat).map((c) => (
          <Link
            key={c}
            href={`/device?category=${c}`}
            title={DEVICE_CATEGORY_BLURB[c]}
            className={`rounded-full px-3 py-1.5 font-medium ${cat === c ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}
          >
            {DEVICE_CATEGORY_LABEL[c]} {counts[c] ?? ""}
          </Link>
        ))}
      </nav>

      {featured.length > 0 && (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft/40 p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-extrabold text-ink">주목 기기</h2>
            <AdLabel />
          </div>
          <p className="mt-1 text-xs text-ink-soft">운영자가 고정한 자리입니다. 광고 표기와 함께 두고, 순위나 추천으로 읽히지 않게 사실만 적습니다.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {featured.map((d) => (
              <DeviceItem key={d.id} d={d} ad />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-ink">
          {cat ? DEVICE_CATEGORY_LABEL[cat] : "기기 전체"} {devices.length > 0 ? `${devices.length}개` : ""}
        </h2>
        {cat && <p className="mt-1 text-sm text-ink-soft">{DEVICE_CATEGORY_BLURB[cat]}</p>}
        {devices.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 정리된 기기가 없습니다. 직접 확인한 것부터 하나씩 채웁니다.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {devices.map((d) => (
              <DeviceItem key={d.id} d={d} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
          <h2 className="font-bold text-ink">운동·재활 시설을 찾으시나요?</h2>
          <p className="mt-1 text-ink-soft">장비를 갖춘 곳을 지도에서 지역별로 봅니다.</p>
          <Link href="/spot/type/rehab" className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream hover:opacity-90">
            운동·재활 지도 →
          </Link>
        </div>
        <div className="rounded-2xl border border-line bg-sand/60 p-5 text-sm">
          <h2 className="font-bold text-ink">기기를 만들거나 취급하시나요?</h2>
          <p className="mt-1 text-ink-soft">
            제품 정보·대리점·체험 가능 업체 등록은 무료입니다. 콘텐츠 협찬(광고 표기)은 따로 안내드립니다.
          </p>
          {email && (
            <a href={`mailto:${email}`} className="mt-3 inline-block rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sand">
              {email}
            </a>
          )}
        </div>
      </section>

      <div className="mt-8">
        <MedicalNotice />
      </div>
    </div>
  );
}
