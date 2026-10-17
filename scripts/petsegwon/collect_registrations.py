"""Collect dog registration counts by sido/sigungu -> raw/registration_sigungu.csv

mode=api : 농림축산검역본부_동물등록 현황 OpenAPI (https://www.data.go.kr/data/15103156/openapi.do)
mode=csv : 행정구역별 반려동물등록 개체 수 현황 파일 (2022 기준, 대체용)

The API counts include dead animals (cumulative). That is fine here because
build_stats.py only uses each sigungu's SHARE within its sido and rescales the
totals to the 2025 survey (dead animals excluded).
"""
import csv
from collections import defaultdict

from common import (RAW, check_todo, dig, ensure_dirs, load_baseline, load_config,
                    normalize_sido, normalize_sigungu, paginate)


def from_csv(cfg, merge):
    cols = cfg["csv_columns"]
    totals = defaultdict(int)
    skipped = []
    with open(cfg["csv_path"], encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sido = normalize_sido(row[cols["sido"]], row[cols["sigungu"]])
            sgg = normalize_sigungu(sido, row[cols["sigungu"]], merge) if sido else None
            if not sido or not sgg:
                skipped.append(row)
                continue
            totals[(sido, sgg)] += int(str(row[cols["dogs"]]).replace(",", "") or 0)
    return totals, skipped


def from_api(cfg, merge):
    check_todo(cfg, "registration")
    f = cfg["fields"]
    totals = defaultdict(int)
    skipped = []
    sidos = list(load_baseline()["sido"].keys()) if cfg.get("query_per_sido") else [None]
    for sido_short in sidos:
        extra = {}
        if sido_short:
            extra[cfg["sido_param"]] = cfg["sido_query_values"].get(sido_short) or sido_short
        if cfg.get("species_param"):
            extra[cfg["species_param"]] = cfg["species_dog_value"]
        print(f"  registration: {sido_short or 'ALL'}")
        for item in paginate(cfg["base_url"], cfg["key_param"], cfg["fixed_params"], cfg["page_param"],
                             cfg["items_path"], cfg["total_count_path"], extra):
            species = str(dig(item, [f["species"]]) or "")
            if cfg.get("species_dog_value") and species and cfg["species_dog_value"] not in species:
                continue
            sido = normalize_sido(str(dig(item, [f["sido"]]) or ""), str(dig(item, [f["sigungu"]]) or "")) or sido_short
            sgg = normalize_sigungu(sido, str(dig(item, [f["sigungu"]]) or ""), merge) if sido else None
            if not sido or not sgg:
                skipped.append(item)
                continue
            totals[(sido, sgg)] += int(str(dig(item, [f["count"]]) or 0).replace(",", ""))
    return totals, skipped


def main():
    ensure_dirs()
    cfg = load_config()
    merge = cfg["region_unit"]["merge_general_gu"]
    reg = cfg["registration"]
    totals, skipped = from_csv(reg, merge) if reg["mode"] == "csv" else from_api(reg, merge)

    out = RAW / "registration_sigungu.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["sido", "sigungu", "dogs_raw"])
        for (sido, sgg), n in sorted(totals.items()):
            w.writerow([sido, sgg, n])
    print(f"saved {out} ({len(totals)} sigungu, skipped {len(skipped)} rows)")
    if skipped:
        print("  first skipped rows (check region names):", skipped[:3])


if __name__ == "__main__":
    main()
