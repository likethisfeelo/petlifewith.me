"use client";

// 링크 페이지 편집 — 관리자 스팟 편집 화면과 사장님 /me/business/spot/[id] 가 같이 쓴다.
// 관리자만: 공개·유료 기간·소유자 지정·삭제. 짧은 주소·사진·영상은 관리자 또는 유료 기간 중의 사장님.
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSpotMediaAction, deleteSpotPageAction, moveSpotMediaAction, removeSpotMediaAction, saveSpotPageAction, type SpotPageActionState } from "@/app/spot-page-actions";
import { uploadMediaFile } from "@/lib/media-upload";

export interface EditorMedia {
  id: number;
  kind: "image" | "video";
  url?: string;
  posterUrl?: string;
}

export interface EditorStats {
  monthViews: number;
  monthClicks: number;
  totalViews: number;
  totalClicks: number;
  days: Array<{ day: string; views: number; clicks: number }>;
}

interface Props {
  spotId: number;
  admin: boolean;
  monetizable: boolean;
  paidActive: boolean;
  linkUrl: string | null;
  page: {
    published: boolean;
    handle: string | null;
    intro: string | null;
    services: string[];
    paidFrom: string | null;
    paidUntil: string | null;
  } | null;
  media: EditorMedia[];
  stats: EditorStats | null;
  mediaLimit: number;
}

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-sea focus:outline-none";
const label = "mb-1 block text-xs font-semibold text-ink-soft";

export function SpotPageEditor({ spotId, admin, monetizable, paidActive, linkUrl, page, media, stats, mediaLimit }: Props) {
  const [state, action, pending] = useActionState<SpotPageActionState, FormData>(saveSpotPageAction, {});
  // 짧은 주소는 사장님만 여기서 (관리자는 유료 상품 칸에서)
  const canHandle = !admin && monetizable && paidActive;
  const canMedia = !!page && (admin || (monetizable && paidActive));

  if (!page && !admin) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">
          {admin ? "링크 페이지 내용" : "링크 페이지"}{" "}
          {page && (
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${paidActive ? "bg-ink text-cream" : "bg-sea-soft text-sea"}`}>
              {paidActive ? "프리미엄" : page.published ? "무료" : "비공개"}
            </span>
          )}
        </h2>
        {linkUrl && page?.published && (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-sea hover:underline">
            {linkUrl.replace(/^https?:\/\//, "")} ↗
          </a>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        채널·예약·위치를 한 장에 모은 페이지입니다. 인스타그램 프로필·명함·카카오톡 채널에 주소를 걸어 두세요.
        {!paidActive && monetizable && !admin && " 프리미엄은 짧은 주소, 사진·영상(각 10개), 어두운 디자인이 추가됩니다."}
        {admin && " 프리미엄 기간·짧은 주소는 위 \"유료 상품\" 칸에서 정합니다."}
      </p>

      {stats && page && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["이번 달 조회", stats.monthViews],
            ["이번 달 클릭", stats.monthClicks],
            ["전체 조회", stats.totalViews],
            ["전체 클릭", stats.totalClicks],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-cream px-3 py-2">
              <p className="text-[11px] text-ink-faint">{k}</p>
              <p className="text-lg font-bold text-ink">{Number(v).toLocaleString("ko-KR")}</p>
            </div>
          ))}
          {stats.days.length > 0 && <StatBars days={stats.days} />}
        </div>
      )}

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="spotId" value={spotId} />
        {admin && (
          <div className="grid gap-3 rounded-xl bg-cream p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
              <input type="checkbox" name="published" defaultChecked={page?.published ?? true} />
              공개 (끄면 링크 페이지가 열리지 않고 목록에서도 미등록으로 보입니다)
            </label>
            <div className="sm:col-span-2">
              <span className={label}>소유자 지정 (회원 이메일)</span>
              <input type="email" name="ownerEmail" placeholder="비워 두면 그대로 — 소유자 없이도 페이지를 만들 수 있습니다" className={input} />
            </div>
          </div>
        )}

        {canHandle && (
          <div>
            <span className={label}>짧은 주소 (프리미엄)</span>
            <input name="handle" defaultValue={page?.handle ?? ""} placeholder="예: masterpet" className={input} />
            <p className="mt-1 text-[11px] text-ink-faint">영문 소문자·숫자·하이픈 3~30자. 프리미엄 기간에만 쓰이고, 끝나면 번호 주소로 돌아갑니다.</p>
          </div>
        )}

        <div>
          <span className={label}>업체 소개 (한 문단)</span>
          <textarea name="intro" rows={3} maxLength={600} defaultValue={page?.intro ?? ""} placeholder="비우면 장소 설명의 첫 문단을 씁니다." className={input} />
        </div>
        <div>
          <span className={label}>주요 서비스 (한 줄에 하나, 최대 12개)</span>
          <textarea name="services" rows={4} defaultValue={page?.services.join("\n") ?? ""} placeholder={"반려동물 전문 이동\n동물병원 동행\n공항 픽업"} className={input} />
        </div>
        <p className="text-[11px] text-ink-faint">주소·영업시간·연락처·채널 링크는 업체 정보에서 고치면 링크 페이지에도 같이 바뀝니다.</p>

        {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        {state.saved && <p className="rounded-lg bg-sage-soft px-3 py-2 text-sm text-sage-deep">저장했습니다.</p>}
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:opacity-90 disabled:opacity-50">
          {pending ? "저장 중…" : page ? "링크 페이지 저장" : "링크 페이지 만들기"}
        </button>
      </form>

      {canMedia && (
        <div className="mt-6 space-y-5 border-t border-line pt-5">
          {!paidActive && <p className="text-xs text-honey">유료 기간이 아니라 공개 페이지에는 아직 보이지 않습니다 (미리 올려 둘 수 있습니다).</p>}
          <MediaGroup spotId={spotId} kind="image" items={media.filter((m) => m.kind === "image")} limit={mediaLimit} />
          <MediaGroup spotId={spotId} kind="video" items={media.filter((m) => m.kind === "video")} limit={mediaLimit} />
        </div>
      )}

      {admin && page && (
        <form
          action={deleteSpotPageAction}
          className="mt-6 border-t border-line pt-4"
          onSubmit={(e) => {
            if (!confirm("링크 페이지를 삭제할까요? 사진·영상 연결도 함께 지워집니다.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="spotId" value={spotId} />
          <button type="submit" className="text-xs font-medium text-rose-600 hover:underline">
            링크 페이지 삭제
          </button>
        </form>
      )}
    </section>
  );
}

function StatBars({ days }: { days: EditorStats["days"] }) {
  const ordered = [...days].reverse();
  const top = Math.max(1, ...ordered.map((d) => d.views));
  return (
    <div className="col-span-2 rounded-xl bg-cream px-3 py-2 sm:col-span-4">
      <p className="text-[11px] text-ink-faint">최근 30일 조회</p>
      <div className="mt-1 flex h-12 items-end gap-0.5">
        {ordered.map((d) => (
          <div key={d.day} title={`${d.day} 조회 ${d.views} · 클릭 ${d.clicks}`} className="flex-1 rounded-t bg-sea/70" style={{ height: `${Math.max(4, (d.views / top) * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}

function MediaGroup({ spotId, kind, items, limit }: { spotId: number; kind: "image" | "video"; items: EditorMedia[]; limit: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const name = kind === "image" ? "사진" : "영상";

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, limit - items.length);
    for (const [i, f] of list.entries()) {
      try {
        setBusy(`${name} 올리는 중 ${i + 1}/${list.length}`);
        const up = await uploadMediaFile(f);
        if (up.kind !== kind) throw new Error(`${name} 칸에는 ${name}만 올릴 수 있습니다.`);
        const r = await addSpotMediaAction({ spotId, objectKey: up.objectKey });
        if (r.error) throw new Error(r.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
        break;
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    start(() => router.refresh());
  }

  async function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    const r = await fn();
    if (r.error) setError(r.error);
    start(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">
          {name} <span className="font-normal text-ink-faint">{items.length}/{limit}</span>
        </h3>
        {items.length < limit && (
          <label className="cursor-pointer rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:bg-sand">
            {busy ?? `${name} 추가`}
            <input ref={fileRef} type="file" className="hidden" multiple accept={kind === "image" ? "image/*" : "video/mp4,video/webm,video/quicktime"} disabled={!!busy} onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {items.length > 0 ? (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-lg border border-line bg-sand">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="aspect-square w-full object-cover" />
              ) : m.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.posterUrl} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <video src={m.url} muted preload="metadata" className="aspect-square w-full object-cover" />
              )}
              <div className="flex items-center justify-between px-1 py-1 text-xs">
                <span className="flex gap-0.5">
                  <button type="button" disabled={i === 0} onClick={() => run(() => moveSpotMediaAction({ spotId, id: m.id, dir: -1 }))} className="rounded px-1 hover:bg-cream disabled:opacity-30" aria-label="앞으로">
                    ←
                  </button>
                  <button type="button" disabled={i === items.length - 1} onClick={() => run(() => moveSpotMediaAction({ spotId, id: m.id, dir: 1 }))} className="rounded px-1 hover:bg-cream disabled:opacity-30" aria-label="뒤로">
                    →
                  </button>
                </span>
                <button type="button" onClick={() => confirm(`이 ${name}을 뺄까요?`) && run(() => removeSpotMediaAction({ spotId, id: m.id }))} className="rounded px-1 text-rose-600 hover:bg-cream">
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">{kind === "image" ? "첫 번째 사진이 대표 사진이 됩니다." : "mp4·webm 영상을 올려 주세요."}</p>
      )}
    </div>
  );
}
