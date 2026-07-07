# foundation workflow journal

## 2026-07-07T20:26:00.000Z — QA verification pass (WI-AC-001)

- work_item: WI-AC-001
- acceptance_check: AC-001
- context: foundation
- command: `mint dev` from project root
- observed_url: http://localhost:3000/
- http_status: 200
- site_name: "CauseFlow AI" present in HTML (title tag `CauseFlow AI Documentation - CauseFlow AI`; docs.json `name` = `CauseFlow AI`)
- quickstart_card: "Quickstart" intro card present on homepage (Card href `/getting-started/quickstart`)
- evidence: `curl -s -o /tmp/h.html -w '%{http_code}' http://localhost:3000/` → 200, body size 230338 bytes; `grep -c 'CauseFlow AI'` → 4; `grep -c 'Quickstart'` → 3
- verdict: qa=true; implementation=true; defects=none
- note: `mint dev` v4.2.666 ignores the PORT env override and serves on its default port 3000 (the port named by AC-001); server confirmed reachable with correct content.
