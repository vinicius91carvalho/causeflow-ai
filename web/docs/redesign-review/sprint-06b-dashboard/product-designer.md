# Product Designer Persona — Dashboard Audit (Sprint 06b)

**Reviewer:** Senior Product Designer persona
**Date:** 2026-04-19
**Environment:** Dashboard http://localhost:3001 (staging Core API backend)
**Status:** COMPLETE

---

## Summary

The dashboard suffers from a **pervasive "loading-forever" anti-pattern** across its Overview, Billing, and Integrations surfaces: skeleton loaders appear at screenshot time but never resolve to content (the Core API response arrives after the screenshot window). More critically, the **information architecture presents 10 sidebar contexts to a user who sees almost nothing on the home screen** — Overview shows only a welcome message and an animated star-field, delivering zero actionable data. The approvals bounded context has no dedicated sidebar entry, no badge, and no route — `approval_required` notifications exist in the bell but link to `remediations/:id` routes that do not exist as pages. The investigation creation form exposes a staff-only "Investigation mode" selector without a role gate visible to users, and the breadcrumb says "New Analysis" while the page title says "New Incident" — a domain naming collision that is the most visible symptom of an underlying "incident vs analysis vs investigation" terminology inconsistency running through all 10 contexts. **4 P0 findings, 5 P1 findings, 5 P2 findings.**

---

## Observations

### P0

---

**OBS-01**
- **Severity:** P0
- **Context:** shared — Overview (home screen)
- **Route:** `/dashboard`
- **Observation:** The Overview page renders a welcome headline ("Welcome to your CauseFlow AI dashboard") and an animated teal star-field, but no metrics, no recent incidents, no quick-action CTAs, and no credits summary in the main content area. The sidebar credits widget shows "Loading..." persistently. The entire main content area is blank.
- **Why it matters:** The home screen is the primary orientation surface. A blank canvas with a decorative animation tells the user nothing about their account state, active incidents, or next step. First-session users have no nudge to create an investigation; returning users have no at-a-glance incident health. This is a complete task-flow dead-end for the most common entry point.
- **Recommendation:** The Overview page must render at least three things without waiting for all API calls: (1) a prominently placed "New Incident" CTA, (2) a skeleton→metric card for recent incidents count, (3) credits remaining with plan name. The animated star-field should be a background element, not the primary content. The `DashboardOverview` component fetches `/api/metrics` and `/api/integrations` in parallel — these should show skeleton cards that resolve, not a blank wait state. If the staging Core API is slow, show optimistic empty-state content rather than nothing.
- **Screenshot:** `01-dashboard-overview.png`

---

**OBS-02**
- **Severity:** P0
- **Context:** investigation
- **Route:** `/dashboard/incidents/new`
- **Observation:** The breadcrumb reads **"Dashboard › New Analysis"** while the page H1 reads **"New Incident"** and the description reads "Report a new incident for investigation." These three labels use three different domain nouns for the same object: Analysis (breadcrumb), Incident (H1), Investigation (description). The sidebar nav link reads "Incidents." The `/dashboard/analyses/new` route silently redirects to `/dashboard/incidents/new`. No user-facing explanation of the redirect exists.
- **Why it matters:** Domain coherence is fundamental to user trust in an incident-investigation tool. If a user navigates here from "Analyses" and arrives at a page titled "New Incident," they question whether they are in the right place. Engineers adopting the tool will use these terms in runbooks and Slack — inconsistency here propagates into team vocabulary. The silent redirect from `/analyses/new` is particularly dangerous because any bookmarked or shared URL to the old path gives no indication the user ended up at a different destination.
- **Recommendation:** Decide on one canonical noun (recommendation: "Incident") and apply it consistently to: breadcrumb, H1, description, sidebar nav label, route path (`/analyses` → `/incidents`), API response field names surfaced to the UI, and empty state CTAs. The `/analyses` route family should either be removed or show a permanent-redirect banner for 30 days.
- **Screenshot:** `03-new-incident-form-empty.png`

---

**OBS-03**
- **Severity:** P0
- **Context:** approvals
- **Route:** No dedicated route exists
- **Observation:** The approvals bounded context has a `approvals-list.tsx` component and the notification bell surfaces `approval_required` notifications, but there is no sidebar entry for approvals, no `/dashboard/approvals` route, and no badge on any nav item signaling pending approvals. Approval items in the notification bell link to `/dashboard/remediations/:id` — a route that does not exist as a page in the `src/app/[locale]/dashboard/` directory.
- **Why it matters:** Approvals are time-sensitive (they expire). A user receiving an `approval_required` notification clicks through and lands on a 404 or a redirect to the incidents list — the approval action is completely unreachable. This is a broken task flow with a hard deadline, meaning incidents that need remediation sign-off will expire without action, causing operational impact.
- **Recommendation:** Add a `/dashboard/approvals` route and a sidebar nav entry (with pending-count badge). The `approvals-list.tsx` component exists — it just needs a page shell and route registration. The notification bell `approval_required` items should deep-link to `/dashboard/approvals?filter=pending`. Verify the `/dashboard/remediations/:id` route exists or fix the link target.
- **Screenshot:** (code-verified; no screenshot of approvals surface exists because no route is reachable)

---

**OBS-04**
- **Severity:** P0
- **Context:** billing
- **Route:** `/dashboard/billing`
- **Observation:** The billing page shows only skeleton loaders — four plan-tier cards and one current-plan summary card are all in loading state. The skeleton shapes match a card grid but no resolved content appeared within the 5-second wait window. The sidebar credits widget ("41 investigations left / 19/60 Used") is the only resolved billing signal on the entire screen.
- **Why it matters:** Users visiting billing to understand their current plan, credits consumed, or to upgrade are presented with permanent skeleton state. This is especially acute when approaching a credit limit — the user cannot see their actual plan tier or upgrade options. The credits widget in the sidebar gives the count but not the plan name or renewal date.
- **Recommendation:** Implement a hard timeout (3s) after which billing shows partial data or an error recovery affordance rather than perpetual skeleton. The current-plan card (plan name, renewal date, credits) should be rendered server-side where possible. The four plan-tier cards can remain client-loaded but must show a "Could not load plans — Retry" state after 5s rather than infinite skeleton.
- **Screenshot:** `06-billing-page.png`

---

### P1

---

**OBS-05**
- **Severity:** P1
- **Context:** investigation
- **Route:** `/dashboard/incidents/new` (form) → post-submit (detail)
- **Observation:** The investigation creation form exposes an "Investigation mode" selector visually tagged with a "STAFF" badge showing a dropdown labeled "Symptom-driven, fastest." This control is visible to all authenticated users in the UI despite being intended only for staff. The form code comments say "BFF + Core API silently drop this field for non-staff" — so the data is ignored server-side, but the UI still renders it, confusing non-staff users about whether they are picking an AI behavior that matters.
- **Why it matters:** A non-staff user sees a UI control they cannot actually influence. They may spend time selecting an investigation mode that has no effect on their analysis. If the mode label changes or if a non-staff user reports a bug ("I selected Orchestrator mode but it ran the wrong mode"), support cost and trust erosion follow. Staff controls that are client-rendered without a real gate are also a security-in-depth concern.
- **Recommendation:** Gate the investigation mode selector at the component level with an `isStaff` check (the hook already exists: `useIsStaff()`). Non-staff users should not see the field at all. Alternatively, if the mode selector is intended for all users in the future, remove the STAFF badge and document the behavior for all tiers.
- **Screenshot:** `03-new-incident-form-empty.png`

---

**OBS-06**
- **Severity:** P1
- **Context:** investigation (incidents list)
- **Route:** `/dashboard/incidents`
- **Observation:** The incidents list shows a skeleton loader state (3–4 shimmer rows) on every page load. The list was captured in skeleton state at 5-second wait time. The resolved state (with actual incident rows) was captured only when the browser navigated from a form submission and the list re-rendered with fresh data. There is no visible empty state distinguishing "loading" from "no incidents yet" — both look like a list of shimmer rows.
- **Why it matters:** If the Core API takes > 5s (common in staging), users cannot distinguish between "loading" and "error" — they are stuck looking at shimmer bars indefinitely. A user with zero incidents sees no empty state CTA ("Create your first incident") because the component never transitions out of loading.
- **Recommendation:** Implement a loading timeout (e.g. 8s) after which the skeleton is replaced by an error state with a Retry button. The empty state (0 incidents returned by API) should always render even during slow loads — if `incidents.length === 0` and `!isLoading`, show the empty state with "New Incident" CTA immediately. The `EmptyState` component already exists and links to `/dashboard/analyses/new` (itself a stale route — see OBS-02).
- **Screenshot:** `02-incidents-list.png`, `16-incidents-list-state.png`

---

**OBS-07**
- **Severity:** P1
- **Context:** settings
- **Route:** `/dashboard/settings`
- **Observation:** The Settings page shows only an "API Keys" section with the message "Only admins can manage API keys." Below that are three skeleton-loading placeholder blocks that never resolve. There is no user-profile section, no notification preferences, no locale preferences, and no team-level settings visible (even for admins). The page header says "Settings" with no sub-navigation.
- **Why it matters:** Users expect Settings to be the control plane for their account. Showing a single RBAC-blocked message and perpetual skeletons creates the impression the page is broken. An admin user would also see the same skeleton state if the API is slow — there is no resolved state visible. The lack of sub-navigation (tabs or sidebar links for Profile / API Keys / Notifications / Locale) means the settings surface has no discoverable IA.
- **Recommendation:** Add a settings sub-navigation (tabs or left-nav): Profile, API Keys, Notifications, Locale/Language. The profile section should render immediately from the Clerk user object (no API call needed). API Keys should show an empty state for non-admins explaining what API keys are and prompting them to ask their admin — not just a terse "Only admins can manage API keys." Skeleton sections with no timeout create a broken appearance.
- **Screenshot:** `07-settings-page.png`

---

**OBS-08**
- **Severity:** P1
- **Context:** team
- **Route:** `/dashboard/team`
- **Observation:** The Team page renders Clerk's embedded `<OrganizationProfile>` component, showing only "General" and "Members" sub-tabs. The General tab displays "Organization Profile" and a "Leave organization" option. There is no invite member button visible on the General tab (it would be under Members). The page has no custom header, no context-specific description, and no breadcrumb sub-label to orient the user. The sidebar "Team" label takes the user to what is effectively a Clerk-hosted settings embed, not a CauseFlow-styled team management view.
- **Why it matters:** The Clerk embed uses Clerk's default styling which diverges from the CauseFlow design system (different font, card borders, color palette). More importantly, the most common team action (invite a member) is buried one tab deep inside an embedded component with no affordance from the outer page. Users navigating here to invite a colleague face a non-obvious UX.
- **Recommendation:** Add a custom page header with "Invite member" as a primary CTA button that deep-links to the Members tab of the Clerk embed (or opens an invite modal directly). Consider wrapping the Clerk embed with a CauseFlow-styled container that matches the card/border conventions of the rest of the dashboard. The Clerk appearance API can inject design-system tokens.
- **Screenshot:** `05-team-page.png`

---

**OBS-09**
- **Severity:** P1
- **Context:** integrations
- **Route:** `/dashboard/integrations`
- **Observation:** The integrations page renders a category filter bar (All, Communication, Monitoring, Code, Management, CRM, Database, Knowledge, API) and a 3-column grid. All integration cards are in skeleton state — logos, names, and connect buttons are all shimmer. The category filter pills are visible and styled. At 5 seconds wait time, no card resolved to showing actual integration data.
- **Why it matters:** The integrations page is a key onboarding surface — users must connect at least one integration before running a meaningful investigation. If all cards show as loading skeletons indefinitely, users cannot connect anything. The category filters are functional (pill styles render) but useless when the card content is never resolved.
- **Recommendation:** Integration catalog data is static — it should be bundled as a constant (the code already has `INTEGRATION_CATALOG` in `integration-catalog.tsx`) and rendered immediately without an API call. Only the "is this integration connected?" status badge needs a live API fetch, and it should overlay on an already-rendered card. This would eliminate the loading state for the catalog entirely.
- **Screenshot:** `04-integrations-page.png`

---

### P2

---

**OBS-10**
- **Severity:** P2
- **Context:** shared — mobile navigation
- **Route:** `/dashboard` at 390px
- **Observation:** At mobile viewport (390×844), the dashboard renders a horizontal topbar with a hamburger menu icon (☰), the CauseFlow brain logo, dark-mode toggle, language switcher, user name/avatar, and a notification bell. The sidebar is hidden off-screen. The main content area shows "Overview / Welcome to your CauseFlow AI dashboard" with no sidebar visible and no content in the body. The hamburger icon is present but clicking it within the mobile audit produced a timeout — the `aria-label="Close menu"` button was matched instead of the open trigger, indicating the button targeting is ambiguous between open and close states.
- **Why it matters:** Mobile access to an incident dashboard is a real use case (on-call engineers). The navigation trigger may be unreliable for automated testing but also represents a potential tap-target ambiguity for users. The topbar is also very dense at 390px — six elements compete in the header row, some potentially falling below the minimum 44px tap target height.
- **Recommendation:** Separate the hamburger open-trigger (`aria-label="Open menu"`) from the close button (`aria-label="Close sidebar"`). Audit tap-target sizes for all topbar icons at 390px — the current `h-8 w-8` for desktop icons downsizes too aggressively. On mobile the credits widget in the sidebar footer is hidden, meaning users never see credit/plan information on mobile at all — surface this in the topbar or a dismissible banner.
- **Screenshot:** `17a-mobile-closed.png`

---

**OBS-11**
- **Severity:** P2
- **Context:** shared — sidebar credits widget
- **Route:** All `/dashboard/*` routes
- **Observation:** The sidebar credits widget shows "41 investigations left" with a usage bar and "starter — 19/60 used" in 10px font. The plan label says "starter" in lowercase with an em-dash separator. When collapsed, the credits widget shows only a credit-card icon with no tooltip or count — the plan and remaining credits become invisible.
- **Why it matters:** The credits widget is the only persistent plan-health indicator. "41 investigations left" uses "investigations" not "incidents" or "analyses" — adding to the domain terminology inconsistency (OBS-02). The 10px font for the plan/usage label is below accessible minimum size (12px). In collapsed sidebar state, credit information is completely hidden with no alternative surface.
- **Recommendation:** Use consistent terminology ("incidents" or "analyses") in the credits widget. Increase the plan label font to 12px minimum. In collapsed state, add a tooltip that shows "41 of 60 remaining — Starter" on hover. Consider adding a low-credits warning that persists across the topbar (not just sidebar) when credits drop below 20%.
- **Screenshot:** `16b-incident-detail-mid.png` (sidebar visible with credits widget)

---

**OBS-12**
- **Severity:** P2
- **Context:** investigation (SSE stream)
- **Route:** `/dashboard/incidents/:id` (processing state)
- **Observation:** From the code review: The `DisconnectedBanner` component has no automatic reconnect — it only shows a "Retry" button. The banner shows for both `disconnected` and `error` states, but there is no distinction in messaging between "lost connection" (transient, will self-heal) and "error" (may need user action). The banner uses `role="alert"` for disconnected/error states but uses `<output>` with `aria-live="polite"` for the connecting state — this is semantically inconsistent (connecting is also status info, not output).
- **Why it matters:** SSE disconnection is common on flaky mobile connections. A user watching a live investigation feed needs to know if the stream is temporarily reconnecting vs. permanently broken. The current binary (spinner = connecting, amber alert = disconnected/error) does not distinguish intentional reconnect from unexpected failure. Manual retry without auto-reconnect means any brief network hiccup kills the live feed permanently unless the user notices and clicks Retry.
- **Recommendation:** Add a brief (3s) auto-reconnect attempt on disconnection before surfacing the manual Retry button. Distinguish error states: "Reconnecting..." (auto) vs. "Connection lost — Retry" (manual after auto-retry exhausted). Use `role="status"` for the connecting state (not `<output>`). Consider a subtle "Live" indicator dot in the incident header that pulses green when connected and turns amber on disconnect.
- **Screenshot:** (not captured — requires a live SSE disconnect event during testing)

---

**OBS-13**
- **Severity:** P2
- **Context:** investigation (creation flow)
- **Route:** `/dashboard/incidents/new` → post-submit state
- **Observation:** After form submission, the navigation log shows a redirect to `/dashboard/incidents` (list) rather than `/dashboard/incidents/:id` (the newly created incident detail). The success toast says "Incident created! Redirecting..." but the user lands on the list, not the specific incident. The list renders in skeleton state, so the newly created incident is not immediately visible. The user has no direct path to their new incident.
- **Why it matters:** The most critical moment in the investigation flow is immediately after creation, when the SSE live-feed should begin streaming agent progress events. Dropping the user on the incident list means they must find their new incident in a skeleton-loading list — they may miss the initial live-feed activity or not realize the investigation has started. The code does handle the `incidentId` redirect (`router.push(\`/dashboard/incidents/${id}\`)`) but the audit captured a list-page landing, suggesting either the ID was absent in the API response or the redirect failed silently.
- **Recommendation:** Verify the API response always returns `incidentId` on creation. If the ID is missing, redirect to the list AND surface a toast with "Your incident is processing — find it in the list below" with auto-scroll to the top item. The preferred UX is always redirect to the specific incident detail page immediately after creation.
- **Screenshot:** `15a-invest-form-initial.png`, `16-incidents-list-state.png`

---

**OBS-14 (Investigation creation — domain coherence)**
- **Severity:** P2
- **Context:** investigation
- **Route:** `/dashboard/incidents/new`
- **Observation:** The "Description" field placeholder says "Describe the incident in detail..." with no guidance on what information helps the AI. The title placeholder says "e.g., Database Connection Pool Exhaustion" — a technical infrastructure example that may not resonate with product engineers or non-SRE teams. There is no character count indicator despite a 4000-character limit in the `new-analysis-form.tsx` validation. The form has no template suggestions, no integration-context hints ("we detected a spike in your Datadog monitors — want to attach it?"), and no pre-fill options from recent alerts.
- **Why it matters:** Investigation quality depends on the quality of the incident description. A sparse description ("service down") produces a less useful AI analysis than a detailed one. The form gives no guidance on what makes a good incident description, leaving users to guess.
- **Recommendation:** Add a character count indicator to the description textarea. Add 2–3 brief helper bullet points below the field: "Include: affected service, symptom onset time, error rate/logs." Consider showing a "Suggested" section when integrations are connected: "We saw 12 Datadog alerts in the last hour — attach them?" This is the highest-value UX opportunity on the creation form.
- **Screenshot:** `03-new-incident-form-empty.png`

---

**OBS-15 (Empty state — shared EmptyState component link)**
- **Severity:** P2
- **Context:** investigation / shared
- **Route:** `/dashboard/incidents` (empty state)
- **Observation:** The shared `EmptyState` component (used for the incidents list empty state) has its CTA link hardcoded to `/dashboard/analyses/new`. This is the deprecated route that now redirects to `/dashboard/incidents/new`. The redirect works, but the URL shown in the browser address bar flickers through `/analyses/new` before settling on `/incidents/new`, creating a perceived inconsistency.
- **Why it matters:** This is a direct symptom of the terminology inconsistency (OBS-02). The empty state CTA sends users through an unnecessary redirect. If the `/analyses` routes are ever removed without updating this component, the CTA becomes a dead link.
- **Recommendation:** Update the `EmptyState` component's CTA `href` from `/dashboard/analyses/new` to `/dashboard/incidents/new`. This is a one-line fix that eliminates the redirect and aligns with the canonical route.
- **Screenshot:** (code-verified; empty state was not shown in screenshot due to list always loading with skeletons)

---

## Investigation Creation Flow — Step-by-Step

**Step 1 — Navigate to `/dashboard/incidents/new`**
The form rendered after a 5-second compile delay. The breadcrumb showed "Dashboard › New Analysis" (stale label — OBS-02). The form body was fully scrollable below the fold. No scroll indicator or progress indicator.
Screenshot: `03-new-incident-form-empty.png`

**Step 2 — Form fields visible**
- Incident Title (required, text input, placeholder: "e.g., Database Connection Pool Exhaustion")
- Description (optional, large textarea, placeholder: "Describe the incident in detail...")
- Severity (5 pill buttons: Critical, High, Medium, Low, Info — color-coded with dot indicators)
- Investigation mode (STAFF-only dropdown — OBS-05)
- Submit button below the fold (not visible without scrolling at 1280×800)

**Step 3 — Submit button discoverability**
The submit button ("Start Investigation" or equivalent) was not visible in the initial viewport at 1280×800 — it requires scrolling. There is no sticky footer or fixed CTA. For the description field set to 8 rows of textarea height, the severity selector and submit button are pushed below the fold.

**Step 4 — Post-submit**
The browser log shows the post-submit navigation landed on the incidents list rather than the incident detail page, consistent with OBS-13. No loading state was shown during the API call — the button disables (`isSubmitting`) but there is no spinner or progress indication on the button itself.

**Step 5 — Investigation detail (existing incident)**
Captured via an existing incident link. The detail view renders within the sidebar layout with a breadcrumb "Dashboard › New Analysis" (same stale breadcrumb as the creation form — label appears to be set at the route level and not updated for the detail view). The detail page layout has a fixed-viewport design at sm+ breakpoints.

Screenshots: `15a-invest-form-initial.png`, `16a-incident-detail-top.png`, `16b-incident-detail-mid.png`, `16c-incident-detail-bottom.png`
