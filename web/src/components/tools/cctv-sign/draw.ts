// CCTV 안내판 그리기 — 캔버스 전용 순수 함수 (원본: 사장님 브리핑 "CCTV 안내판 만들기" HTML 도구)
// A4 150dpi (1240×1754 / 가로 1754×1240). 템플릿 3종: 귀여운·깔끔한·어두운 배경.
// 바뀐 점: 수탁자(설치·관리 위탁) 행, 로고 자리(오른쪽 위, 흰 받침), 빈 칸은 "—"

export type SignTemplate = "cute" | "clean" | "dark";
export type SignOrient = "port" | "land";

export interface SignFields {
  name: string;
  purpose: string;
  place: string;
  range: string;
  time: string;
  owner: string;
  tel: string;
  trustee: string;
  extra: string;
}

export const EMPTY_FIELDS: SignFields = { name: "", purpose: "", place: "", range: "", time: "", owner: "", tel: "", trustee: "", extra: "" };

/** 손님에게 보여 주는 예시 — 실제 매장 값처럼 보이지 않게 ○○ 로 쓴다 */
export const EXAMPLE_FIELDS: SignFields = {
  name: "○○펫",
  purpose: "동물 안전사고 예방 및 시설 안전 관리",
  place: "동물 보호실·대기 공간 천장",
  range: "보호실 및 대기 공간 전체",
  time: "24시간 연속 촬영",
  owner: "대표 ○○○",
  tel: "02-000-0000",
  trustee: "",
  extra: "영상 열람 문의는 카운터로 해 주세요",
};

export const TEMPLATES: Record<SignTemplate, { label: string }> = {
  cute: { label: "귀여운" },
  clean: { label: "깔끔한" },
  dark: { label: "어두운 배경" },
};

/** 법정 기재사항 (개인정보보호법 제25조 제4항) */
export const REQUIRED: Array<[keyof SignFields, string]> = [
  ["purpose", "설치 목적"],
  ["place", "설치 장소"],
  ["range", "촬영 범위"],
  ["time", "촬영 시간"],
  ["tel", "관리책임자 연락처"],
];

export const NO_RECORDING = "본 CCTV는 녹음 기능을 사용하지 않습니다";

/** 연락처 — 지역번호·휴대전화·대표번호(1588-0000) */
export function isValidPhone(tel: string): boolean {
  const t = tel.replace(/\s/g, "");
  return /^(0\d{1,2}-?\d{3,4}-?\d{4}|1[5-9]\d{2}-?\d{4})$/.test(t);
}

export function signRows(v: SignFields): Array<[keyof SignFields, string]> {
  const rows: Array<[keyof SignFields, string]> = [
    ["purpose", "설치 목적"],
    ["place", "설치 장소"],
    ["range", "촬영 범위"],
    ["time", "촬영 시간"],
    ["owner", "관리책임자"],
    ["tel", "연락처"],
  ];
  if (v.trustee) rows.push(["trustee", "수탁자"]);
  return rows;
}

export function signDims(orient: SignOrient): [number, number] {
  return orient === "land" ? [1754, 1240] : [1240, 1754];
}

export function signText(v: SignFields): string {
  return (
    "CCTV 설치·운영 안내\n" +
    signRows(v)
      .map(([k, l]) => `${l}: ${v[k] || ""}`)
      .join("\n") +
    "\n" +
    (v.name ? `${v.name} · ` : "") +
    NO_RECORDING +
    (v.extra ? `\n${v.extra}` : "")
  );
}

type Ctx = CanvasRenderingContext2D;

const SANS = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function rr(x: Ctx, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}

function wrap(x: Ctx, t: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of t) {
    const n = line + ch;
    if (x.measureText(n).width > maxW && line) {
      out.push(line);
      line = ch;
    } else line = n;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

function camera(x: Ctx, cx: number, cy: number, s: number, col: string) {
  x.save();
  x.translate(cx, cy);
  x.fillStyle = col;
  rr(x, -1.0 * s, -0.45 * s, 1.45 * s, 0.9 * s, 0.16 * s);
  x.fill();
  x.beginPath();
  x.moveTo(0.45 * s, -0.18 * s);
  x.lineTo(1.0 * s, -0.42 * s);
  x.lineTo(1.0 * s, 0.42 * s);
  x.lineTo(0.45 * s, 0.18 * s);
  x.closePath();
  x.fill();
  x.fillRect(-0.55 * s, 0.45 * s, 0.18 * s, 0.4 * s);
  x.fillRect(-0.85 * s, 0.8 * s, 0.78 * s, 0.14 * s);
  x.restore();
}

function paw(x: Ctx, cx: number, cy: number, s: number, col: string, rot = 0) {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(0, 0.25 * s, 0.42 * s, 0.36 * s, 0, 0, Math.PI * 2);
  x.fill();
  for (const p of [
    [-0.42, -0.22, 0.15, 0.2],
    [-0.15, -0.48, 0.15, 0.21],
    [0.15, -0.48, 0.15, 0.21],
    [0.42, -0.22, 0.15, 0.2],
  ] as const) {
    x.beginPath();
    x.ellipse(p[0] * s, p[1] * s, p[2] * s, p[3] * s, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
}

interface RowsOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
  min: number;
  labW: number;
  gap: number;
  rowPad: number;
  labFont: string;
  labW8: string;
  valFont: string;
  valW8: string;
  labCol: string;
  valCol: string;
  labInset?: number;
  sep?: string;
  labPill?: (x: Ctx, X: number, cy: number, w: number, f: number) => void;
}

/** 이름/값 행 묶음 — 상자에 맞을 때까지 글자를 줄인다 */
function rowsBlock(x: Ctx, v: SignFields, o: RowsOpts) {
  const rows = signRows(v);
  let fs = o.fs;
  const lab = o.labW;
  const gap = o.gap;
  const measure = (f: number) => {
    x.font = `${o.valW8} ${f}px ${o.valFont}`;
    let h = 0;
    const lay = rows.map(([k]) => {
      const L = wrap(x, v[k] || "—", o.w - lab - gap);
      h += L.length * f * 1.35 + o.rowPad * 2;
      return L;
    });
    return { h, lay };
  };
  let m = measure(fs);
  while (m.h > o.h && fs > o.min) {
    fs -= 2;
    m = measure(fs);
  }
  const extra = Math.max(0, Math.min(fs * 0.6, (o.h - m.h) / (rows.length * 2)));
  const pad = o.rowPad + extra;
  let y = o.y + Math.max(0, (o.h - m.h - extra * rows.length * 2) / 2);
  rows.forEach(([, l], i) => {
    const L = m.lay[i]!;
    const rh = L.length * fs * 1.35 + pad * 2;
    x.textBaseline = "middle";
    x.textAlign = "left";
    x.font = `${o.labW8} ${Math.round(fs * 0.92)}px ${o.labFont}`;
    if (o.labPill) o.labPill(x, o.x, y + pad + fs * 0.68, lab, fs);
    x.fillStyle = o.labCol;
    x.font = `${o.labW8} ${Math.round(fs * (l.length > 4 ? 0.82 : 0.92))}px ${o.labFont}`;
    x.fillText(l, o.x + (o.labInset ?? 0), y + pad + fs * 0.68);
    x.fillStyle = o.valCol;
    x.font = `${o.valW8} ${fs}px ${o.valFont}`;
    L.forEach((ln, j) => x.fillText(ln, o.x + lab + gap, y + pad + fs * 0.68 + j * fs * 1.35));
    y += rh;
    if (o.sep && i < rows.length - 1) {
      x.fillStyle = o.sep;
      x.fillRect(o.x, y - 1, o.w, 2);
    }
  });
}

function centerText(x: Ctx, t: string, cx: number, y: number, size: number, font: string, col: string, maxW: number) {
  x.font = font;
  x.fillStyle = col;
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  wrap(x, t, maxW)
    .slice(0, 2)
    .forEach((ln, i) => x.fillText(ln, cx, y + i * size * 1.3));
}

/** 로고 — 오른쪽 위, 흰 받침 위에 비율 유지로 넣는다 (모든 템플릿에서 제목·카메라와 겹치지 않는 자리) */
function drawLogo(x: Ctx, logo: CanvasImageSource & { width: number; height: number }, right: number, top: number, s: number) {
  const boxW = 230 * s;
  const boxH = 120 * s;
  const pad = 14 * s;
  const ratio = Math.min((boxW - pad * 2) / logo.width, (boxH - pad * 2) / logo.height);
  const w = logo.width * ratio;
  const h = logo.height * ratio;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  x.save();
  x.fillStyle = "#FFFFFF";
  rr(x, right - bw, top, bw, bh, 16 * s);
  x.fill();
  x.drawImage(logo, right - bw + pad, top + pad, w, h);
  x.restore();
}

type Logo = (CanvasImageSource & { width: number; height: number }) | null;

function drawCute(x: Ctx, W: number, H: number, v: SignFields, logo: Logo) {
  const s = Math.min(W, H) / 1240;
  const land = W > H;
  x.fillStyle = "#FFE9DC";
  x.fillRect(0, 0, W, H);
  for (const p of [
    [0.08, 0.06, 0.5],
    [0.92, 0.1, -0.4],
    [0.06, 0.94, 0.3],
    [0.93, 0.92, -0.6],
    [0.5, 0.97, 0.1],
  ] as const)
    paw(x, p[0] * W, p[1] * H, 70 * s, "rgba(232,140,104,0.35)", p[2]);
  const m = 60 * s;
  x.fillStyle = "#FFFFFF";
  rr(x, m, m, W - 2 * m, H - 2 * m, 70 * s);
  x.fill();
  x.lineWidth = 12 * s;
  x.strokeStyle = "#F0A07E";
  x.stroke();
  if (logo) drawLogo(x, logo, W - m - 50 * s, m + 40 * s, s);
  const top = m + (land ? 70 : 110) * s;
  x.fillStyle = "#FFD8C4";
  x.beginPath();
  x.arc(W / 2, top + 70 * s, 80 * s, 0, Math.PI * 2);
  x.fill();
  camera(x, W / 2 + 8 * s, top + 66 * s, 52 * s, "#B85A3A");
  paw(x, W / 2 + 70 * s, top + 125 * s, 26 * s, "#E8875F", 0.4);
  const t1 = Math.round(96 * s);
  centerText(x, "CCTV 촬영 중이에요", W / 2, top + (land ? 230 : 250) * s, t1, `${t1}px Jua, ${SANS}`, "#5B3424", W - 4 * m);
  const t2 = Math.round(40 * s);
  centerText(x, "우리 친구들이 안전하게 지내도록 지켜보고 있어요", W / 2, top + (land ? 300 : 330) * s, t2, `${t2}px Jua, ${SANS}`, "#C2683F", W - 4 * m);
  const by = top + (land ? 350 : 400) * s;
  const bh = H - by - m - (land ? 150 : 210) * s;
  rowsBlock(x, v, {
    x: m + 70 * s,
    y: by,
    w: W - 2 * m - 140 * s,
    h: bh,
    fs: Math.round((land ? 44 : 54) * s),
    min: Math.round(26 * s),
    labW: 310 * s,
    gap: 24 * s,
    rowPad: 14 * s,
    labFont: `Jua, ${SANS}`,
    labW8: "400",
    valFont: SANS,
    valW8: "500",
    labCol: "#8A3F22",
    valCol: "#3E2A20",
    labInset: 28 * s,
    labPill: (x2, X, cy, w, f) => {
      x2.fillStyle = "#FFE2D2";
      const ph = f * 1.55;
      rr(x2, X, cy - ph / 2, w - 10 * s, ph, ph / 2);
      x2.fill();
    },
  });
  const fy = H - m - (land ? 95 : 130) * s;
  const f1 = Math.round(34 * s);
  centerText(x, (v.name ? `${v.name} · ` : "") + NO_RECORDING, W / 2, fy, f1, `500 ${f1}px ${SANS}`, "#8A5A44", W - 4 * m);
  const f2 = Math.round(32 * s);
  if (v.extra) centerText(x, v.extra, W / 2, fy + 52 * s, f2, `${f2}px Jua, ${SANS}`, "#C2683F", W - 4 * m);
}

function drawClean(x: Ctx, W: number, H: number, v: SignFields, logo: Logo) {
  const s = Math.min(W, H) / 1240;
  const land = W > H;
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, W, H);
  const band = (land ? 300 : 420) * s;
  x.fillStyle = "#0F6655";
  x.fillRect(0, 0, W, band);
  camera(x, land ? 150 * s : W / 2, land ? band / 2 : 150 * s, 60 * s, "#FFFFFF");
  if (logo) drawLogo(x, logo, W - 40 * s, 40 * s, s);
  x.textAlign = land ? "left" : "center";
  x.textBaseline = "alphabetic";
  x.fillStyle = "#FFFFFF";
  x.font = `700 ${Math.round(88 * s)}px ${SANS}`;
  x.fillText("CCTV 설치·운영 안내", land ? 270 * s : W / 2, land ? band / 2 + 10 * s : 300 * s);
  x.font = `500 ${Math.round(30 * s)}px ${MONO}`;
  x.fillStyle = "rgba(255,255,255,0.75)";
  x.fillText("VIDEO SURVEILLANCE NOTICE", land ? 272 * s : W / 2, land ? band / 2 + 62 * s : 360 * s);
  const m = 100 * s;
  const by = band + 70 * s;
  const bh = H - by - (land ? 190 : 240) * s;
  rowsBlock(x, v, {
    x: m,
    y: by,
    w: W - 2 * m,
    h: bh,
    fs: Math.round((land ? 44 : 54) * s),
    min: Math.round(26 * s),
    labW: 270 * s,
    gap: 30 * s,
    rowPad: 22 * s,
    labFont: SANS,
    labW8: "700",
    valFont: SANS,
    valW8: "400",
    labCol: "#0F6655",
    valCol: "#1A2320",
    sep: "#D3DBD6",
  });
  const fy = H - (land ? 120 : 150) * s;
  x.fillStyle = "#1A2320";
  x.fillRect(m, fy - 70 * s, W - 2 * m, 3 * s);
  const f1 = Math.round(32 * s);
  centerText(x, (v.name ? `${v.name} · ` : "") + NO_RECORDING, W / 2, fy, f1, `500 ${f1}px ${SANS}`, "#1A2320", W - 2 * m);
  const f2 = Math.round(30 * s);
  if (v.extra) centerText(x, v.extra, W / 2, fy + 48 * s, f2, `400 ${f2}px ${SANS}`, "#5A6762", W - 2 * m);
}

function drawDark(x: Ctx, W: number, H: number, v: SignFields, logo: Logo) {
  const s = Math.min(W, H) / 1240;
  const land = W > H;
  x.fillStyle = "#14181B";
  x.fillRect(0, 0, W, H);
  const st = 46 * s;
  x.save();
  x.beginPath();
  x.rect(0, 0, W, st);
  x.rect(0, H - st, W, st);
  x.clip();
  x.fillStyle = "#FFC93C";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#14181B";
  for (let i = -H; i < W + H; i += 70 * s) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 35 * s, 0);
    x.lineTo(i + 35 * s + H, H);
    x.lineTo(i + H, H);
    x.closePath();
    x.fill();
  }
  x.restore();
  if (logo) drawLogo(x, logo, W - 50 * s, st + 36 * s, s);
  const top = st + (land ? 70 : 110) * s;
  camera(x, W / 2, top + 60 * s, 62 * s, "#FFC93C");
  x.fillStyle = "#FF5A4E";
  x.beginPath();
  x.arc(W / 2 + 120 * s, top + 20 * s, 14 * s, 0, Math.PI * 2);
  x.fill();
  x.font = `500 ${Math.round(28 * s)}px ${MONO}`;
  x.fillStyle = "#FF5A4E";
  x.textAlign = "left";
  x.textBaseline = "alphabetic";
  x.fillText("REC", W / 2 + 144 * s, top + 30 * s);
  const t1 = Math.round(120 * s);
  centerText(x, "CCTV 작동 중", W / 2, top + (land ? 230 : 250) * s, t1, `${t1}px "Black Han Sans", ${SANS}`, "#FFC93C", W - 160 * s);
  const t2 = Math.round(30 * s);
  centerText(x, "VIDEO SURVEILLANCE IN OPERATION", W / 2, top + (land ? 290 : 320) * s, t2, `500 ${t2}px ${MONO}`, "#8E9AA1", W - 160 * s);
  const m = 110 * s;
  const by = top + (land ? 340 : 390) * s;
  const bh = H - by - st - (land ? 150 : 200) * s;
  rowsBlock(x, v, {
    x: m,
    y: by,
    w: W - 2 * m,
    h: bh,
    fs: Math.round((land ? 44 : 54) * s),
    min: Math.round(26 * s),
    labW: 270 * s,
    gap: 30 * s,
    rowPad: 20 * s,
    labFont: SANS,
    labW8: "700",
    valFont: SANS,
    valW8: "400",
    labCol: "#FFC93C",
    valCol: "#F1F3F4",
    sep: "#2C343A",
  });
  const fy = H - st - (land ? 90 : 120) * s;
  const f1 = Math.round(32 * s);
  centerText(x, (v.name ? `${v.name} · ` : "") + NO_RECORDING, W / 2, fy, f1, `500 ${f1}px ${SANS}`, "#F1F3F4", W - 2 * m);
  const f2 = Math.round(30 * s);
  if (v.extra) centerText(x, v.extra, W / 2, fy + 48 * s, f2, `400 ${f2}px ${SANS}`, "#8E9AA1", W - 2 * m);
}

const DRAW: Record<SignTemplate, (x: Ctx, W: number, H: number, v: SignFields, logo: Logo) => void> = {
  cute: drawCute,
  clean: drawClean,
  dark: drawDark,
};

export function paintSign(canvas: HTMLCanvasElement, tpl: SignTemplate, orient: SignOrient, v: SignFields, logo: Logo) {
  const [W, H] = signDims(orient);
  canvas.width = W;
  canvas.height = H;
  const x = canvas.getContext("2d");
  if (!x) return;
  DRAW[tpl](x, W, H, v, logo);
}

/** 안내판 웹폰트 — 처음 그리기 전에 받아 둔다 (없으면 시스템 글꼴로 그린다) */
export const SIGN_FONT_CSS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&family=Jua&family=Black+Han+Sans&display=swap";
export const SIGN_FONT_FACES = ['400 40px Jua', '400 40px "Black Han Sans"', '500 40px "IBM Plex Sans KR"', '700 40px "IBM Plex Sans KR"', '500 20px "IBM Plex Mono"'];
