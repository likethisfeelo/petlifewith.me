"""Print the real response shape of each data.go.kr API (3 rows), to fill config.json TODO values.

Usage:
  python probe_api.py                       # every base_url already filled in config.json
  python probe_api.py <base_url> [k=v ...]  # one URL before config is filled (extra query params optional)

The service key comes from DATA_GO_KR_KEY and is never printed.
Paste the output (it has no key) to Claude Code to fill the field names.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

from common import ROOT


def call(base_url, params):
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        sys.exit("Set DATA_GO_KR_KEY first.")
    query = urllib.parse.urlencode({"serviceKey": key, "pageNo": 1, "numOfRows": 3, **params}, safe="%")
    with urllib.request.urlopen(f"{base_url}?{query}", timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def shape(obj, depth=0, max_depth=6):
    """Keys and value types, with the first list element expanded."""
    pad = "  " * depth
    if depth > max_depth:
        return f"{pad}..."
    if isinstance(obj, dict):
        lines = []
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                lines.append(f"{pad}{k}:")
                lines.append(shape(v, depth + 1, max_depth))
            else:
                lines.append(f"{pad}{k}: {json.dumps(v, ensure_ascii=False)[:80]}")
        return "\n".join(lines)
    if isinstance(obj, list):
        if not obj:
            return f"{pad}[]"
        return f"{pad}[{len(obj)} items, first:]\n" + shape(obj[0], depth + 1, max_depth)
    return f"{pad}{json.dumps(obj, ensure_ascii=False)[:80]}"


def probe(name, base_url, params):
    print(f"\n===== {name}: {base_url}")
    try:
        body = call(base_url, params)
    except Exception as err:
        print(f"  request failed: {err}")
        return
    try:
        print(shape(json.loads(body)))
    except ValueError:
        print("  (not JSON, first 2000 chars)")
        print(body[:2000])


def main():
    if len(sys.argv) > 1:
        extra = dict(a.split("=", 1) for a in sys.argv[2:] if "=" in a)
        probe("custom", sys.argv[1], {"_type": "json", "type": "json", **extra})
        return
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    reg = cfg["registration"]
    if not reg["base_url"].startswith("TODO"):
        probe("registration", reg["base_url"], {k: v for k, v in reg["fixed_params"].items() if k != "numOfRows"})
    biz = cfg["businesses"]
    for ind, spec in biz["industries"].items():
        if not spec["base_url"].startswith("TODO"):
            probe(f"businesses.{ind}", spec["base_url"], {k: v for k, v in biz["fixed_params"].items() if k != "numOfRows"})


if __name__ == "__main__":
    main()
