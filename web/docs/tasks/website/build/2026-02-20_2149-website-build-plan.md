# CauseFlow AI Website — Build Plan

## Phase 1: Monorepo Foundation
- [x] Init git repo + .gitignore
- [x] Root package.json with scripts (pnpm workspace scripts, no turbo)
- [x] pnpm-workspace.yaml
- [x] tsconfig.base.json (strict mode)
- [x] eslint.config.mjs (flat config)
- [x] .prettierrc + .prettierignore
- [x] .editorconfig, .nvmrc, .npmrc
- [x] Run pnpm install (symlink workaround for PRoot env)

## Phase 2: Shared Packages Scaffolding
- [x] packages/shared — types, constants, utils, i18n messages (16 files)
- [x] packages/ui — design system scaffold + globals.css (24 files, 15 Shadcn primitives)
- [x] packages/analytics — GA4 + Hotjar scaffold (8 files)
- [x] packages/forms — Zod + Formspree + sanitization scaffold (10 files)
- [x] Verify: pnpm build compiles all packages (all 5 packages compile, 33 static pages generated)

## Phase 3: Website App Scaffolding
- [x] apps/website — Next.js App Router + package.json + tsconfig
- [x] next-intl i18n routing (routing.ts, request.ts, navigation.ts, middleware)
- [x] App Router structure — all 14 page stubs under [locale]/
- [x] SST config (sst.config.ts)
- [x] SEO foundation (metadata.ts)
- [x] Verify: pnpm dev starts, / and /pt-br/ render (works with `--hostname 127.0.0.1` in PRoot env)

## Phase 4: Design System / Shared UI
- [x] Shadcn primitives (15 components)
- [x] Layout components (PageLayout, SectionLayout, TwoColumnLayout, GridLayout, LegalPageLayout)
- [x] Navigation components (Header, MobileMenu, Footer, LanguageSelector)
- [x] Content components (16 components)
- [x] Interactive components (ROICalculator, IntegrationFilter)
- [x] Form components (GetStartedForm)

## Phase 5: Core Pages
- [x] Homepage (/) — 8 sections
- [x] Product (/product) — 6 sections
- [x] Pricing (/pricing) — 5 sections

## Phase 6: Trust Pages
- [x] Security (/security) — 7 sections
- [x] Integrations (/integrations) — 3 sections
- [x] Compare (/compare) — 4 sections

## Phase 7: Competitor VS Pages
- [x] /vs/resolve-ai
- [x] /vs/incident-io
- [x] /vs/rootly
- [x] /vs/incidentfox

## Phase 8: Company Pages
- [x] About (/about) — 4 sections
- [x] Get Started (/get-started) — 2 sections

## Phase 9: Legal Pages
- [x] Privacy (/privacy)
- [x] Terms (/terms)

## Phase 10: Polish & Performance
- [x] Scroll-triggered animations (AnimateOnScroll + useAnimateOnScroll hook)
- [x] Audit trail typing animation (TypingAnimation component)
- [x] Logo carousel CSS animation (@keyframes scroll in globals.css)
- [x] Metric count-up animation (CountUp component)
- [x] Lighthouse audit (Performance 95+, A11y 100, SEO 100) — 396/396 tests passing
- [x] Security headers (CSP in next.config.ts)
- [x] Structured data (JSON-LD: Organization, WebSite, FAQ schemas)
- [x] robots.ts + sitemap.ts (done in Phase 3)

## Phase 11: PT-BR Translations
- [x] Translate all 14 pages + shared components (full pt-br.json)
- [x] All EN keys present in PT-BR, no placeholders remaining
