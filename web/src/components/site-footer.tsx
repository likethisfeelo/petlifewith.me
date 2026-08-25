import Link from "next/link";
import { contactEmail, siteName, siteTagline } from "@/lib/config";

export function SiteFooter() {
  const email = contactEmail();
  return (
    <footer className="mt-16 border-t border-line bg-sand/50">
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-ink-soft">
        <p className="font-semibold text-ink">{siteName()}</p>
        <p className="mt-0.5 text-xs text-ink-faint">{siteTagline()}</p>
        <p className="mt-2 max-w-2xl">
          어디에 데려갈 수 있는지가 아니라, 무엇이 즐거운지를 다룹니다. 주어는 사람이 아니라 반려동물입니다.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="font-medium text-ink">콘텐츠</p>
            <ul className="mt-2 space-y-1">
              <li><Link className="hover:text-ink" href="/topic/senior-life">노견생활</Link></li>
              <li><Link className="hover:text-ink" href="/topic/play">놀이</Link></li>
              <li><Link className="hover:text-ink" href="/curation">크리에이터 큐레이션</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">디렉토리</p>
            <ul className="mt-2 space-y-1">
              <li><Link className="hover:text-ink" href="/spot">스팟 — 가는 곳</Link></li>
              <li><Link className="hover:text-ink" href="/maker">메이커 — 만드는 곳</Link></li>
              <li><Link className="hover:text-ink" href="/portal/spot">업체 관리 (사장님)</Link></li>
              <li><Link className="hover:text-ink" href="/portal/product">브랜드·제품 등록</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">정보 안내</p>
            <ul className="mt-2 space-y-1">
              <li>시설 정보는 공공데이터(data.go.kr)와 직접 확인을 바탕으로 하며, 데이터 기준일을 페이지에 표기합니다.</li>
              {email ? (
                <li>
                  잘못된 정보 정정 요청:{" "}
                  <a className="underline hover:text-ink" href={`mailto:${email}`}>{email}</a>
                </li>
              ) : (
                <li>잘못된 정보는 각 장소 페이지의 정정 요청으로 알려주세요.</li>
              )}
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-line pt-4 text-xs text-ink-faint">
          © {new Date().getFullYear()} {siteName()}. 의료 정보가 아닌 생활 정보를 다루며, 진단·치료는 동물병원과
          상의하세요.
        </p>
      </div>
    </footer>
  );
}
