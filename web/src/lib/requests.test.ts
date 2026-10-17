import { describe, expect, it } from "vitest";
import { validateInfoRequest, validateNewsletter, slackRequestText, validateCarePartner, validatePromoSlot, validateRequester, validateSpotRegister } from "./requests";

const base = { requesterName: "김사장", contact: "010-1234-5678", consent: "on" };

describe("요청 공통 검증", () => {
  it("이름·연락처·동의가 있어야 하고 봇 함정은 조용히 거절", () => {
    expect(validateRequester(base)).toMatchObject({ ok: true, value: { requesterName: "김사장", bizRegistrationNo: null } });
    expect(validateRequester({ ...base, website: "http://spam" }).ok).toBe(false);
    expect(validateRequester({ ...base, consent: "" })).toMatchObject({ ok: false });
    expect(validateRequester({ ...base, contact: "x" })).toMatchObject({ ok: false });
    expect(validateRequester({ ...base, bizRegistrationNo: "123-45-67890", message: " 안녕 " })).toMatchObject({ ok: true, value: { bizRegistrationNo: "123-45-67890", message: "안녕" } });
  });
});

describe("종류별 검증", () => {
  it("업체 등록: 업체명·업종·지역 필수, 링크는 https", () => {
    const ok = validateSpotRegister({ businessName: "멍멍수영장", typeSlug: "pool", regionId: "12", homepage: "https://a.b" }, ["pool", "cafe"]);
    expect(ok).toMatchObject({ ok: true, value: { typeSlug: "pool", regionId: 12, website: "https://a.b", phone: null } });
    expect(validateSpotRegister({ businessName: "멍", typeSlug: "pool", regionId: "1" }, ["pool"]).ok).toBe(false);
    // 업체 정보는 모두 비워도 된다 (상담 때 받는다)
    expect(validateSpotRegister({}, ["pool"])).toMatchObject({ ok: true, value: { businessName: null, typeSlug: null, regionId: null } });
    expect(validateSpotRegister({ businessName: "멍멍", typeSlug: "pet-sitter", regionId: "1" }, ["pool"]).ok).toBe(false);
    expect(validateSpotRegister({ businessName: "멍멍", typeSlug: "pool", regionId: "1", kakaoUrl: "pf.kakao.com/x" }, ["pool"])).toMatchObject({ ok: false });
  });
  it("돌봄 파트너: 호칭·활동명·지역(최대 5)·소개 10자", () => {
    const ok = validateCarePartner({ typeSlug: "dog-walk", displayName: "산책하는 지영", regionIds: "3,3,5", intro: "매일 아침 두 시간 산책 동행합니다" }, ["pet-sitter", "dog-walk"]);
    expect(ok).toMatchObject({ ok: true, value: { regionIds: [3, 5] } });
    expect(validateCarePartner({ typeSlug: "dog-walk", displayName: "지영", regionIds: "1,2,3,4,5,6", intro: "열 글자 넘는 소개입니다" }, ["dog-walk"]).ok).toBe(false);
    expect(validateCarePartner({ typeSlug: "dog-walk", displayName: "지영", regionIds: "", intro: "열 글자 넘는 소개입니다" }, ["dog-walk"]).ok).toBe(false);
  });
  it("유료 노출: 형 필수, 기존 업체가 없으면 업체명 필수", () => {
    expect(validatePromoSlot({ plan: "b", regionId: "7" }, true)).toMatchObject({ ok: true, value: { plan: "b", regionId: 7, businessName: null } });
    expect(validatePromoSlot({ plan: "b" }, false).ok).toBe(false);
    expect(validatePromoSlot({ plan: "z", businessName: "가게" }, false).ok).toBe(false);
  });
});

describe("슬랙 문구", () => {
  it("종류·요약·담당자·링크를 담고 내용은 한 줄로 자른다", () => {
    const text = slackRequestText({ id: 7, kind: "care_partner", requesterName: "지영", contact: "kakao:jy", summary: ["도그워커 · 산책하는 지영", "지역: 서울 마포구, 서대문구"], message: "아침\n\n산책", adminUrl: "https://x/admin/requests" });
    expect(text.split("\n")).toEqual(["📮 요청함 #7 · 돌봄 파트너 등록", "• 도그워커 · 산책하는 지영", "• 지역: 서울 마포구, 서대문구", "• 담당자: 지영 / kakao:jy", "• 내용: 아침 산책", "→ https://x/admin/requests"]);
  });
});

describe("자료 요청 (이메일 또는 전화번호 하나)", () => {
  it("둘 다 넣거나 둘 다 비우면 거부한다", () => {
    expect(validateInfoRequest({ email: "a@b.co", phone: "010-1234-5678" }).ok).toBe(false);
    expect(validateInfoRequest({}).ok).toBe(false);
  });
  it("이메일은 소문자로, 전화는 숫자만 남긴다", () => {
    expect(validateInfoRequest({ email: " Me@Shop.KR ", topic: "CCTV", source: "/news/cctv-checklist" })).toEqual({
      ok: true,
      value: { contactType: "email", contact: "me@shop.kr", topic: "CCTV", source: "/news/cctv-checklist" },
    });
    const r = validateInfoRequest({ phone: "010 1234-5678" });
    expect(r.ok && r.value.contact).toBe("01012345678");
  });
  it("형식이 틀리면 거부하고, 이상한 출처 경로는 버린다", () => {
    expect(validateInfoRequest({ email: "nope" }).ok).toBe(false);
    expect(validateInfoRequest({ phone: "12345" }).ok).toBe(false);
    const r = validateInfoRequest({ email: "a@b.co", source: "https://evil.example" });
    expect(r.ok && r.value.source).toBe("");
  });
});

describe("validateNewsletter", () => {
  it("이메일·동의가 있어야 한다", () => {
    expect(validateNewsletter({ email: "A@B.co", agree: true, topic: "펫세권", source: "/news/petsegwon" })).toEqual({
      ok: true,
      value: { email: "a@b.co", topic: "펫세권", source: "/news/petsegwon" },
    });
    expect(validateNewsletter({ email: "", agree: true }).ok).toBe(false);
    expect(validateNewsletter({ email: "nope", agree: true }).ok).toBe(false);
    expect(validateNewsletter({ email: "a@b.co", agree: false }).ok).toBe(false);
    expect(validateNewsletter({ email: "a@b.co", agree: "true" }).ok).toBe(false);
  });
  it("출처 주소는 사이트 경로만", () => {
    const r = validateNewsletter({ email: "a@b.co", agree: true, source: "https://evil.example" });
    expect(r.ok && r.value.source).toBe("");
  });
});
