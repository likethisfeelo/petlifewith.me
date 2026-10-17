"""Collect active pet businesses by industry and sigungu.

Source: 행정안전부_동물_* 조회서비스 (지방행정 인허가 데이터, 2026년부터 data.go.kr API로 통합)
Outputs:
  raw/business_<industry>.csv   one row per business (active + inactive, for audit)
  raw/business_counts_<industry>.csv  active business count per sido/sigungu
  raw/business_status_values.csv every 영업상태 value seen, with counts (to verify the active filter)

Usage: python collect_businesses.py [industry ...]   (default: every industry in config)

An industry with "csv_path" reads a downloaded 인허가 file (공공데이터포털 파일데이터, cp949 or utf-8)
instead of calling the API. Column names come from businesses.csv_fields.
"""
import csv
import sys
from collections import Counter, defaultdict

from common import RAW, check_todo, dig, ensure_dirs, load_config, paginate, read_csv_rows, region_from_address


def main():
    ensure_dirs()
    cfg = load_config()
    biz = cfg["businesses"]
    merge = cfg["region_unit"]["merge_general_gu"]
    f = biz["fields"]
    active_values = set(biz["active_status_values"])
    targets = sys.argv[1:] or list(biz["industries"].keys())

    counts = defaultdict(int)
    status_seen = Counter()

    for ind in targets:
        spec = biz["industries"][ind]
        if spec.get("csv_path"):
            fields = biz["csv_fields"]
            items = read_csv_rows(spec["csv_path"])
            print(f"  businesses: {ind} (csv {spec['csv_path']})")
        else:
            fields = f
            check_todo({"base_url": spec["base_url"], "fields": f}, f"businesses.{ind}")
            items = paginate(spec["base_url"], biz["key_param"], biz["fixed_params"], biz["page_param"],
                             biz["items_path"], biz["total_count_path"])
            print(f"  businesses: {ind}")
        rows = []
        unparsed = 0
        for item in items:
            status = str(dig(item, [fields["status"]]) or "").strip()
            status_seen[(ind, status)] += 1
            addr = str(dig(item, [fields["address_road"]]) or "").strip() or str(dig(item, [fields["address_lot"]]) or "").strip()
            sido, sgg = region_from_address(addr, merge)
            active = status in active_values
            rows.append([dig(item, [fields["name"]]), status, active, addr, sido, sgg])
            if sido is None or sgg is None:
                unparsed += 1
                continue
            if active:
                counts[(sido, sgg, ind)] += 1

        with open(RAW / f"business_{ind}.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["name", "status", "active", "address", "sido", "sigungu"])
            w.writerows(rows)
        print(f"    {len(rows)} rows, {sum(1 for r in rows if r[2])} active, {unparsed} address unparsed")

    for ind in targets:
        with open(RAW / f"business_counts_{ind}.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["sido", "sigungu", "industry", "shops_raw"])
            for (sido, sgg, i), n in sorted(counts.items()):
                if i == ind:
                    w.writerow([sido, sgg, i, n])

    with open(RAW / "business_status_values.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["industry", "status", "count", "counted_as_active"])
        for (ind, status), n in sorted(status_seen.items()):
            w.writerow([ind, status, n, status in active_values])
    print("saved raw/business_counts_<industry>.csv, raw/business_status_values.csv")


if __name__ == "__main__":
    main()
