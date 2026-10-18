import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, siteName } from "@/lib/config";
import { listRegionOptions, listRegistrableSpotTypes } from "@/lib/queries/requests";
import { RegisterFlow } from "./register-flow";

// service.petlifewith.me 가 이 페이지로 라우팅된다 (middleware).
// 사장님용 유틸리티 페이지라 색인하지 않는다 — 콘텐츠 SEO 는 메인 도메인에 집중.
export const metadata: Metadata = {
  title: "내 업체 등록 — 사장님 페이지",
  robots: { index: false, follow: true },
};

// 업종·지역 선택지는 DB 에서 오므로 디렉토리와 같은 주기로 다시 만든다
export const revalidate = 21600; // REVALIDATE.spotDirectory

const ROUTES = [
  {
    title: "지역 상단에 노출하고 싶다면",
    body: "지역 페이지 상단 노출은 유료입니다(A·B·C 형). 요청을 남기면 운영자가 안내하고, 확인 후 노출을 켭니다.",
    link: { href: "/portal/promo", label: "지역 상단 노출 요청 →" },
  },
  {
    title: "펫시터 · 시간제 시터 · 도그워커라면",
    body: "시설이 아니라 활동 지역(시·군·구)으로 노출됩니다. 지역마다 5자리, 무료.",
    link: { href: "/portal/care", label: "돌봄 파트너 등록 →" },
  },
];

export default async function SpotPortalPage() {
  const email = contactEmail();
  const [types, regions] = await Promise.all([listRegistrableSpotTypes(), listRegionOptions()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 사장님 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
        업체 정보 등록,
        <br />
        생각보다 훨씬 간단해요
      </h1>
      <p className="mt-4 text-ink-soft">반려동물이 즐거운 곳이라면 무료로 소개해 드려요. 어려운 서류도, 긴 입력도 없어요.</p>

      {/* 시작 전 안심 — 짧고 큰 약속 세 가지 */}
      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        {[
          ["무료", "기본 등록·정보 관리·링크 페이지 모두 무료"],
          ["1분이면 끝", "연락처만 남기면 접수 — 나머지는 비워도 돼요"],
          ["가입 없이도", "로그인 없이 보내도 되고, 상담은 카카오톡으로"],
        ].map(([t, d]) => (
          <li key={t} className="rounded-2xl bg-sea-soft/70 px-4 py-3">
            <p className="text-base font-extrabold text-ink">{t}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-faint">보내 주시면 보통 1~2일 안에 운영자가 연락드려요. 확인되면 채널·예약·위치를 모은 무료 링크 페이지가 열려요.</p>

      <section className="mt-10" id="register" aria-label="업체 등록">
        {types.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-faint">지금은 등록 요청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
        ) : (
          <RegisterFlow types={types} regions={regions} />
        )}
      </section>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {ROUTES.map((s) => (
          <section key={s.title} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-sm font-bold text-ink">{s.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.body}</p>
            <Link href={s.link.href} className="mt-3 inline-block text-xs font-medium text-sea hover:underline">
              {s.link.label}
            </Link>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm text-ink-soft">
        <h2 className="font-bold text-ink">관리할 수 있는 정보</h2>
        <p className="mt-1.5">
          운영시간 · 요금 · 주차 · 소개글 · 외부 링크(홈페이지, 카카오톡 채널, 예약, 네이버 플레이스, 인스타그램). 정보가 채워질수록 검색 노출
          대상이 됩니다.
        </p>
        <p className="mt-3 text-xs text-ink-faint">유료 상품은 지역 상단 노출 하나이며, 장묘 시설에는 광고를 붙이지 않습니다.</p>
      </section>

      {email && (
        <p className="mt-8 text-sm text-ink-soft">
          그 밖의 문의:{" "}
          <a className="font-medium text-ink underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      )}
    </div>
  );
}
