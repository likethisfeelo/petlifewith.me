"""Shared helpers: config loading, data.go.kr pagination, region normalization."""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "out"

SIDO_ALIASES = {
    "서울": ["서울특별시", "서울시", "서울"],
    "부산": ["부산광역시", "부산시", "부산"],
    "대구": ["대구광역시", "대구시", "대구"],
    "인천": ["인천광역시", "인천시", "인천"],
    "광주": ["광주광역시", "광주"],
    "대전": ["대전광역시", "대전시", "대전"],
    "울산": ["울산광역시", "울산시", "울산"],
    "세종": ["세종특별자치시", "세종시", "세종"],
    "경기": ["경기도", "경기"],
    "강원": ["강원특별자치도", "강원도", "강원"],
    "충북": ["충청북도", "충북"],
    "충남": ["충청남도", "충남"],
    "전북": ["전북특별자치도", "전라북도", "전북"],
    "전남": ["전라남도", "전남"],
    "경북": ["경상북도", "경북"],
    "경남": ["경상남도", "경남"],
    "제주": ["제주특별자치도", "제주도", "제주"],
}
_SIDO_LOOKUP = {alias: short for short, aliases in SIDO_ALIASES.items() for alias in aliases}


def load_config():
    path = ROOT / "config.json"
    if not path.exists():
        sys.exit("config.json not found. Copy config.example.json to config.json and fill TODO values.")
    cfg = json.loads(path.read_text(encoding="utf-8"))
    return cfg


def load_baseline():
    return json.loads((ROOT / "baseline_2025.json").read_text(encoding="utf-8"))


def service_key():
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        sys.exit("Environment variable DATA_GO_KR_KEY is not set.")
    return key


def check_todo(section, name):
    """Stop early if a required config value is still a TODO placeholder."""
    text = json.dumps(section, ensure_ascii=False)
    if '"TODO' in text:
        sys.exit(f"[{name}] config still has TODO values. Fill them from the API Swagger spec first.")


def dig(obj, path):
    for key in path:
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(key)
        else:
            return None
    return obj


def as_list(items):
    if items is None:
        return []
    if isinstance(items, dict):
        return [items]
    return list(items)


def fetch_json(base_url, params, retries=3):
    query = urllib.parse.urlencode(params, safe="%")
    url = f"{base_url}?{query}"
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                body = resp.read().decode("utf-8")
            return json.loads(body)
        except Exception as err:  # network error or non-JSON (e.g. XML error message)
            last_err = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Request failed: {base_url} params={ {k: v for k, v in params.items() if 'key' not in k.lower()} } err={last_err}")


def paginate(base_url, key_param, fixed_params, page_param, items_path, total_path, extra_params=None):
    """Yield every item across all pages of a data.go.kr style API."""
    key = service_key()
    page = 1
    seen = 0
    while True:
        params = {key_param: key, **fixed_params, **(extra_params or {}), page_param: page}
        data = fetch_json(base_url, params)
        items = as_list(dig(data, items_path))
        total = dig(data, total_path)
        for item in items:
            yield item
        seen += len(items)
        if not items:
            break
        if total is not None and seen >= int(total):
            break
        page += 1
        time.sleep(0.2)


def normalize_sido(text):
    if not text:
        return None
    text = text.strip()
    if text in _SIDO_LOOKUP:
        return _SIDO_LOOKUP[text]
    for alias, short in _SIDO_LOOKUP.items():
        if text.startswith(alias):
            return short
    return None


def normalize_sigungu(sido_short, sigungu, merge_general_gu=True):
    """Return a canonical sigungu name. Sejong has no sigungu level."""
    if sido_short == "세종":
        return "세종"
    if not sigungu:
        return None
    parts = sigungu.strip().split()
    if not parts:
        return None
    if len(parts) >= 2 and parts[0].endswith("시") and parts[1].endswith("구"):
        return parts[0] if merge_general_gu else f"{parts[0]} {parts[1]}"
    return parts[0]


def region_from_address(address, merge_general_gu=True):
    """'서울특별시 강남구 역삼동 ...' -> ('서울', '강남구')."""
    if not address:
        return None, None
    tokens = address.strip().split()
    if not tokens:
        return None, None
    sido = normalize_sido(tokens[0])
    if sido is None:
        return None, None
    if sido == "세종":
        return sido, "세종"
    rest = " ".join(tokens[1:3])
    return sido, normalize_sigungu(sido, rest, merge_general_gu)


def ensure_dirs():
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
