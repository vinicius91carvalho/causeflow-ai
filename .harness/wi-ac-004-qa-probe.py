#!/usr/bin/env python3
"""AC-004 black-box HTTP probe: primary marketing CTAs (EN + PT-BR)."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:5171"
OUT = Path(
    "/home/vinicius/projects/causeflow-ai-wt-root-web-oss-marketing/.harness/wi-ac-004-qa-agent-run.json"
)

PATHS = [
    "/",
    "/product",
    "/integrations",
    "/use-cases",
    "/security",
    "/about",
    "/from-opsgenie",
    "/pt-br",
    "/pt-br/product",
    "/pt-br/integrations",
    "/pt-br/use-cases",
    "/pt-br/security",
    "/pt-br/about",
    "/pt-br/from-opsgenie",
]

# Forbidden conversion CTAs (link/button visible labels)
FORBIDDEN_CTA = [
    re.compile(r"get\s*early\s*access", re.I),
    re.compile(r"start\s*free(?:\s*trial)?", re.I),
    re.compile(r"see\s*pricing", re.I),
    re.compile(r"talk\s*to\s*the\s*co-?founder", re.I),
    # PT-BR equivalents commonly used in this codebase
    re.compile(r"acesso\s*antecipado", re.I),
    re.compile(r"comece\s*gr[aá]tis", re.I),
    re.compile(r"ver\s*pre[cç]os", re.I),
    re.compile(r"falar\s*com\s*o\s*co-?fundador", re.I),
]

A_HREF = re.compile(
    r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
    re.I | re.S,
)
BUTTON = re.compile(r"<button\b[^>]*>(.*?)</button>", re.I | re.S)
TAG = re.compile(r"<[^>]+>")


def strip_tags(html: str) -> str:
    return re.sub(r"\s+", " ", TAG.sub(" ", html)).strip()


def fetch(path: str) -> tuple[int, str]:
    url = BASE + path
    req = urllib.request.Request(url, method="GET", headers={"Accept": "text/html"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        return e.code, body


def analyze(path: str) -> dict:
    status, body = fetch(path)
    links = []
    for m in A_HREF.finditer(body):
        href = m.group(1).strip()
        text = strip_tags(m.group(2))
        links.append({"href": href, "text": text})

    buttons = [strip_tags(m.group(1)) for m in BUTTON.finditer(body)]

    forbidden_cta_links = []
    for link in links:
        label = link["text"]
        if any(p.search(label) for p in FORBIDDEN_CTA):
            forbidden_cta_links.append(link)

    forbidden_buttons = []
    for label in buttons:
        if any(p.search(label) for p in FORBIDDEN_CTA):
            forbidden_buttons.append(label)

    # Hard-forbidden body strings as conversion CTA copy (visible-ish)
    hard_forbidden_body = []
    for p in FORBIDDEN_CTA:
        if p.search(body):
            # Ignore matches that only appear inside JSON/script blobs with no CTA role
            # by requiring nearby <a or <button context within ~200 chars of a match.
            for m in p.finditer(body):
                start = max(0, m.start() - 200)
                end = min(len(body), m.end() + 200)
                window = body[start:end].lower()
                if "<a" in window or "<button" in window or "href=" in window:
                    hard_forbidden_body.append(m.group(0))
                    break

    has_docs_href = any(
        ("docs" in (l["href"] + " " + l["text"]).lower())
        or ("github.io" in l["href"].lower())
        or ("/docs" in l["href"].lower())
        for l in links
    )
    has_github_repo_href = any(
        "github.com" in l["href"].lower() for l in links
    )
    # Primary CTA group: labeled Docs and/or GitHub
    docs_label = re.compile(
        r"\bdocs\b|documenta[cç][aã]o|read the docs|ler a documenta", re.I
    )
    github_label = re.compile(r"\bgithub\b|ver no github|view on github", re.I)
    has_labeled_docs = any(docs_label.search(l["text"]) for l in links)
    has_labeled_github = any(github_label.search(l["text"]) for l in links)
    has_primary_cta = (has_labeled_docs or has_docs_href) and (
        has_labeled_github or has_github_repo_href
    )
    # Spec: Docs and/or GitHub — either alone is ok if primary; prefer both present
    # on homepage/product surfaces. Require at least one of Docs/GitHub as CTA,
    # and GitHub or Docs href present.
    has_primary_cta = (has_labeled_docs or has_labeled_github) and (
        has_docs_href or has_github_repo_href
    )

    interesting = [
        l
        for l in links
        if docs_label.search(l["text"])
        or github_label.search(l["text"])
        or re.search(r"dashboard|painel", l["text"], re.I)
        or "github.com" in l["href"].lower()
        or "github.io" in l["href"].lower()
    ][:12]

    pass_ok = (
        status == 200
        and not forbidden_cta_links
        and not forbidden_buttons
        and not hard_forbidden_body
        and has_primary_cta
        and (has_docs_href or has_github_repo_href)
    )

    return {
        "path": path,
        "pass": pass_ok,
        "status": status,
        "forbidden_cta_links": forbidden_cta_links,
        "forbidden_buttons": forbidden_buttons,
        "hard_forbidden_body": hard_forbidden_body,
        "has_docs_href": has_docs_href,
        "has_github_repo_href": has_github_repo_href,
        "has_primary_cta": has_primary_cta,
        "interesting": interesting,
    }


def main() -> None:
    routes = []
    all_pass = True
    for path in PATHS:
        try:
            row = analyze(path)
        except Exception as e:  # noqa: BLE001
            row = {"path": path, "pass": False, "error": str(e)}
            all_pass = False
        else:
            if not row["pass"]:
                all_pass = False
        routes.append(row)

    result = {
        "phase": "isolated-qa",
        "id": "WI-AC-004",
        "ac": "AC-004",
        "port": 5171,
        "ac004_pass": all_pass,
        "routes": routes,
    }
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
