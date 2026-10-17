import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GSC_HISTORY_DAYS, addDays, gscConfigFromEnv, gscWindow, pagePath, planDays, serviceAccountJwt } from "./sync.js";

const today = new Date("2026-10-17T05:00:00Z");

describe("Search Console 보관 — 날짜 계획", () => {
  it("3일 전까지, 16개월 범위", () => {
    const { oldest, newest } = gscWindow(today);
    expect(newest).toBe("2026-10-14");
    expect(addDays(oldest, GSC_HISTORY_DAYS - 3)).toBe(newest);
  });

  it("처음엔 최근 5일 + 빈 날짜를 최신부터 maxDays 개", () => {
    const { days, remainingMissing } = planDays(new Set(), today, { maxDays: 10, refreshDays: 5 });
    expect(days.slice(0, 5)).toEqual(["2026-10-14", "2026-10-13", "2026-10-12", "2026-10-11", "2026-10-10"]);
    expect(days).toHaveLength(15);
    expect(days[5]).toBe("2026-10-09");
    expect(remainingMissing).toBe(GSC_HISTORY_DAYS - 3 + 1 - 15);
  });

  it("이미 받은 날은 최근 5일만 다시 받는다", () => {
    const { oldest, newest } = gscWindow(today);
    const have = new Set<string>();
    for (let d = newest; d >= oldest; d = addDays(d, -1)) have.add(d);
    const plan = planDays(have, today, { maxDays: 120, refreshDays: 5 });
    expect(plan.days).toHaveLength(5);
    expect(plan.remainingMissing).toBe(0);
  });
});

describe("Search Console 보관 — 변환·인증", () => {
  it("페이지는 경로만 남긴다", () => {
    expect(pagePath("https://petlifewith.me/place/abc?x=1")).toBe("/place/abc?x=1");
    expect(pagePath("https://petlifewith.me/")).toBe("/");
  });

  it("env 의 \\n 줄바꿈을 되돌리고, 없으면 꺼진다", () => {
    expect(gscConfigFromEnv({})).toBeNull();
    const cfg = gscConfigFromEnv({ GSC_CLIENT_EMAIL: "a@b.iam.gserviceaccount.com", GSC_PRIVATE_KEY: '"-----BEGIN-----\\nabc\\n-----END-----"' });
    expect(cfg?.privateKey).toBe("-----BEGIN-----\nabc\n-----END-----");
    expect(cfg?.siteUrl).toBe("https://petlifewith.me/");
  });

  it("서비스 계정 JWT 는 RS256 으로 검증된다", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = serviceAccountJwt({ clientEmail: "svc@x.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), siteUrl: "" }, 1000);
    const [h, c, s] = jwt.split(".");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s!, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
    expect(claims).toMatchObject({ iss: "svc@x.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/webmasters.readonly", exp: 4600 });
  });
});
