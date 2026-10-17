// ============================================================
// 뉴스 글에 붙는 "도구" — 순수 함수·목록 (data/src/db/schema.ts newsPosts)
//
// 두 가지 방식
//  1) 내장 도구(tool_key): 사이트 코드로 만든 도구. 로그인·저장·로고 등 사이트 기능을 쓸 수 있다
//     (web/src/components/tools). 회원 결과물은 tool_saves 에 남는다.
//  2) HTML 도구(tool_html): 관리자가 올린 HTML 한 장. 공개 페이지에서 sandbox iframe 으로만 띄운다.
//     allow-same-origin 을 주지 않으므로 사이트 쿠키·localStorage·DOM 에 손댈 수 없다.
//     대신 아래 브리지 스크립트를 앞에 넣어 높이 맞춤·인쇄·파일 저장·브라우저 저장을 부모 페이지가 대신 한다.
// ============================================================

export interface BuiltinTool {
  key: string;
  label: string;
  /** 회원만 쓸 수 있다 — 손님에게는 예시와 로그인 안내만 보인다 */
  membersOnly: boolean;
  /** top: 글 본문보다 먼저(제목 바로 아래) — 읽는 글이 아니라 바로 쓰는 도구 */
  placement?: "top";
  description: string;
}

export const BUILTIN_TOOLS: readonly BuiltinTool[] = [
  {
    key: "cctv-sign",
    label: "CCTV 안내판 만들기",
    membersOnly: true,
    description: "법정 기재사항을 넣은 CCTV 안내판(A4). 템플릿 3종, 로고, 저장·불러오기",
  },
  {
    key: "petsegwon",
    label: "펫세권 분석 (업장 1곳당 반려견 수)",
    membersOnly: false,
    placement: "top",
    description: "시도·시군구·업종을 고르면 업장 1곳당 등록 반려견 수를 평균과 비교. 아래에 뉴스레터 구독·회원가입 안내",
  },
];

export function builtinTool(key: string | null | undefined): BuiltinTool | null {
  return BUILTIN_TOOLS.find((t) => t.key === key) ?? null;
}

export const NEWS_CATEGORIES = [
  { value: "news", label: "뉴스" },
  { value: "briefing", label: "사장님 브리핑" },
  { value: "tool", label: "도구" },
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number]["value"];

export function newsCategoryLabel(value: string): string {
  return NEWS_CATEGORIES.find((c) => c.value === value)?.label ?? "뉴스";
}

export function isNewsCategory(value: string): value is NewsCategory {
  return NEWS_CATEGORIES.some((c) => c.value === value);
}

/** HTML 도구 크기 상한 — DB 한 행에 넣을 수 있고, 페이지가 무거워지지 않을 만큼 */
export const TOOL_HTML_MAX_BYTES = 300_000;

/** sandbox 속성 — allow-same-origin 은 절대 넣지 않는다(넣으면 sandbox 가 무의미해진다) */
export const TOOL_IFRAME_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms allow-top-navigation-by-user-activation";

/** 부모 ↔ iframe 메시지 표시 */
export const TOOL_BRIDGE_TAG = "pl-tool";

/**
 * iframe 안에 먼저 심는 브리지 — 업로드 HTML 은 고치지 않고 앞에만 붙인다.
 *  - localStorage: 불투명 출처라 원래 쓸 수 없다 → 메모리 저장소로 바꾸고 바뀔 때마다 부모에게 보낸다(부모가 글별로 보관)
 *  - window.petlife.print(html) / download(filename, data) — 부모 페이지가 인쇄·저장한다
 *  - 높이: 문서 높이를 부모에게 계속 알린다(iframe 은 스크롤하지 않는다)
 *  - 같은 문서 안 #링크: iframe 이 스크롤하지 않으므로 부모 페이지를 그 위치로 스크롤한다
 *  - window.petlife.member: 로그인한 회원인지 (부모가 알려 준다, 처음엔 null). 바뀌면 document 에 "petlife:member" 이벤트
 *    (인쇄·파일 저장은 회원만 — 손님이면 부모가 가입 안내 팝업을 띄운다)
 *  - window.petlife.requestInfo({email|phone, topic}) → Promise<{ok, error?}> — 요청함(자료 요청)에 저장·슬랙 알림
 * initial 은 부모가 보관하던 값(JSON). </script> 가 끼지 않게 이스케이프한다.
 */
export function toolBridgeScript(initial: Record<string, string>): string {
  const json = JSON.stringify(initial).replace(/</g, "\\u003c");
  return `<script>(function(){
var T=${JSON.stringify(TOOL_BRIDGE_TAG)},P=window.parent;
function send(m){m.tag=T;try{P.postMessage(m,"*")}catch(e){}}
var data=${json};
var mem={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(data,k)?data[k]:null},
setItem:function(k,v){data[String(k)]=String(v);send({type:"storage",data:data})},
removeItem:function(k){delete data[String(k)];send({type:"storage",data:data})},
clear:function(){data={};send({type:"storage",data:data})},
key:function(i){return Object.keys(data)[i]||null}};
Object.defineProperty(mem,"length",{get:function(){return Object.keys(data).length}});
try{Object.defineProperty(window,"localStorage",{value:mem,configurable:true})}catch(e){}
var seq=0,waits={};
window.petlife={member:null,print:function(html){send({type:"print",html:String(html)})},
download:function(name,d){send({type:"download",filename:String(name),data:String(d)})},
requestInfo:function(o){o=o||{};var id=++seq;return new Promise(function(res){waits[id]=res;
send({type:"info_request",id:id,email:String(o.email||""),phone:String(o.phone||""),topic:String(o.topic||"")});
setTimeout(function(){if(waits[id]){delete waits[id];res({ok:false,error:"응답이 없습니다. 잠시 후 다시 시도해 주세요."})}},20000)})}};
window.addEventListener("message",function(e){if(e.source!==P)return;var m=e.data;if(!m||m.tag!==T)return;
if(m.type==="member"){window.petlife.member=!!m.member;try{document.dispatchEvent(new CustomEvent("petlife:member",{detail:!!m.member}))}catch(x){}}
if(m.type==="info_result"&&waits[m.id]){var r=waits[m.id];delete waits[m.id];r({ok:!!m.ok,error:m.error?String(m.error):undefined})}});
send({type:"ready"});
var last=0;function h(){var v=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));if(v!==last){last=v;send({type:"height",height:v})}}
window.addEventListener("load",h);
if(window.ResizeObserver)new ResizeObserver(h).observe(document.documentElement);else setInterval(h,500);
document.addEventListener("click",function(ev){setTimeout(h,50);
var a=ev.target&&ev.target.closest?ev.target.closest('a[href^="#"]'):null;if(!a)return;
var id=a.getAttribute("href").slice(1),el=id?document.getElementById(id):null;if(!el)return;
ev.preventDefault();send({type:"scroll",y:Math.round(el.getBoundingClientRect().top+window.scrollY)})});
})();</script>`;
}

/**
 * 어두운 모드 끄기 — 사이트는 밝은 화면만 쓴다. 업로드 HTML 의 `(prefers-color-scheme: dark)` 조건을
 * 절대 맞지 않는 조건으로 바꿔, 방문자 기기가 어두운 모드여도 검은 바탕·흰 글자 테마가 켜지지 않게 한다.
 * (iframe 의 color-scheme 은 다른 출처(sandbox) 문서에 전달되지 않아 CSS 만으로는 막을 수 없다)
 */
export function forceLightScheme(html: string): string {
  return html.replace(/\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi, "(prefers-color-scheme: dark) and (max-width: 0px)");
}

/** iframe srcdoc — 어두운 모드를 끄고, 브리지를 맨 앞(<head> 안 또는 문서 앞)에 넣는다 */
export function buildToolSrcDoc(rawHtml: string, initial: Record<string, string> = {}): string {
  const html = forceLightScheme(rawHtml);
  const bridge = toolBridgeScript(initial);
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + bridge + html.slice(head.index + head[0].length);
  return bridge + html;
}

/** 부모가 받는 메시지 검사 — 모양이 다르면 무시한다 */
export type ToolBridgeMessage =
  | { type: "height"; height: number }
  | { type: "scroll"; y: number }
  | { type: "storage"; data: Record<string, string> }
  | { type: "print"; html: string }
  | { type: "download"; filename: string; data: string }
  | { type: "ready" }
  | { type: "info_request"; id: number; email: string; phone: string; topic: string };

export function parseToolMessage(raw: unknown): ToolBridgeMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.tag !== TOOL_BRIDGE_TAG) return null;
  switch (m.type) {
    case "height":
      return typeof m.height === "number" && Number.isFinite(m.height) ? { type: "height", height: Math.min(Math.max(m.height, 100), 20000) } : null;
    case "scroll":
      return typeof m.y === "number" && Number.isFinite(m.y) ? { type: "scroll", y: Math.max(0, m.y) } : null;
    case "storage": {
      if (!m.data || typeof m.data !== "object") return null;
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(m.data as Record<string, unknown>)) if (typeof v === "string") data[k] = v;
      return JSON.stringify(data).length <= 100_000 ? { type: "storage", data } : null;
    }
    case "print":
      return typeof m.html === "string" && m.html.length <= 2_000_000 ? { type: "print", html: m.html } : null;
    case "download": {
      if (typeof m.filename !== "string" || typeof m.data !== "string" || m.data.length > 10_000_000) return null;
      return { type: "download", filename: safeFilename(m.filename), data: m.data };
    }
    case "ready":
      return { type: "ready" };
    case "info_request": {
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
      if (typeof m.id !== "number" || !Number.isSafeInteger(m.id)) return null;
      return { type: "info_request", id: m.id, email: str(m.email, 100), phone: str(m.phone, 40), topic: str(m.topic, 200) };
    }
    default:
      return null;
  }
}

/** 저장 파일 이름 — 경로 문자·제어 문자 제거 */
export function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120);
  return cleaned || "download";
}
