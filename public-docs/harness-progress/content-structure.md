# Workflow Journal — content-structure

## 2026-07-08T03:30:00Z — Verify-first (WI-AC-004)

- WorkItem: WI-AC-004
- AcceptanceChecks: AC-004
- context: content-structure
- Mode: VERIFY-FIRST (existing codebase)
- Attempt: 1
- Outcome: implementation=true (black-box verified at running boundary)
- NextAction: Integrated Verification

### Acceptance check

AC-004: Every `.mdx` under the project root (excluding `.mintlify/`,
`.artifacts/`, `node_modules/`, `drafts/`) has YAML frontmatter with both
`title` and `description` fields. A scripted find + head -5 + grep returns no
`MISSING TITLE: …` lines.

### Audit result

- mdx files in scope: 133 (excludes `.mintlify/`, `.artifacts/`,
  `node_modules/`, `drafts/`)
- Audit script (`/tmp/ac004_audit.sh`): opens each `.mdx`, confirms line 1 is
  `---`, extracts the first frontmatter block, and asserts both `title:` and
  `description:` keys with a non-empty value.
- On HEAD (commit bdf4e24): `TOTAL_MISSING=2` —
  `./snippets/auth-header.mdx` and `./snippets/rate-limit-note.mdx` had no
  frontmatter opener. AC-004 FAILED on existing committed code.
- Root cause: the two reusable snippet files under `snippets/` were the only
  `.mdx` files missing frontmatter. Every other `.mdx` already had both
  fields.

### Fix (smallest possible diff)

Added a `title` + `description` frontmatter block to the two snippet files.
These changes were already present in the working tree at session start (a
prior in-progress attempt); confirmed they are the minimal root-cause fix and
made no further code changes:

- `snippets/auth-header.mdx`: +`title: Authentication header`, +`description:
  Reusable snippet showing the JWT Authorization header required by all
  authenticated CauseFlow API endpoints.`
- `snippets/rate-limit-note.mdx`: +`title: Rate limit note`, +`description:
  Reusable note explaining CauseFlow API rate limits, the 429 response, and
  the X-RateLimit response headers.`

Re-ran the audit against the working tree: `TOTAL_MISSING=0`. AC-004 PASSES.

### Boundary verification (real external boundary)

- `mint dev` running on the assigned PORT=5170 from the project root
  (confirmed: `node ... @mintlify/cli ... dev --port 5170`, PWD = public-docs).
- `curl -s -o /tmp/home.html -w '%{http_code}' http://localhost:5170/` → 200,
  body contains `CauseFlow AI` (x4) and `Quickstart` (x3). AC-001 dependency
  holds.
- `GET http://localhost:5170/getting-started/quickstart` → 200, H1 "Quickstart".
- `mint broken-links` → exit 0, "no broken links found". No MDX parse errors
  introduced by the new frontmatter.
- Snippets are not wired into navigation (404 when curled directly, as
  expected for unrouted files); they are still `.mdx` files under the project
  root and therefore in scope for the AC-004 frontmatter audit. Their
  frontmatter now satisfies the check.

### Verdict

implementation=true. Two tracked files changed (the minimal root-cause fix);
committed. No refactor, no restructuring.
