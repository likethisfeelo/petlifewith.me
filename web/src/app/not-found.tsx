import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24 text-center">
      <p className="text-sm font-semibold text-accent-deep">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-ink-soft">주소가 바뀌었거나 아직 만들어지지 않은 페이지예요.</p>
      <div className="mt-8 flex justify-center gap-3 text-sm font-medium">
        <Link href="/" className="rounded-full bg-ink px-4 py-2 text-cream hover:opacity-90">
          홈으로
        </Link>
        <Link href="/spot" className="rounded-full border border-line bg-surface px-4 py-2 text-ink hover:bg-sand">
          스팟 디렉토리
        </Link>
      </div>
    </div>
  );
}
