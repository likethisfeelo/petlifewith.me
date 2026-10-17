"use client";

// CCTV 안내판 만들기 — 내장 도구 (뉴스 글 /news/cctv-sign 에 붙는다)
//  - 누구나: 템플릿·매장 정보·방향을 넣어 미리보기까지 (둘러보기)
//  - 회원만: 로고, PNG 저장, A4 인쇄, 문구 복사, 저장·불러오기(tool_saves) — 손님이 누르면 가입 안내 팝업
//    입력값은 이 브라우저에 임시로 남으므로 가입·로그인하고 돌아와도 이어서 쓸 수 있다
// 입력 중인 값은 이 브라우저에 임시로 남는다(저장 전 새로고침 대비). 저장하면 계정에 남는다.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentMember } from "@/components/member-menu";
import { track } from "@/components/tracker";
import { deleteToolSaveAction, listToolSavesAction, loadToolSaveAction, saveToolAction, type ToolSaveSummary } from "@/app/tool-actions";
import { LOGO_MAX_CHARS, parseSignData, type SignData } from "@/lib/tools/sign-data";
import { downloadData, printHtml } from "../html-tool-frame";
import { MembersOnlyPrompt } from "../members-only-prompt";
import {
  EMPTY_FIELDS,
  NO_RECORDING,
  REQUIRED,
  SIGN_FONT_CSS,
  SIGN_FONT_FACES,
  TEMPLATES,
  isValidPhone,
  paintSign,
  signDims,
  signText,
  type SignFields,
  type SignOrient,
  type SignTemplate,
} from "./draw";

const TOOL_KEY = "cctv-sign";
const DRAFT_KEY = "pl-cctv-sign-draft";

const FIELD_DEFS: Array<{ key: keyof SignFields; label: string; placeholder: string; required?: boolean; half?: boolean; hint?: string }> = [
  { key: "name", label: "상호", placeholder: "예: ○○펫" },
  { key: "purpose", label: "설치 목적", placeholder: "예: 동물 안전사고 예방 및 시설 안전 관리", required: true },
  { key: "place", label: "설치 장소", placeholder: "예: 동물 보호실·대기 공간 천장", required: true, half: true },
  { key: "range", label: "촬영 범위", placeholder: "예: 보호실 및 대기 공간 전체", required: true, half: true },
  { key: "time", label: "촬영 시간", placeholder: "예: 24시간 연속 촬영", required: true, half: true },
  { key: "owner", label: "관리책임자", placeholder: "예: 대표 (이름 대신 직책도 됩니다)", half: true },
  { key: "tel", label: "관리책임자 연락처", placeholder: "예: 02-123-4567", required: true },
  {
    key: "trustee",
    label: "수탁자 (선택)",
    placeholder: "예: ○○보안 02-000-0000",
    hint: "CCTV 설치·관리를 업체에 맡겼다면 업체 이름과 연락처를 적어야 합니다.",
  },
  { key: "extra", label: "추가 안내 (선택)", placeholder: "예: 영상 열람 문의는 카운터로 해 주세요" },
];

type LogoImage = HTMLImageElement | null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    img.src = src;
  });
}

/** 로고 파일 → 줄인 data: 주소 (긴 변 600px, 그래도 크면 더 줄인다) */
async function logoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("PNG·JPG·WEBP·SVG 이미지만 넣을 수 있습니다.");
  if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하 이미지만 넣을 수 있습니다.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || 600;
    const h0 = img.naturalHeight || 300;
    for (const max of [600, 420, 300, 200]) {
      const r = Math.min(1, max / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * r));
      c.height = Math.max(1, Math.round(h0 * r));
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      // 투명 배경을 살리려면 PNG, 사진 로고는 JPEG 가 훨씬 작다
      const png = c.toDataURL("image/png");
      const out = png.length <= LOGO_MAX_CHARS || file.type === "image/png" || file.type === "image/svg+xml" ? png : c.toDataURL("image/jpeg", 0.9);
      if (out.length <= LOGO_MAX_CHARS) return out;
    }
    throw new Error("로고 파일이 너무 복잡합니다. 더 단순한 이미지로 넣어 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readDraft(): SignData | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? parseSignData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: SignData) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // 저장 공간이 없어도 도구는 동작한다
  }
}

function useSignFonts(): number {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    if (!document.querySelector(`link[data-sign-fonts]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = SIGN_FONT_CSS;
      link.dataset.signFonts = "1";
      document.head.appendChild(link);
    }
    if (!document.fonts) return;
    let alive = true;
    void Promise.all(SIGN_FONT_FACES.map((f) => document.fonts.load(f).catch(() => null))).then(() => alive && setReady((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

const btn = "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40";
const btnSolid = `${btn} border-ink bg-ink text-cream hover:opacity-90`;
const btnGhost = `${btn} border-line bg-surface text-ink hover:bg-sand`;
const input = "w-full rounded-lg border border-line bg-cream px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none";

export function CctvSignTool() {
  const { loading, member } = useCurrentMember();
  const fontsReady = useSignFonts();
  if (loading) return <div className="h-[520px] animate-pulse rounded-2xl bg-sand/60" aria-busy="true" />;
  return <SignEditor fontsReady={fontsReady} member={Boolean(member)} />;
}

function SignEditor({ fontsReady, member }: { fontsReady: number; member: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRefs = useRef<Partial<Record<SignTemplate, HTMLCanvasElement | null>>>({});
  const [tpl, setTpl] = useState<SignTemplate>("cute");
  const [orient, setOrient] = useState<SignOrient>("port");
  const [fields, setFields] = useState<SignFields>(EMPTY_FIELDS);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<LogoImage>(null);
  const [status, setStatus] = useState("");
  const [saves, setSaves] = useState<ToolSaveSummary[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  /** 회원 전용 기능 — 손님이면 가입 안내 팝업을 띄우고 false */
  const membersOnly = (feature: string): boolean => {
    if (member) return true;
    setPrompt(feature);
    return false;
  };

  // 처음: 임시 저장본 → 저장 목록
  useEffect(() => {
    const d = readDraft();
    if (d) {
      setTpl(d.tpl);
      setOrient(d.orient);
      setFields(d.fields);
      setLogo(d.logo);
    }
    setRestored(true);
    if (member) void listToolSavesAction(TOOL_KEY).then((r) => r.ok && setSaves(r.value));
  }, [member]);

  useEffect(() => {
    let alive = true;
    if (!logo) {
      setLogoImg(null);
      return;
    }
    void loadImage(logo)
      .then((img) => alive && setLogoImg(img))
      .catch(() => alive && setLogoImg(null));
    return () => {
      alive = false;
    };
  }, [logo]);

  const data: SignData = useMemo(() => ({ v: 1, tpl, orient, fields, logo }), [tpl, orient, fields, logo]);

  useEffect(() => {
    if (restored) writeDraft(data);
  }, [data, restored]);

  // 미리보기
  useEffect(() => {
    if (canvasRef.current) paintSign(canvasRef.current, tpl, orient, fields, logoImg);
  }, [tpl, orient, fields, logoImg, fontsReady]);

  // 템플릿 썸네일 — 입력이 멈춘 뒤 다시 그린다
  useEffect(() => {
    const id = window.setTimeout(() => {
      const off = document.createElement("canvas");
      for (const k of Object.keys(TEMPLATES) as SignTemplate[]) {
        const t = thumbRefs.current[k];
        if (!t) continue;
        paintSign(off, k, orient, fields, logoImg);
        t.width = 160;
        t.height = orient === "land" ? 113 : 226;
        t.getContext("2d")?.drawImage(off, 0, 0, t.width, t.height);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [orient, fields, logoImg, fontsReady]);

  const missing = REQUIRED.filter(([k]) => !fields[k]);
  const telInvalid = Boolean(fields.tel) && !isValidPhone(fields.tel);
  const filename = `CCTV_안내판_${(fields.name || TEMPLATES[tpl].label).replace(/[^\w가-힣]/g, "")}_${orient === "land" ? "가로" : "세로"}`;

  const setField = (k: keyof SignFields, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setStatus("");
    try {
      setLogo(await logoDataUrl(file));
      setStatus("로고를 넣었습니다. 저장하면 다음에도 그대로 불러옵니다.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "로고를 넣지 못했습니다.");
    }
  };

  const downloadPng = () => {
    if (!membersOnly("이미지(PNG) 저장")) return;
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((b) => {
      if (!b) return;
      downloadData(`${filename}.png`, b);
      setStatus(`${filename}.png 을(를) 저장했습니다.`);
      track("tool_action", { kind: "download_png", tool: TOOL_KEY });
    }, "image/png");
  };

  const printA4 = () => {
    if (!membersOnly("A4 인쇄")) return;
    const c = canvasRef.current;
    if (!c) return;
    const land = orient === "land";
    const url = c.toDataURL("image/png");
    printHtml(
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${filename}</title><style>@page{size:A4 ${land ? "landscape" : "portrait"};margin:0}html,body{margin:0;padding:0}img{display:block;width:${land ? "297mm" : "210mm"};height:${land ? "210mm" : "297mm"}}</style></head><body><img src="${url}" alt="CCTV 안내판"></body></html>`,
    );
    setStatus("인쇄 창을 열었습니다. 용지는 A4, 배율은 100%(실제 크기)로 인쇄하세요.");
    track("tool_action", { kind: "print", tool: TOOL_KEY });
  };

  const copyText = () => {
    if (!membersOnly("문구 복사")) return;
    navigator.clipboard
      .writeText(signText(fields))
      .then(() => setStatus("문구를 복사했습니다."))
      .catch(() => setStatus("복사가 막혀 있습니다. 매장 정보 칸의 내용을 직접 복사하세요."));
  };

  const refreshSaves = useCallback(() => {
    void listToolSavesAction(TOOL_KEY).then((r) => r.ok && setSaves(r.value));
  }, []);

  const save = async (asNew: boolean) => {
    if (!membersOnly("안내판 저장")) return;
    setBusy(true);
    const r = await saveToolAction(TOOL_KEY, { id: asNew ? null : savedId, title: title || fields.name || "내 안내판", data });
    setBusy(false);
    if (!r.ok) return setStatus(r.error);
    setSavedId(r.value.id);
    setStatus("저장했습니다. 내 안내판 목록에서 언제든 다시 불러올 수 있습니다.");
    track("tool_action", { kind: "save", tool: TOOL_KEY });
    refreshSaves();
  };

  const load = async (s: ToolSaveSummary) => {
    setBusy(true);
    const r = await loadToolSaveAction(TOOL_KEY, s.id);
    setBusy(false);
    const d = r.ok ? parseSignData(r.value) : null;
    if (!d) return setStatus(r.ok ? "저장된 내용을 읽지 못했습니다." : r.error);
    setTpl(d.tpl);
    setOrient(d.orient);
    setFields(d.fields);
    setLogo(d.logo);
    setSavedId(s.id);
    setTitle(s.title);
    setStatus(`"${s.title}" 을(를) 불러왔습니다.`);
  };

  const remove = async (s: ToolSaveSummary) => {
    if (!window.confirm(`"${s.title}" 을(를) 지울까요?`)) return;
    const r = await deleteToolSaveAction(TOOL_KEY, s.id);
    if (!r.ok) return setStatus(r.error);
    if (savedId === s.id) setSavedId(null);
    refreshSaves();
  };

  const reset = () => {
    if (!window.confirm("입력한 내용을 모두 비울까요? (저장한 안내판은 지워지지 않습니다)")) return;
    setFields(EMPTY_FIELDS);
    setLogo(null);
    setSavedId(null);
    setTitle("");
  };

  const [W, H] = signDims(orient);

  return (
    <>
    {prompt && <MembersOnlyPrompt feature={prompt} onClose={() => setPrompt(null)} />}
    {!member && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sea/30 bg-sea-soft px-4 py-3 text-sm text-ink">
        <span>
          <strong>둘러보기 중</strong> — 미리보기까지는 누구나 쓸 수 있어요. 로고·이미지 저장·인쇄·저장은 회원가입 후 이용할 수 있습니다.
        </span>
        <Link href="/signup?next=%2Fnews%2Fcctv-sign" className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
          무료 회원가입
        </Link>
      </div>
    )}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <Box no="01" title="템플릿">
          <div className="grid grid-cols-3 gap-2.5">
            {(Object.keys(TEMPLATES) as SignTemplate[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTpl(k)}
                aria-pressed={tpl === k}
                className={`grid gap-1.5 rounded-lg border-2 p-1.5 text-center text-xs ${tpl === k ? "border-sea bg-sea/10 font-semibold text-ink" : "border-line bg-cream text-ink-soft"}`}
              >
                <canvas
                  ref={(el) => {
                    thumbRefs.current[k] = el;
                  }}
                  className="block h-auto w-full rounded"
                />
                {TEMPLATES[k].label}
              </button>
            ))}
          </div>
        </Box>

        <Box no="02" title="매장 정보">
          <div className="grid grid-cols-2 gap-3">
            {FIELD_DEFS.map((f) => (
              <label key={f.key} className={`grid gap-1 text-[13px] text-ink-soft ${f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}`}>
                <span>
                  {f.label}
                  {f.required && <span className="ml-1 font-mono text-[11px] text-sea">필수</span>}
                </span>
                <input
                  value={fields[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  maxLength={120}
                  inputMode={f.key === "tel" ? "tel" : undefined}
                  aria-invalid={f.key === "tel" && telInvalid ? true : undefined}
                  className={input}
                />
                {f.key === "tel" && telInvalid && <span className="text-xs text-accent-deep">전화번호 형식을 확인하세요 (예: 02-123-4567, 010-1234-5678)</span>}
                {f.hint && <span className="text-xs text-ink-faint">{f.hint}</span>}
              </label>
            ))}
          </div>
        </Box>

        <Box no="03" title="로고 (선택)">
          <div className="flex flex-wrap items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="넣은 로고" className="h-12 max-w-[8rem] rounded border border-line bg-white object-contain p-1" />
            )}
            {member ? (
              <label className={`${btnGhost} cursor-pointer`}>
                {logo ? "로고 바꾸기" : "로고 넣기"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => void onLogo(e.target.files?.[0])} />
              </label>
            ) : (
              <button type="button" onClick={() => membersOnly("로고 넣기")} className={btnGhost}>
                로고 넣기 <span className="ml-1 text-xs text-ink-faint">회원</span>
              </button>
            )}
            {logo && (
              <button type="button" onClick={() => setLogo(null)} className="text-sm text-ink-soft hover:underline">
                빼기
              </button>
            )}
          </div>
          <p className="text-xs text-ink-faint">안내판 오른쪽 위에 흰 바탕으로 들어갑니다. 배경이 투명한 PNG가 가장 깔끔합니다.</p>
        </Box>

        <Box no="04" title="방향">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label="용지 방향">
            {(
              [
                ["port", "세로 (A4)"],
                ["land", "가로 (A4)"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setOrient(v)} aria-pressed={orient === v} className={`px-4 py-2 ${orient === v ? "bg-ink font-medium text-cream" : "text-ink-soft"}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-faint">출입구 문에는 세로, 카운터 위 벽면에는 가로가 잘 보입니다.</p>
        </Box>
      </div>

      <div className="grid gap-3 lg:sticky lg:top-20">
        <div className="grid place-items-center rounded-xl border border-line bg-sand/50 p-4 sm:p-5">
          <canvas ref={canvasRef} className="h-auto max-h-[72vh] max-w-full bg-white shadow-lg" role="img" aria-label="CCTV 안내판 미리보기" />
        </div>
        <p className="font-mono text-xs text-ink-faint">
          {orient === "land" ? "A4 가로" : "A4 세로"} · {W}×{H}px (150dpi) · {TEMPLATES[tpl].label}
        </p>

        <ul className="grid gap-1 text-[13px]">
          {REQUIRED.map(([k, l]) => (
            <li key={k} className={fields[k] ? "text-ink-soft" : "font-medium text-accent-deep"}>
              {fields[k] ? "✓" : "!"} {fields[k] ? l : `${l}이(가) 비어 있습니다`}
            </li>
          ))}
          <li className="text-ink-soft">✓ {NO_RECORDING} (고정 문구)</li>
        </ul>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadPng} disabled={missing.length > 0} className={btnSolid} title={missing.length ? "필수 항목을 채우면 저장할 수 있습니다" : undefined}>
            이미지(PNG) 저장
          </button>
          <button type="button" onClick={printA4} disabled={missing.length > 0} className={btnGhost}>
            A4 인쇄
          </button>
          <button type="button" onClick={copyText} className={btnGhost}>
            문구 복사
          </button>
        </div>
        {missing.length > 0 && <p className="text-xs text-ink-faint">필수 항목을 모두 채우면 이미지 저장과 인쇄가 켜집니다.</p>}

        <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-bold text-ink">내 안내판</p>
          <div className="flex flex-wrap gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이름 (예: 1층 출입구용)" maxLength={60} className={`${input} basis-full`} />
            <button type="button" onClick={() => void save(false)} disabled={busy} className={btnSolid}>
              {savedId ? "덮어쓰기" : "저장"}
            </button>
            {savedId && (
              <button type="button" onClick={() => void save(true)} disabled={busy} className={btnGhost}>
                새로 저장
              </button>
            )}
          </div>
          {!member ? (
            <p className="text-xs text-ink-faint">로그인하면 만든 안내판을 매장별·위치별로 저장해 두고 다시 불러올 수 있어요.</p>
          ) : saves.length === 0 ? (
            <p className="text-xs text-ink-faint">저장한 안내판이 없습니다. 매장별·위치별로 여러 개 저장할 수 있습니다(최대 20개).</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {saves.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <button type="button" onClick={() => void load(s)} disabled={busy} className={`min-w-0 flex-1 truncate text-left hover:underline ${savedId === s.id ? "font-semibold text-ink" : "text-ink-soft"}`}>
                    {s.title}
                  </button>
                  <span className="shrink-0 text-xs text-ink-faint">{new Date(s.updatedAt).toLocaleDateString("ko-KR")}</span>
                  <button type="button" onClick={() => void remove(s)} className="shrink-0 text-xs text-ink-faint hover:text-accent-deep">
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={reset} className="justify-self-start text-xs text-ink-faint hover:underline">
            새 안내판 (입력 비우기)
          </button>
        </div>

        <p className="min-h-[1.4em] text-[13px] text-ink-soft" aria-live="polite">
          {status}
        </p>
        <p className="text-xs leading-relaxed text-ink-faint">
          공개 자료를 정리한 도구이며 법률 자문이 아닙니다. CCTV 는 녹음 기능을 사용할 수 없으므로(개인정보보호법 제25조 제5항) 모든 템플릿에 &quot;녹음하지 않음&quot; 문구가 고정으로 들어갑니다.
        </p>
      </div>
    </div>
    </>
  );
}

function Box({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
      <h3 className="flex items-baseline gap-2 text-[15px] font-bold text-ink">
        <span className="font-mono text-xs text-sea">{no}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
