import { describe, expect, it } from "vitest";
import { slackRequestText, validateCarePartner, validateExpertPartner, validatePromoSlot, validateRequester, validateSpotRegister } from "./requests";

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

describe("validateExpertPartner", () => {
  it("종류·활동명·방식·소개", () => {
    const ok = validateExpertPartner({ expertKind: "trainer", displayName: "행동교정 김훈련", topics: "분리불안, 산책", modes: "video,chat", intro: "10년째 노견 가정을 돕고 있습니다." }, ["trainer", "vet"], ["video", "phone", "chat"]);
    expect(ok).toMatchObject({ ok: true, value: { kind: "trainer", topics: ["분리불안", "산책"], modes: ["video", "chat"] } });
    expect(validateExpertPartner({ expertKind: "x", displayName: "aa", modes: "video", intro: "충분히 긴 소개입니다." }, ["trainer"], ["video"]).ok).toBe(false);
    expect(validateExpertPartner({ expertKind: "trainer", displayName: "aa", modes: "", intro: "충분히 긴 소개입니다." }, ["trainer"], ["video"]).ok).toBe(false);
  });
});
