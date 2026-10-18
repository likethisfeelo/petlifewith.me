// ============================================================
// 인허가 좌표 → 위경도 (순수 함수, 테스트 대상)
//
// 지방행정 인허가 데이터(LOCALDATA·행정안전부 동물 인허가)의 좌표는 위경도가 아니라 TM 평면좌표다.
// ETL 은 원본 그대로(raw_coord_x/y) 보관하고 좌표계를 "unverified" 로 남겨 두었다.
// 실제 주소와 대조해 보니 EPSG:5174 (Korean 1985 / Modified Central Belt, 베셀 타원체, 중부원점 127°00'10.405")와 맞는다
// (예: 종로구 화동 → 정독도서관 옆, 대학로 → 대학로 길 위). 2097(보정 없는 중부원점)은 서쪽으로 약 250m 밀린다.
// 변환식은 PROJ 의 EPSG:5174 → EPSG:4326 파이프라인과 같다 (TM 역변환 → 몰로덴스키-바데카스 7변수).
// ============================================================

const BESSEL = { a: 6377397.155, f: 1 / 299.1528128 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };

const TM = { lat0: 38, lon0: 127.002890277778, k0: 1, x0: 200000, y0: 500000 };

// Korean 1985 → WGS 84 (EPSG 변환 1) — coordinate frame 규약, 회전은 초 단위, 축척은 ppm
const MB = {
  tx: -145.907, ty: 505.034, tz: 685.756,
  rx: -1.162, ry: 2.347, rz: 1.592,
  s: 6.342,
  px: -3159521.31, py: 4068151.32, pz: 3748113.85,
};

const RAD = Math.PI / 180;
const ARCSEC = RAD / 3600;

function meridianArc(phi: number, a: number, e2: number): number {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/** TM 역변환 (Snyder) — 베셀 타원체 위경도(라디안) */
function inverseTm(x: number, y: number): { phi: number; lam: number } {
  const { a, f } = BESSEL;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const M = meridianArc(TM.lat0 * RAD, a, e2) + (y - TM.y0) / TM.k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const C1 = ep2 * cos1 * cos1;
  const T1 = tan1 * tan1;
  const N1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const R1 = (a * (1 - e2)) / (1 - e2 * sin1 * sin1) ** 1.5;
  const D = (x - TM.x0) / (N1 * TM.k0);
  const phi =
    phi1 -
    ((N1 * tan1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lam =
    TM.lon0 * RAD +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / cos1;
  return { phi, lam };
}

function toCartesian(phi: number, lam: number, ell: { a: number; f: number }): [number, number, number] {
  const e2 = ell.f * (2 - ell.f);
  const N = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [N * Math.cos(phi) * Math.cos(lam), N * Math.cos(phi) * Math.sin(lam), N * (1 - e2) * Math.sin(phi)];
}

function toGeodetic(X: number, Y: number, Z: number, ell: { a: number; f: number }): { phi: number; lam: number } {
  const e2 = ell.f * (2 - ell.f);
  const p = Math.hypot(X, Y);
  let phi = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const N = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const h = p / Math.cos(phi) - N;
    phi = Math.atan2(Z, p * (1 - (e2 * N) / (N + h)));
  }
  return { phi, lam: Math.atan2(Y, X) };
}

/** 인허가 TM 좌표(EPSG:5174) → WGS84 위경도. 한반도 범위를 벗어나면 null */
export function tmToWgs84(x: number, y: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { phi, lam } = inverseTm(x, y);
  const [X, Y, Z] = toCartesian(phi, lam, BESSEL);
  const s = 1 + MB.s * 1e-6;
  const rx = MB.rx * ARCSEC;
  const ry = MB.ry * ARCSEC;
  const rz = MB.rz * ARCSEC;
  const dx = X - MB.px;
  const dy = Y - MB.py;
  const dz = Z - MB.pz;
  // coordinate frame 회전 (작은 각 근사) — PROJ helmert/molobadekas 와 같은 규약
  const X2 = MB.px + MB.tx + s * (dx + rz * dy - ry * dz);
  const Y2 = MB.py + MB.ty + s * (-rz * dx + dy + rx * dz);
  const Z2 = MB.pz + MB.tz + s * (ry * dx - rx * dy + dz);
  const g = toGeodetic(X2, Y2, Z2, WGS84);
  const lat = g.phi / RAD;
  const lng = g.lam / RAD;
  if (lat < 32.5 || lat > 39 || lng < 124 || lng > 132.5) return null;
  return { lat, lng };
}

/** 스팟 위치 — 위경도가 있으면 그것, 없으면 인허가 원본 좌표를 변환 */
export function spotLatLng(spot: { lat: number | null; lng: number | null; rawCoordX: number | null; rawCoordY: number | null }): { lat: number; lng: number } | null {
  if (spot.lat != null && spot.lng != null) return { lat: spot.lat, lng: spot.lng };
  if (spot.rawCoordX == null || spot.rawCoordY == null) return null;
  return tmToWgs84(spot.rawCoordX, spot.rawCoordY);
}
