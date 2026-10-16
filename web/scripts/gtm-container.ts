// GTM 컨테이너 가져오기 파일 생성 — docs/gtm/petlife-gtm-container.json
// 이벤트 목록·파라미터는 src/lib/tracking.ts 하나에서 온다. 바꾸면 다시 실행:
//   ../data/node_modules/.bin/tsx scripts/gtm-container.ts   (web 폴더에서)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GTM_PARAM_KEYS, gtmEventRegex } from "../src/lib/tracking";

const MEASUREMENT_ID = "G-54XBW1L9KE";
const ids = { account: "0", container: "0" };
const base = { accountId: ids.account, containerId: ids.container };
const t = (key: string, value: string) => ({ type: "TEMPLATE", key, value });

const variables = GTM_PARAM_KEYS.map((key, i) => ({
  ...base,
  variableId: String(100 + i),
  name: `DLV - ${key}`,
  type: "v",
  parameter: [{ type: "INTEGER", key: "dataLayerVersion", value: "2" }, { type: "BOOLEAN", key: "setDefaultValue", value: "false" }, t("name", key)],
}));

const triggers = [
  { ...base, triggerId: "10", name: "petlife - 초기화 (모든 페이지)", type: "INIT" },
  {
    ...base,
    triggerId: "11",
    name: "petlife - GA4 이벤트 목록",
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type: "MATCH_REGEX", parameter: [t("arg0", "{{_event}}"), t("arg1", gtmEventRegex())] }],
  },
];

const tags = [
  {
    ...base,
    tagId: "1",
    name: "petlife - Google 태그 (GA4, 페이지뷰는 이벤트로)",
    type: "googtag",
    parameter: [
      t("tagId", MEASUREMENT_ID),
      { type: "LIST", key: "configSettingsTable", list: [{ type: "MAP", map: [t("parameter", "send_page_view"), t("parameterValue", "false")] }] },
    ],
    firingTriggerId: ["10"],
    tagFiringOption: "ONCE_PER_EVENT",
  },
  {
    ...base,
    tagId: "2",
    name: "petlife - GA4 이벤트 (공통)",
    type: "gaawe",
    parameter: [
      { type: "BOOLEAN", key: "sendEcommerceData", value: "false" },
      t("eventName", "{{Event}}"),
      t("measurementIdOverride", MEASUREMENT_ID),
      {
        type: "LIST",
        key: "eventSettingsTable",
        list: GTM_PARAM_KEYS.map((key) => ({ type: "MAP", map: [t("parameter", key), t("parameterValue", `{{DLV - ${key}}}`)] })),
      },
    ],
    firingTriggerId: ["11"],
    tagFiringOption: "ONCE_PER_EVENT",
  },
];

const container = {
  exportFormatVersion: 2,
  exportTime: "2026-10-16 00:00:00",
  containerVersion: {
    ...base,
    containerVersionId: "0",
    container: { ...base, name: "petlifewith.me", publicId: "GTM-TH2GC5MP", usageContext: ["WEB"] },
    tag: tags,
    trigger: triggers,
    variable: variables,
    builtInVariable: [{ ...base, type: "EVENT", name: "Event" }],
  },
};

const out = resolve(__dirname, "../../docs/gtm/petlife-gtm-container.json");
writeFileSync(out, `${JSON.stringify(container, null, 2)}\n`);
console.log(`wrote ${out}`);
