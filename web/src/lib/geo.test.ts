import { describe, expect, it } from "vitest";
import { spotLatLng, tmToWgs84 } from "./geo";

// 기대값: pyproj (PROJ) EPSG:5174 → EPSG:4326
const CASES: Array<[number, number, number, number]> = [
  [200099.032850302, 452925.449270507, 37.5786259733109, 127.00190889651877], // 종로구 대학로
  [198347.210186346, 453115.086357308, 37.58033297754907, 126.98207650539109], // 종로구 화동
  [388000.5, 186000.2, 35.15561525769235, 129.06397772628154], // 부산 쪽
  [160000, -50000, 33.04487214030311, 126.5725878534489], // 제주 남쪽
  [250000, 420000, 37.28062543050675, 127.56458661681275],
];

describe("tmToWgs84", () => {
  it.each(CASES)("(%d, %d) → PROJ 와 같은 위경도", (x, y, lat, lng) => {
    const r = tmToWgs84(x, y)!;
    expect(Math.abs(r.lat - lat)).toBeLessThan(2e-6); // 약 20cm
    expect(Math.abs(r.lng - lng)).toBeLessThan(2e-6);
  });
  it("범위 밖·잘못된 값은 null", () => {
    expect(tmToWgs84(NaN, 1)).toBeNull();
    expect(tmToWgs84(5_000_000, 5_000_000)).toBeNull();
  });
  it("위경도가 있으면 그대로", () => {
    expect(spotLatLng({ lat: 37.5, lng: 127, rawCoordX: 1, rawCoordY: 1 })).toEqual({ lat: 37.5, lng: 127 });
    expect(spotLatLng({ lat: null, lng: null, rawCoordX: null, rawCoordY: null })).toBeNull();
  });
});
