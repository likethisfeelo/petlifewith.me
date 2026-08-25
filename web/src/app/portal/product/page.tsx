import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, siteName } from "@/lib/config";

// product.petlifewith.me 가 이 페이지로 라우팅된다 (middleware).
export const metadata: Metadata = {
  title: "브랜드·제품 등록 — 사장님 페이지",
  robots: { index: false, follow: true },
};

export default function ProductPortalPage() {
  const email = contactEmail();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-honey">{siteName()} 사장님 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
        직접 만드는 브랜드를
        <br />
        콘텐츠로 소개합니다
      </h1>
      <p className="mt-4 text-ink-soft">
        간식·장난감·용품 <strong>메이커 디렉토리</strong>는 광고 지면이 아니라 제휴·협업의 입구입니다.
        검색 상위에 잡히지 않는 작은 브랜드일수록 좋습니다. 소개된 제품은 글에 개체 단위로 태깅되어
        &ldquo;이 제품이 언급된 글&rdquo; 페이지가 자동으로 만들어집니다.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold text-ink">소개 기준 — 전부 공개되어 있습니다</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>제조 주체가 분명한가 (직접 제조 — 단순 사입·리브랜딩은 제외)</li>
          <li>성분·소재 정보를 공개하는가</li>
          <li>간식이라면 사료제조업 등록·성분등록이 확인되는가 — 확인되면 공적 데이터 기반 배지가 붙습니다</li>
          <li>만든 이유와 과정에 실체가 있는가</li>
        </ul>
        <p className="mt-3 text-xs text-ink-faint">
          배지는 평가·인증이 아니라 등록 사실의 확인 표기이며, 확인 기준일을 함께 표시합니다. 브랜드
          프로필에 대표자 개인명·상세 주소는 표시하지 않습니다.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold text-ink">진행 방법</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            이미 소개된 브랜드라면 —{" "}
            <Link href="/maker" className="font-medium text-honey hover:underline">
              메이커 디렉토리
            </Link>
            에서 내 브랜드 페이지의 &ldquo;정보 관리 요청&rdquo;으로 신청
          </li>
          <li>처음이라면 — 아래 연락처로 브랜드명·판매 채널 링크·간단한 소개를 보내주세요</li>
          <li>선정 기준 확인 후 프로필·제품 등록과 콘텐츠 소개를 진행합니다 (협찬 콘텐츠에는 광고 표기)</li>
        </ol>
      </section>

      {email && (
        <p className="mt-8 text-sm text-ink-soft">
          등록·제휴 문의:{" "}
          <a className="font-medium text-ink underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      )}
    </div>
  );
}
