#!/usr/bin/env python3
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:5171"
PATHS = ["/pricing", "/pt-br/pricing"]
OUT = Path(__file__).with_name("wi-ac-003-qa-agent-run.json")


def fetch(url: str):
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.headers.get("Location"), resp.read().decode(
                "utf-8", "replace"
            )
    except urllib.error.HTTPError as e:
        return (
            e.code,
            e.headers.get("Location") if e.headers else None,
            e.read().decode("utf-8", "replace"),
        )


# Real commercial UI markers — ignore React Flight "$NN" / "\$NN" tokens.
# (?<!["\\]) rejects RSC refs like "$29" and escaped "\$29" in the payload.
_PRICE = r'(?<!["\\])\$%s\b'


def _price(n: str) -> re.Pattern[str]:
    return re.compile(_PRICE % n)


PAID_MARKERS = [
    ("Starter+Business", None),  # special-cased
    ("$99", _price("99")),
    ("$349", _price("349")),
    ("$29", _price("29")),
    ("per month", re.compile(r"per month", re.I)),
    ("See Pricing", re.compile(r"See Pricing", re.I)),
    ("Buy now", re.compile(r"Buy now", re.I)),
    ("Start free trial", re.compile(r"Start free trial", re.I)),
    ("Choose plan", re.compile(r"Choose (your )?plan", re.I)),
]

SALES_HOSTS = (
    "causeflow.ai/pricing",
    "stripe.com",
    "billing",
    "github.io",
    "vinicius91carvalho",
)


def has_paid_plan_cards(body: str) -> tuple[bool, list[str]]:
    hits: list[str] = []
    starter = bool(re.search(r"\bStarter\b", body, re.I))
    business = bool(re.search(r"\bBusiness\b", body, re.I))
    if starter and business:
        hits.append("Starter+Business")
    for name, pat in PAID_MARKERS:
        if pat is None:
            continue
        m = pat.search(body)
        if m:
            hits.append(name)
            # show context for debugging
            i = m.start()
            print(f"MATCH {name}: {body[max(0, i - 40) : i + 60]!r}")
    return bool(hits), hits


def main() -> int:
    routes = []
    all_pass = True
    for path in PATHS:
        url = BASE + path
        try:
            status, location, body = fetch(url)
        except Exception as e:
            routes.append({"url": url, "pass": False, "error": str(e)})
            all_pass = False
            continue

        paid, hits = has_paid_plan_cards(body)
        is_redirect = 300 <= status < 400
        redirects_to_sales = False
        if location:
            loc = location.lower()
            redirects_to_sales = any(h in loc for h in SALES_HOSTS) or "/pricing" in loc

        has_not_found_ui = (
            'id="__next_error__"' in body
            or "NEXT_HTTP_ERROR_FALLBACK;404" in body
            or "This page could not be found" in body
            or re.search(r">\s*404\s*<", body) is not None
        )

        pass_ok = (
            status == 404
            and not paid
            and not is_redirect
            and not redirects_to_sales
            and not location
        )
        if not pass_ok:
            all_pass = False

        dollars = sorted(set(re.findall(r"\$\d+", body)))[:40]
        print(path, "status", status, "paid_hits", hits, "dollars", dollars)

        routes.append(
            {
                "url": url,
                "pass": pass_ok,
                "status": status,
                "location": location,
                "has_paid_plan_cards": paid,
                "paid_hits": hits,
                "redirects_to_sales": bool(redirects_to_sales or is_redirect),
                "has_not_found_ui": has_not_found_ui,
                "body_len": len(body),
                "snippet": body[:220],
            }
        )

    result = {
        "id": "WI-AC-003",
        "phase": "isolated-qa",
        "ac003_pass": all_pass,
        "routes": routes,
    }
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
