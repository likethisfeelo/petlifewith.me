"""Build out/stats.json, per-industry ranking CSVs, and a validation report.

Metric: 업장 1곳당 등록 반려견 수 = 등록 반려견 수 / 영업 중 업장 수
  - higher  -> fewer shops per dog (업장 대비 등록견 많음)
  - lower   -> more shops per dog (업장 대비 등록견 적음)

Calibration (config.calibration):
  sigungu_value = raw_sigungu_value / raw_sido_sum * survey_sido_total
  so every sigungu total adds up to the 2025 survey sido figure, and sido/national
  averages equal the numbers used in the reels script (전국 332, 서울 357 for grooming).
"""
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone

from common import OUT, RAW, ensure_dirs, load_baseline, load_config


def read_registration():
    data = {}
    with open(RAW / "registration_sigungu.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            data[(row["sido"], row["sigungu"])] = int(row["dogs_raw"])
    return data


def read_businesses(industries):
    data = defaultdict(int)
    found = []
    for ind in industries:
        path = RAW / f"business_counts_{ind}.csv"
        if not path.exists():
            continue
        found.append(ind)
        with open(path, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                data[(row["sido"], row["sigungu"], ind)] = int(row["shops_raw"])
    return data, found


def rescale(raw_by_region, sido_total):
    """raw_by_region: {sigungu: raw}. Returns {sigungu: calibrated float}."""
    s = sum(raw_by_region.values())
    if s == 0:
        return {k: 0.0 for k in raw_by_region}
    return {k: v / s * sido_total for k, v in raw_by_region.items()}


def label_for(pct, shops_raw, cfg_labels):
    if shops_raw is not None and shops_raw < cfg_labels["min_shops_for_label"]:
        return "표본 적음"
    if pct is None:
        return "업장 없음"
    if pct >= cfg_labels["short_threshold_pct"]:
        return "업장 대비 등록견 많음"
    if pct < cfg_labels["dense_threshold_pct"]:
        return "업장 대비 등록견 적음"
    return "평균 수준"


def main():
    ensure_dirs()
    cfg = load_config()
    base = load_baseline()
    cal = cfg["calibration"]
    lab = cfg["labels"]
    sidos = base["sido"]

    reg = read_registration()
    biz, industries = read_businesses(list(base["industries"].keys()))
    if not industries:
        raise SystemExit("No raw/business_counts_<industry>.csv found. Run collect_businesses.py first.")

    sigungus = sorted(set(reg.keys()) | {(s, g) for (s, g, _) in biz.keys()})
    missing_dogs = [k for k in sigungus if k not in reg]
    if missing_dogs:
        print(f"WARNING: {len(missing_dogs)} sigungu have shops but no registration row (name mismatch?): {missing_dogs[:10]}")

    # dogs per sigungu
    dogs = {}
    for sido in sidos:
        raw = {g: reg.get((s, g), 0) for (s, g) in sigungus if s == sido}
        dogs.update({(sido, g): v for g, v in (rescale(raw, sidos[sido]["dogs"]) if cal["calibrate_dogs"] else raw).items()})

    # shops per sigungu per industry + validation
    shops = {}
    validation = []
    for ind in industries:
        for sido in sidos:
            raw = {g: biz.get((s, g, ind), 0) for (s, g) in sigungus if s == sido}
            survey = sidos[sido]["shops"][ind]
            api_sum = sum(raw.values())
            diff = None if survey == 0 else round((api_sum - survey) / survey * 100, 1)
            validation.append([ind, sido, survey, api_sum, diff,
                               "CHECK" if diff is not None and abs(diff) > cfg["validation"]["max_diff_pct"] else ""])
            vals = rescale(raw, survey) if cal["calibrate_shops"] else raw
            for g, v in vals.items():
                shops[(sido, g, ind)] = (v, raw[g])

    # averages
    national = {}
    total_dogs = sum(v["dogs"] for v in sidos.values())
    for ind in industries:
        total_shops = sum(v["shops"][ind] for v in sidos.values())
        national[ind] = {"dogs": total_dogs, "shops": total_shops,
                         "per_shop": round(total_dogs / total_shops, 1) if total_shops else None}

    sido_out = {}
    for sido, v in sidos.items():
        sido_out[sido] = {"dogs": v["dogs"], "industries": {}}
        for ind in industries:
            n = v["shops"][ind]
            sido_out[sido]["industries"][ind] = {"shops": n, "per_shop": round(v["dogs"] / n, 1) if n else None}
    for ind in industries:
        ranked = sorted([s for s in sido_out if sido_out[s]["industries"][ind]["per_shop"] is not None],
                        key=lambda s: -sido_out[s]["industries"][ind]["per_shop"])
        for i, s in enumerate(ranked, 1):
            sido_out[s]["industries"][ind]["national_rank"] = i
            sido_out[s]["industries"][ind]["rank_total"] = len(ranked)

    # sigungu records
    records = []
    for (sido, g) in sigungus:
        if sido not in sidos:
            continue
        rec = {"sido": sido, "sigungu": g, "dogs": round(dogs.get((sido, g), 0)), "industries": {}}
        for ind in industries:
            shop_cal, shop_raw = shops.get((sido, g, ind), (0.0, 0))
            per = round(dogs.get((sido, g), 0) / shop_cal, 1) if shop_cal > 0 else None
            s_avg = sido_out[sido]["industries"][ind]["per_shop"]
            n_avg = national[ind]["per_shop"]
            pct_s = round(per / s_avg * 100, 1) if per and s_avg else None
            pct_n = round(per / n_avg * 100, 1) if per and n_avg else None
            rec["industries"][ind] = {
                "shops": round(shop_cal, 1), "shops_raw": shop_raw, "per_shop": per,
                "pct_of_sido_avg": pct_s, "pct_of_national_avg": pct_n,
                "label": label_for(pct_s, shop_raw, lab),
            }
        records.append(rec)

    for ind in industries:
        for sido in sidos:
            group = [r for r in records if r["sido"] == sido and r["industries"][ind]["per_shop"] is not None]
            group.sort(key=lambda r: -r["industries"][ind]["per_shop"])
            for i, r in enumerate(group, 1):
                r["industries"][ind]["rank_in_sido"] = i
                r["industries"][ind]["count_in_sido"] = len(group)

    stats = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "metric": "업장 1곳당 등록 반려견 수 (등록 반려견 수 / 영업 중 업장 수)",
            "baseline": base["source"],
            "baseline_reference_date": base["reference_date"],
            "calibration": cal,
            "label_thresholds_pct_of_sido_avg": {"short": lab["short_threshold_pct"], "dense": lab["dense_threshold_pct"]},
            "industries": {k: base["industries"][k] for k in industries},
        },
        "national": national,
        "sido": sido_out,
        "sigungu": records,
    }
    (OUT / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    with open(OUT / "validation.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["industry", "sido", "survey_2025_shops", "api_active_shops", "diff_pct", "flag"])
        w.writerows(validation)

    for ind in industries:
        with open(OUT / f"ranking_{ind}.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["sido", "sigungu", "rank_in_sido", "count_in_sido", "dogs", "shops", "shops_raw",
                        "per_shop", "sido_avg", "pct_of_sido_avg", "pct_of_national_avg", "label"])
            rows = sorted(records, key=lambda r: (r["sido"], r["industries"][ind].get("rank_in_sido") or 9999))
            for r in rows:
                d = r["industries"][ind]
                w.writerow([r["sido"], r["sigungu"], d.get("rank_in_sido"), d.get("count_in_sido"), r["dogs"],
                            d["shops"], d["shops_raw"], d["per_shop"], sido_out[r["sido"]]["industries"][ind]["per_shop"],
                            d["pct_of_sido_avg"], d["pct_of_national_avg"], d["label"]])

    flagged = [v for v in validation if v[5]]
    print(f"saved out/stats.json ({len(records)} sigungu x {len(industries)} industries)")
    print(f"saved out/validation.csv ({len(flagged)} sido/industry pairs over threshold)")
    for ind in industries:
        print(f"  national {ind}: {national[ind]['per_shop']} dogs per shop")


if __name__ == "__main__":
    main()
