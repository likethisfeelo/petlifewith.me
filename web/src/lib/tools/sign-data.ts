// CCTV 안내판 저장 데이터 검사 — 서버 액션(app/tool-actions.ts)과 도구 화면이 같이 쓴다.
import { EMPTY_FIELDS, TEMPLATES, type SignFields, type SignOrient, type SignTemplate } from "@/components/tools/cctv-sign/draw";

export interface SignData {
  v: 1;
  tpl: SignTemplate;
  orient: SignOrient;
  fields: SignFields;
  /** 로고 — 브라우저에서 줄인 PNG/JPEG data: 주소 (캔버스가 오염되지 않게 외부 주소는 쓰지 않는다) */
  logo: string | null;
}

/** 로고 data: 주소 상한 (줄인 뒤 기준) */
export const LOGO_MAX_CHARS = 400_000;
const FIELD_MAX = 120;
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function parseSignData(raw: unknown): SignData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tpl = typeof r.tpl === "string" && r.tpl in TEMPLATES ? (r.tpl as SignTemplate) : null;
  const orient = r.orient === "land" || r.orient === "port" ? r.orient : null;
  if (!tpl || !orient) return null;
  const src = r.fields && typeof r.fields === "object" ? (r.fields as Record<string, unknown>) : {};
  const fields = { ...EMPTY_FIELDS };
  for (const k of Object.keys(EMPTY_FIELDS) as Array<keyof SignFields>) {
    const v = src[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string" || v.length > FIELD_MAX) return null;
    fields[k] = v.trim();
  }
  let logo: string | null = null;
  if (r.logo !== undefined && r.logo !== null) {
    if (typeof r.logo !== "string" || r.logo.length > LOGO_MAX_CHARS || !LOGO_RE.test(r.logo)) return null;
    logo = r.logo;
  }
  return { v: 1, tpl, orient, fields, logo };
}
