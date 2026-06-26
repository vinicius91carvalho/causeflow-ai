# Invariants — Use-Cases Case Studies PRD

Project-level invariants already cover bounded-context structure, i18n composer, and route conventions. This PRD introduces one cross-sprint invariant.

## CaseStudy Registry Consistency

- **Owner:** `apps/website/src/contexts/marketing/domain/case-studies.ts` (Sprint 01).
- **Preconditions:** every entry in `CASE_STUDIES` has a matching route file at `apps/website/src/app/[locale]/use-cases/<slug>/page.tsx` and matching i18n keys at `caseStudies.<i18nKey>.*` in both `en.json` and `pt-br.json`.
- **Postconditions:** the index page (`use-cases-index-page.tsx`) iterates `CASE_STUDIES` — no hardcoded slug list.
- **Invariants:** adding or removing a case study requires: (1) registry entry, (2) route file, (3) i18n keys in both locales, (4) sitemap entry (Sprint 05 owner), (5) optional home-carousel deep link (Sprint 05 owner).
- **Verify:** `node -e "const r=require('./apps/website/src/contexts/marketing/domain/case-studies.ts'); console.log(r.CASE_STUDIES.length===3?'ok':'fail')"` (or equivalent ts-node check). Manual spot-check acceptable during PRD execution.
- **Fix:** if mismatched, add the missing piece listed above rather than dropping the registry entry.
