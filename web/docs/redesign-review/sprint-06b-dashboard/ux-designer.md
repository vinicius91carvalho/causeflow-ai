# UX Designer Persona — Dashboard + Legal Audit (Sprint 06b)

**Reviewer:** Senior UX Designer persona
**Date:** 2026-04-19
**Environment:** Dashboard http://localhost:3001 (staging backend), Website http://localhost:3000
**Viewport sweep:** 390 mobile, 768 tablet, 1440 desktop — light + dark mode
**Status:** COMPLETE

---

## Summary

The systemic UX pattern across the CauseFlow dashboard is **invisible loading**: nearly every route renders a fully-black or near-black blank screen instead of a skeleton or meaningful loading state, stranding the user in an undifferentiated void with no signal that content is on its way. At 390px mobile this affects 100% of the routes audited (dashboard, incidents, analyses/new, integrations, team). At tablet 768px the same blank-screen loading regression appears for dashboard and team. Desktop light is the only viewport where loading skeletons are visible (Incidents list, Integrations catalog), but the Overview, Billing, and Topology routes are blank even at 1440px. Dark mode at desktop compounds this — dark-on-dark skeletons become imperceptible. Layered on top of this systemic skeleton failure are copy inconsistencies (the URL is `/dashboard/analyses` but the UI says "Incidents"), a settings page that shows an "Only admins can manage API keys" message to what appears to be the only user (the organization owner), a Team page that exposes a "Development mode" watermark in the Clerk panel, an onboarding modal that defeats its own localStorage skip guard on fresh browser contexts, and legal pages whose typography line-height and heading spacing drop below comfortable reading standards on mobile. 3 observations are P0.

---

## Observations

### P0 (Blocker / ship-stopper)

---

**OBS-01**
- **Severity:** P0
- **Location:** `/dashboard` (Overview) — all viewports — light and dark
- **Observation:** The Overview page renders as a completely blank dark screen at every viewport. At 1440px desktop light, the page body is empty (only the nav sidebar and a "Welcome to your CauseFlow AI dashboard" subtitle are present, no widgets, no stats, no CTAs). At 390px mobile and 768px tablet, even the sidebar collapses and the entire viewport shows only the dark background with a grid pattern, indistinguishable from an error or crashed state. The persistent bottom-left "Loading…" indicator (a small spinner inside the nav) is the only signal that something is happening.
- **Why it matters:** The Overview is the first screen every user sees after sign-in. A blank page creates immediate doubt about whether the product is working. The grid-pattern background at smaller breakpoints gives zero affordance — there is no skeleton, no empty-state illustration, no copy explaining what will appear. First-time users will assume the product is broken.
- **Recommendation:** Implement a skeleton layout for the Overview that matches the intended widget grid. Even a three-card placeholder with shimmer lines is sufficient to communicate "data is loading." Alternatively, if the page has no widgets yet (fresh tenant), render an explicit empty state with a CTA ("Create your first incident to see insights here").
- **Screenshot:** `dash-desktop-light.png`, `dash-tablet-light.png`, `analyses-mobile-light.png`

---

**OBS-02**
- **Severity:** P0
- **Location:** `/dashboard/billing` — desktop 1440 — light and dark
- **Observation:** The Billing page renders as a solid dark rectangle — no content, no skeleton, no loading indicator, no error message — at both 1440px light and dark. The server returned HTTP 307 (redirect) during initial checks and later `ERR_CONNECTION_REFUSED` during repeated automation runs, suggesting the billing route may have a compilation or routing problem rather than merely a loading delay. Even under normal access the billing page is fully black.
- **Why it matters:** Billing is a high-stakes page. Users land here when they need to upgrade, check their plan, or understand their usage. A completely blank page on a critical commercial route actively blocks revenue conversion and erodes trust. If the page is genuinely broken (not just slow to load), this is a regression that must be resolved before release.
- **Recommendation:** (1) Investigate whether `billing-desktop-light.png` represents a compile-time error or a Stripe context issue. (2) Add an explicit loading skeleton for the billing plan card, usage meter, and invoice list. (3) If the Stripe context is unavailable (no customer ID), render a meaningful fallback — "Unable to load billing information. Contact support at legal@causeflow.ai."
- **Screenshot:** `billing-desktop-light.png`, `billing-desktop-dark.png`

---

**OBS-03**
- **Severity:** P0
- **Location:** All routes — mobile 390px — light mode
- **Observation:** At 390px, every dashboard route renders as an empty dark screen (just the grid-dot pattern background) with no sidebar, no header, no content, and no visible skeleton. This is not a "skeleton that blends in" problem — there is literally no UI chrome, no hamburger menu, no breadcrumb, no page title. The browser's Next.js "N" favicon badge is the only visual element visible in the bottom-left corner. This affects: `/dashboard`, `/dashboard/analyses`, `/dashboard/analyses/new`, `/dashboard/integrations`, `/dashboard/team`, `/dashboard/settings` (settings at least shows API Keys content, but the layout is still sideless).
- **Why it matters:** Mobile is a mandatory viewport for any SaaS product. Engineering teams use phones and tablets for on-call incident response — which is exactly the scenario CauseFlow is built for. If every page is blank on mobile, the product is unusable during the highest-urgency moments. This is a complete mobile UX failure.
- **Recommendation:** (1) Verify the mobile breakpoint for the sidebar — it should either collapse to a hamburger + drawer, or use a bottom-tab nav. (2) Ensure the main content region renders at `width: 100%` when the sidebar is hidden. (3) Investigate whether the grid pattern (`bg-grid`) is obscuring content via a z-index conflict at mobile widths.
- **Screenshot:** `analyses-mobile-light.png`, `analyses-new-mobile-light.png`, `integrations-mobile-light.png`, `team-mobile-light.png`

---

### P1 (Should-fix before next release)

---

**OBS-04**
- **Severity:** P1
- **Location:** `/dashboard/analyses` — desktop 1440 — light and dark
- **Observation:** The route `/dashboard/analyses` silently redirects to `/dashboard/incidents` in the browser. The page title reads "Incidents", the breadcrumb reads "Incidents", and the nav sidebar item is labelled "Incidents". The URL in the browser bar becomes `/dashboard/incidents`. The navigation link in the sidebar is also labelled "Incidents" (not "Analyses" or "Investigations"). This is a naming collision: the marketing site, the user-facing task (starting an investigation/analysis), and the internal route all use different nouns for the same concept. The "New Analysis" breadcrumb on the creation form (`analyses-new-desktop-light.png`) says "New Analysis" while the back-link says "← Incidents" and the H1 says "New Incident."
- **Why it matters:** Mixed terminology breaks user mental models and makes documentation, error messages, and onboarding copy confusing. A user who reads "Create Analysis" in the marketing materials, then lands in the "Incidents" section, will wonder if they are in the wrong place.
- **Recommendation:** Pick one canonical noun — "Incident" or "Analysis" — and apply it consistently across: nav labels, page H1s, breadcrumbs, button copy, back-link copy, URL slugs, and API responses. The current mix (route says "analyses", UI says "Incidents", form header says "New Analysis") strongly suggests the route was renamed without updating the UI copy.
- **Screenshot:** `analyses-list-desktop-light.png`, `analyses-new-desktop-light.png`

---

**OBS-05**
- **Severity:** P1
- **Location:** `/dashboard/analyses` — desktop 1440 — light and dark
- **Observation:** The Incidents list page shows three loading skeleton rows permanently — they never resolve to real content or an empty state, even after 4+ seconds of wait time. The skeleton rows are visible at desktop but their background color (`bg-muted`) is nearly invisible in dark mode (dark skeletons on a dark background). The Status dropdown in dark mode also loses its placeholder label ("All Statuses" visible in light mode becomes empty in dark mode, showing only the select chrome).
- **Why it matters:** (1) Skeleton rows that never resolve look like broken loading states rather than empty states. If there is genuinely no data, the page should transition to an illustrated empty state with a CTA. (2) Invisible skeletons in dark mode mean users see a blank page with no loading signal — the Sprint 06 regression mentioned in the brief. (3) A dropdown losing its label in dark mode is a WCAG contrast failure.
- **Recommendation:** (1) Add a timeout (e.g. 3s) after which, if no data has loaded, switch from skeleton → empty state. (2) Bump skeleton contrast in dark mode — use `bg-muted-foreground/20` or similar to ensure ≥3:1 contrast ratio against the dark background. (3) Fix the Status/Severity dropdown label color in dark mode — it should use `text-muted-foreground` not inherit transparent.
- **Screenshot:** `analyses-list-desktop-light.png`, `analyses-list-desktop-dark.png`

---

**OBS-06**
- **Severity:** P1
- **Location:** `/dashboard/settings` — desktop 1440 and mobile 390 — light and dark
- **Observation:** The Settings page shows "API Keys — Manage API keys for external integrations" as its only content. The logged-in user (`vinicius@simuser.ai`) is a member of the "SimUser AI" organization — presumably the owner. Yet the page displays "Only admins can manage API keys" below the section header in dark mode, and shows three loading skeleton bars that appear to be unresolved in light mode. In dark mode the "Only admins can manage API keys" message appears against a dark card — the text is readable but there's no icon, no "Request access" CTA, and no explanation of who the admin is or how to contact them.
- **Why it matters:** (1) If the currently logged-in user is the org owner, showing an "admins only" block is a permission model bug or a role detection failure. (2) If this message is correct and the user genuinely lacks permissions, the UX leaves them completely stranded — no next action, no escalation path, no "Contact your admin" mailto link. (3) The discrepancy between light mode (skeletons persist) and dark mode (permission message appears) suggests the RBAC gate is rendering differently by color scheme, which is a logic error.
- **Recommendation:** (1) Debug RBAC role detection for this user. (2) If the block is correct, add: icon + headline ("Admin Access Required") + body ("API key management requires the Admin role. Ask SimUser AI's admin to grant you access.") + action button ("Contact admin"). (3) Ensure the RBAC check renders consistently across color schemes — it should not differ between light and dark.
- **Screenshot:** `settings-desktop-light.png`, `settings-desktop-dark.png`, `settings-mobile-light.png`

---

**OBS-07**
- **Severity:** P1
- **Location:** `/dashboard/team` — desktop 1440 — light mode
- **Observation:** The Team page shows a Clerk-rendered "General" panel with an "Organization Profile" row listing "SimUser AI" and an "Update profile" link, plus a "Leave organization" link. A "Development mode" orange badge is prominently watermarked at the bottom of the Clerk panel. At tablet (768px) and mobile (390px), the entire Team page body is blank — no sidebar panel, no content card, just the breadcrumb "Dashboard > Team" at the top and then nothing.
- **Why it matters:** (1) "Development mode" is a Clerk-rendered watermark that appears in test/dev environments — it must not appear in staging or production. If this is staging, this is a configuration issue. (2) The Team page body is invisible at tablet and mobile — the Clerk `<OrganizationProfile>` component apparently doesn't render at narrower breakpoints, or has an overflow/height issue that clips it to 0px. (3) The Team page as shown has extremely sparse content — only "General" and "Members" sub-tabs — with no "Invite team member" button visible in the overview state, making the primary action undiscoverable.
- **Recommendation:** (1) Configure Clerk's `appearance` prop to suppress the "Development mode" badge in staging (set `afterSignInUrl` and use production Clerk instance or configure environment variable). (2) Fix the Clerk `OrganizationProfile` container height at tablet/mobile — add `min-h-[600px]` or use Clerk's `routing: "hash"` mode with explicit height. (3) Surface "Invite member" as a primary CTA on the General tab or make the Members tab the default.
- **Screenshot:** `team-desktop-light.png`, `team-tablet-light.png`, `team-mobile-light.png`

---

**OBS-08**
- **Severity:** P1
- **Location:** `/dashboard` — desktop 1440 — light mode (initial load, first-time user)
- **Observation:** On first auth (before the localStorage skip guard fires), the page renders an onboarding modal: "Welcome, Detective — STEP 1 OF 6". The modal is well-styled but has a UX issue: the progress dots (6 total) show only 1 active, with 5 remaining as very small grey dots — the contrast between active (filled teal) and inactive (dark grey on dark background) is extremely low, making the dot indicators nearly invisible as progress markers. Additionally, a "Skip Tutorial" link appears below the primary CTA but is styled as body text with no underline or visual affordance indicating it's clickable.
- **Why it matters:** (1) Low-contrast progress dots fail WCAG 1.4.3 — the inactive dots are insufficient to communicate "5 more steps". (2) "Skip Tutorial" as unstyled text is an affordance failure — users who want to skip must discover it through trial. If a user dismisses the modal by clicking the X (which is also small, at ~16px × 16px on a 1440 viewport), they may lose access to the tutorial entirely with no recovery path.
- **Recommendation:** (1) Increase inactive dot opacity/size or use a stepped progress bar instead. Minimum contrast ratio 3:1. (2) Style "Skip Tutorial" as an underlined link or secondary button. (3) Add a "Restart tutorial" entry point in the Help menu or Settings. (4) Increase the X close button hit-target to 44px minimum.
- **Screenshot:** `auth-success.png`

---

**OBS-09**
- **Severity:** P1
- **Location:** `/dashboard/analyses/new` — desktop 1440 — light and dark
- **Observation:** The "New Incident" creation form has a clear layout (title, description, severity radio buttons, investigation mode). UX issues observed: (1) The "Investigation mode" field shows a "STAFF" badge and a single input with placeholder "template-driven, fastest" — but there is no radio/select to choose between modes, and no explanation of what "STAFF" means or what other modes exist. It reads like a read-only display, not an interactive field. (2) The "Severity" radio buttons use colored circles (red = Critical, orange = High, teal = Low, dark blue = Info) — but no severity is pre-selected, meaning the form will submit without a required field unless the user actively picks one. The asterisk on "Severity *" is not visually prominent enough. (3) The back-link "← Incidents" and the breadcrumb "Dashboard > New Analysis" use conflicting terminology (Incidents vs Analysis). (4) There is no character count on the Description textarea, no inline validation, and no autofocus on the title field.
- **Why it matters:** A form that creates the core product object (an investigation) must be unambiguous and guide the user confidently. The "STAFF" mode label and lack of mode selection makes the form feel incomplete. Missing autofocus means keyboard users must tab through the nav before reaching the first input. Missing validation means error states only surface on submit, which is a poor recovery UX.
- **Recommendation:** (1) Add a mode selector (radio group or tabs: "Template-driven" / "Custom") with brief description for each. (2) Pre-select a default Severity (e.g. Medium). (3) Autofocus the Incident Title input on mount. (4) Add inline validation with helper text. (5) Harmonize "New Incident" vs "New Analysis" terminology throughout.
- **Screenshot:** `analyses-new-desktop-light.png`, `analyses-new-desktop-dark.png`

---

### P2 (Nice-to-have polish)

---

**OBS-10**
- **Severity:** P2
- **Location:** Legal pages (`/privacy`, `/terms`, `/pt-br/privacy`, `/pt-br/terms`) — mobile 390 — EN and PT-BR
- **Observation:** Both Privacy Policy and Terms of Service are extremely long single-column documents with no in-page navigation, no sticky table-of-contents, and no "back to top" affordance. At mobile (390px), the body text is readable but the section headings (h2-level labels like "Data Collected", "Customer Data", "GDPR Rights") have insufficient visual separation from the body text — the heading size step is very small, and there is minimal vertical whitespace before each section. The PT-BR pages are visually identical in structure to EN (good for parity) but the word density is higher in Portuguese (sentences are longer), making the paragraphs feel denser without line-height compensation. The "Get Started" button in the top nav of legal pages uses the same teal primary button style as everywhere, but at 390px the nav becomes a single row with nav links wrapping below — creating an awkward two-line header.
- **Why it matters:** Legal pages are read during evaluation moments (pre-purchase due diligence, compliance reviews). Dense, unnavigable long-form text on mobile increases abandonment and creates a "we don't care about compliance UX" signal to security-conscious buyers.
- **Recommendation:** (1) Add a sticky sidebar ToC on desktop with anchor links for each major section. (2) On mobile, add a collapsible ToC at the top (accordion-style). (3) Increase `mb` spacing before h2 headings from the current ~12px to 32px. (4) Add a floating "↑ Back to top" button after 500px of scroll. (5) Fix the two-line mobile header — either use an icon-only hamburger nav or reduce link count in the legal page header to just Home + CTA.
- **Screenshot:** `legal-privacy-en-mobile.png`, `legal-terms-en-mobile.png`, `legal-privacy-ptbr-desktop.png`

---

**OBS-11**
- **Severity:** P2
- **Location:** Dashboard initial load — all viewports — light mode
- **Observation:** The initial page load (before auth, or with slow Clerk initialization) shows a centered logo spinner on a pure-black background with no loading text, no brand name, no progress indication. The spinner is the CauseFlow brain logo outlined in teal, with a circular rotation animation — visually attractive but entirely undescribed. There is no "Loading CauseFlow AI…" caption, no estimated time, no fallback skeleton. On cold first load this state persists for 3-8 seconds in the PRoot environment.
- **Why it matters:** A branded loading screen is fine; an unlabeled spinner with no text is inaccessible (no `aria-label` or `role="status"`) and leaves users uncertain whether the page is loading, has crashed, or is waiting for a network request. Screen reader users will hear nothing.
- **Recommendation:** (1) Add `role="status"` and `aria-label="Loading CauseFlow AI"` to the spinner container. (2) Add a brief "Loading…" text below the logo. (3) If load time exceeds 5s (detectable via a timer), show a fallback message: "Taking longer than usual. Check your connection."
- **Screenshot:** `signin-initial.png`

---

**OBS-12**
- **Severity:** P2
- **Location:** `/dashboard/integrations` — desktop 1440 — light mode
- **Observation:** The Integrations catalog shows 6 integration cards in a 3-column grid with loading skeletons. The skeletons are well-formed (logo placeholder, title bar, description bar, connect button placeholder) — this is the best skeleton implementation in the dashboard. However, the category filter tabs ("All", "Communication", "Monitoring", "Code", "Management", "CRM", "Database", "Knowledge", "API") overflow horizontally at 1440px without wrapping, creating a scrollable filter bar that has no scroll indicator, no chevron, and no visual boundary. At tablet (768px), the filter bar would be especially problematic. The search input ("Search integrations…") has a magnifying glass icon but no keyboard shortcut hint (e.g. ⌘K), and it's left-aligned while the filter tabs are full-width — the visual pairing between search and filter is unclear.
- **Why it matters:** A catalog with 9 filter categories and a search input needs clear spatial hierarchy. The overflow filter bar is a common UX failure — users on non-wide viewports will not discover the rightmost filters.
- **Recommendation:** (1) Wrap the filter tabs to two rows on overflow, or use a scrollable bar with visible left/right fade-and-chevron indicators. (2) Group search + filters visually as a single filter bar unit. (3) Add a keyboard shortcut hint to the search field. (4) Ensure filter tabs render at tablet without horizontal overflow.
- **Screenshot:** `integrations-desktop-light.png`

---

**Additional note — Topology route:**
- **Severity:** P2
- **Location:** `/dashboard/topology` — desktop 1440
- **Observation:** The Topology page is entirely blank (pure dark background, no content). Whether this is a page that requires data to render, a stub route, or a compile error is unclear. There is no "No topology data" empty state, no skeleton, and no error message.
- **Recommendation:** Add an empty state: illustration of a service graph, headline "No services connected yet", body "Connect your first integration to see your service topology", CTA button "Connect integrations".
- **Screenshot:** `topology-desktop-light.png`

---

## Legal Pages — Summary

| Page | EN Desktop | EN Mobile | PT-BR Desktop | PT-BR Mobile |
|---|---|---|---|---|
| Privacy Policy | Readable, clean | Dense, no ToC | Parity with EN, good | Dense | 
| Terms of Service | Very long, no ToC | Very long, no ToC | Parity with EN | Not captured |

Both legal pages render correctly and are linguistically complete in both locales. The primary UX concerns are: (1) absence of navigational anchors/ToC, (2) heading spacing on mobile, (3) two-line header on mobile. No broken layouts, no untranslated strings observed.

---

## Screenshots Index

| Filename | Route | Viewport | Mode |
|---|---|---|---|
| `auth-success.png` | `/dashboard` (with onboarding modal) | 1440 | dark |
| `dash-desktop-light.png` | `/dashboard` | 1440 | light |
| `dash-desktop-dark.png` | `/dashboard` | 1440 | dark |
| `dash-tablet-light.png` | `/dashboard` | 768 | light |
| `analyses-list-desktop-light.png` | `/dashboard/incidents` | 1440 | light |
| `analyses-list-desktop-dark.png` | `/dashboard/incidents` | 1440 | dark |
| `analyses-list-tablet-light.png` | `/dashboard/incidents` | 768 | light |
| `analyses-mobile-light.png` | `/dashboard/incidents` | 390 | light |
| `analyses-new-desktop-light.png` | `/dashboard/analyses/new` | 1440 | light |
| `analyses-new-desktop-dark.png` | `/dashboard/analyses/new` | 1440 | dark |
| `analyses-new-mobile-light.png` | `/dashboard/analyses/new` | 390 | light |
| `integrations-desktop-light.png` | `/dashboard/integrations` | 1440 | light |
| `integrations-mobile-light.png` | `/dashboard/integrations` | 390 | light |
| `team-desktop-light.png` | `/dashboard/team` | 1440 | light |
| `team-desktop-dark.png` | `/dashboard/team` | 1440 | dark |
| `team-tablet-light.png` | `/dashboard/team` | 768 | light |
| `team-mobile-light.png` | `/dashboard/team` | 390 | light |
| `settings-desktop-light.png` | `/dashboard/settings` | 1440 | light |
| `settings-desktop-dark.png` | `/dashboard/settings` | 1440 | dark |
| `settings-mobile-light.png` | `/dashboard/settings` | 390 | light |
| `billing-desktop-light.png` | `/dashboard/billing` | 1440 | light |
| `billing-desktop-dark.png` | `/dashboard/billing` | 1440 | dark |
| `topology-desktop-light.png` | `/dashboard/topology` | 1440 | light |
| `signin-initial.png` | `/` (initial load) | 1440 | dark |
| `signin-after-email.png` | Clerk password step | 1440 | dark |
| `signin-post-submit.png` | Clerk device verification | 1440 | dark |
| `legal-privacy-en-desktop.png` | `/privacy` | 1440 | light |
| `legal-privacy-en-mobile.png` | `/privacy` | 390 | light |
| `legal-terms-en-desktop.png` | `/terms` | 1440 | light |
| `legal-terms-en-mobile.png` | `/terms` | 390 | light |
| `legal-privacy-ptbr-desktop.png` | `/pt-br/privacy` | 1440 | light |
| `legal-privacy-ptbr-mobile.png` | `/pt-br/privacy` | 390 | light |
| `legal-terms-ptbr-desktop.png` | `/pt-br/terms` | 1440 | light |
