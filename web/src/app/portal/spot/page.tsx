import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, siteName } from "@/lib/config";

// service.petlifewith.me 가 이 페이지로 라우팅된다 (middleware).
// 사장님용 유틸리티 페이지라 색인하지 않는다 — 콘텐츠 SEO 는 메인 도메인에 집중.
export const metadata: Metadata = {
  title: "업체 정보 관리 — 사장님 페이지",
  robots: { index: false, follow: true },
};

const STEPS = [
  {
    title: "1. 내 업체가 이미 있는지 확인",
    body: "인허가 공공데이터로 기본 정보를 미리 등록해 둡니다. 지역 디렉토리에서 업체명을 찾아보세요.",
    link: { href: "/spot", label: "지역에서 내 업체 찾기 →" },
  },
  {
    title: "2. 있다면 — 정보 관리 요청",
    body: "업체 페이지의 \"정보 관리 요청(무료)\" 버튼으로 신청하면, 확인 후 운영시간·요금·예약 링크·카카오톡 채널 등을 반영해 드립니다.",
  },
  {
    title: "3. 없다면 — 등록 요청",
    body: "셀프목욕·방문목욕·재활처럼 인허가 데이터에 잡히지 않는 업종은 직접 등록해 드립니다. 아래 연락처로 업체명·주소·업종을 보내주세요.",
  },
];

export default function SpotPortalPage() {
  const email = contactEmail();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 사장님 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
        반려동물이 즐거운 곳이라면,
        <br />
        무료로 소개해 드립니다
      </h1>
      <p className="mt-4 text-ink-soft">
        스파·셀프목욕·수영장·놀이터·유치원·재활 시설을 다루는 디렉토리입니다. 기본 등록과 정보 관리는
        무료이고, 잘못된 정보 정정도 같은 창구로 받습니다.
      </p>

      <div className="mt-8 space-y-4">
        {STEPS.map((s) => (
          <section key={s.title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-bold text-ink">{s.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            {s.link && (
              <Link href={s.link.href} className="mt-3 inline-block text-sm font-medium text-sea hover:underline">
                {s.link.label}
              </Link>
            )}
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-sand/60 p-5 text-sm text-ink-soft">
        <h2 className="font-bold text-ink">관리할 수 있는 정보</h2>
        <p className="mt-1.5">
          운영시간 · 요금 · 주차 · 소개글 · 외부 링크(홈페이지, 카카오톡 채널, 예약, 네이버 플레이스,
          인스타그램). 정보가 채워질수록 검색 노출 대상이 됩니다.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          지역 상단 노출 등 광고 상품은 준비 중이며, 초기에는 무료로 운영합니다. 장묘 시설에는 광고를
          붙이지 않습니다.
        </p>
      </section>

      {email && (
        <p className="mt-8 text-sm text-ink-soft">
          등록·문의:{" "}
          <a className="font-medium text-ink underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      )}
    </div>
  );
}
