#!/usr/bin/env python3
"""HTTP probe for AC-005: marketing chrome uses OSS CauseFlow identity (no LLC sales chrome)."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PORT = int(__import__("os").environ.get("PORT", "5171"))
BASE = f"http://127.0.0.1:{PORT}"
PATHS = ["/", "/product", "/pt-br", "/pt-br/product"]
FORBIDDEN = [
    r"CauseFlow\s*AI\s*,\s*LLC",
    r"A Delaware corporation",
    r"131 Continental Dr",
]
DOCS_RE = re.compile(r"https?://[^\"']*(docs|github\.io/causeflow)", re.I)
GITHUB_RE = re.compile(r"https?://(?:www\.)?github\.com/causeflow", re.I)
OUT = Path(__file__).resolve().parent / "wi-ac-005-verify-first.json"


def fetch(path: str) -> tuple[int, str]:
    url = BASE + path
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def main() -> int:
    routes = []
    all_pass = True
    for path in PATHS:
        try:
            status, body = fetch(path)
        except Exception as exc:  # noqa: BLE001 — probe boundary
            routes.append({"path": path, "pass": False, "error": str(exc)})
            all_pass = False
            continue

        hits = [pat for pat in FORBIDDEN if re.search(pat, body, re.I)]
        has_llc = bool(re.search(r"CauseFlow\s*AI\s*,\s*LLC", body, re.I))
        has_delaware = "Delaware corporation" in body
        has_docs = bool(DOCS_RE.search(body))
        has_github = bool(GITHUB_RE.search(body))
        has_causeflow_brand = bool(re.search(r">CauseFlow<", body))
        header_ai_span = bool(
            re.search(r"<header[\s\S]{0,2500}?text-accent[^>]*>\s*AI\s*<", body)
        )
        footer_ai_span = bool(
            re.search(r"<footer[\s\S]{0,2500}?text-primary[^>]*>\s*AI\s*<", body)
        )
        pass_ok = (
            status == 200
            and not has_llc
            and not has_delaware
            and not hits
            and has_docs
            and has_github
            and has_causeflow_brand
            and not header_ai_span
            and not footer_ai_span
        )
        if not pass_ok:
            all_pass = False
        routes.append(
            {
                "path": path,
                "pass": pass_ok,
                "status": status,
                "has_llc": has_llc,
                "has_delaware": has_delaware,
                "forbidden_hits": hits,
                "has_docs": has_docs,
                "has_github": has_github,
                "has_causeflow_brand": has_causeflow_brand,
                "header_ai_span": header_ai_span,
                "footer_ai_span": footer_ai_span,
                "body_len": len(body),
            }
        )

    result = {
        "phase": "probe",
        "id": "WI-AC-005",
        "ac": "AC-005",
        "port": PORT,
        "ac005_pass": all_pass,
        "routes": routes,
    }
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
