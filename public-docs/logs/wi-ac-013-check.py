#!/usr/bin/env python3
import json, re, sys, urllib.request, os

ROOT = "/home/vinicius/projects/causeflow-ai-wt-public-docs-api-reference/public-docs"
BASE = "http://127.0.0.1:5174"
DOCS = json.load(open(os.path.join(ROOT, "docs.json")))

# Endpoint groups named in AC-013 (exclude the Overview group covered by AC-012/14/15)
ENDPOINT_GROUPS = {
    "Incidents","Triage","Investigation","Remediation","Memory and Chat",
    "Skills","Triggers","Integrations","Knowledge","Graph","Billing",
    "Notifications","Audit","Webhooks","GitHub","Tenants","API keys",
    "Analytics","Health","Widget (roadmap)",
}

pages = []
for tab in DOCS["navigation"]["tabs"]:
    if tab["tab"] == "API reference":
        for g in tab["groups"]:
            if g["group"] in ENDPOINT_GROUPS:
                pages.extend(g["pages"])
    # relay endpoints are listed under Relay tab but named in AC-013
    if tab["tab"] == "Relay":
        for g in tab["groups"]:
            if g["group"] == "Relay API":
                pages.extend(g["pages"])

def frontmatter_title(path):
    p = os.path.join(ROOT, path + ".mdx")
    with open(p, encoding="utf-8") as f:
        src = f.read()
    m = re.search(r"^---\s*$(.*?)^---\s*$", src, re.M | re.S)
    if not m:
        return None, "no frontmatter"
    fm = m.group(1)
    tm = re.search(r"^title:\s*(.+?)\s*$", fm, re.M)
    if not tm:
        return None, "no title field"
    # strip surrounding quotes if present
    t = tm.group(1).strip()
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        t = t[1:-1]
    return t, None

def fetch(path):
    url = BASE + "/" + path
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
            return r.status, body
    except Exception as e:
        return None, str(e)

def h1(body):
    m = re.search(r'<h1[^>]*id="page-title"[^>]*>(.*?)</h1>', body, re.S)
    if not m:
        return None
    inner = m.group(1)
    # strip nested tags
    text = re.sub(r"<[^>]+>", "", inner)
    return re.sub(r"\s+", " ", text).strip()

ok = 0
fail = 0
fails = []
for p in pages:
    status, body = fetch(p)
    title, err = frontmatter_title(p)
    if status != 200:
        fail += 1
        fails.append(f"{p}: HTTP {status}; expected 200; evidence: {body[:200]}")
        continue
    if err:
        fail += 1
        fails.append(f"{p}: frontmatter error {err}")
        continue
    h = h1(body)
    if h is None:
        fail += 1
        fails.append(f"{p}: no H1#page-title rendered; expected title '{title}'")
        continue
    if h == title:
        ok += 1
    else:
        fail += 1
        fails.append(f"{p}: H1='{h}' != title='{title}'")

print(f"OK={ok} FAIL={fail} TOTAL={len(pages)}")
for f in fails:
    print("FAIL: " + f)
