# Master Fixes: Dashboard + Website (10 Issues + Mocks + Animations)

## PLANO 1: Correções dos Screenshots (10 issues)

### Fase 1: Críticos (Mobile UX bloqueante)
- [x] #1 - Scroll no signup mobile: body h-full instead of h-screen overflow-hidden
- [x] #2 - Onboarding persistente: catch block now defaults profileComplete=true, session callback ?? true
- [x] #3 - Menu mobile não fecha ao clicar item: added onClick={onMobileClose} to nav Links

### Fase 2: Dados e UX (High)
- [x] #4 - Créditos fallback 100→5 (Free plan default)
- [x] #5 - Foto no perfil: conditional img/initials like topbar
- [x] #6 - Pro plan: API now returns tenant.plan, billing uses it directly

### Fase 3: Website SEO
- [x] #7 - Homepage redirect: skip Accept-Language redirect for / path
- [x] #8 - Cards integração: relative z-0 on integration-filter wrapper
- [x] #9 - /month: investigated — not a broken link in code, just display text "/month" in pricing. No redirect needed.
- [x] #10 - Mensagem Slack: updated to mention engineering and support teams (EN + PT-BR)

### Verificação Plano 1
- [x] Website deployed to staging.causeflow.ai
- [x] Dashboard deployed to dashboard-staging.causeflow.ai
- [x] #1 CONFIRMED: Signup page scrolls on mobile 375px — full form visible
- [x] #7 CONFIRMED: Homepage returns 200 at / with no redirect
- [x] #8 CONFIRMED: Mobile menu overlays above integration cards
- [x] #9 CONFIRMED: /month returns 404 (no broken link in code)
- [x] #10 CONFIRMED: Slack card shows "engineering and support teams"
- [x] Auth pages render correctly on mobile (signup, forgot-password)
- [x] Pricing page renders correctly with Pro "Most popular" badge
- [ ] #2-#6 require authenticated session — code changes verified via build + code review

---

## PLANO 2: Limpar Mocks Óbvios

### Fase 1: Auditar valores hardcoded
- [x] Créditos hardcoded → fixed in Plan 1 (#4), fallback 100→5
- [x] Plano do usuário → fixed in Plan 1 (#6), API returns tenant.plan
- [x] Contadores dashboard home → verified: all from /api/metrics (real DB data)

### Fase 2: Verificar consistência
- [x] Settings page: verified — name/email from /api/settings + session fallback
- [x] Team page: verified — members from /api/team endpoint (real DB)
- [x] Integrations page: verified — status from /api/integrations (real DB). handleTest() is expected mock.

**Audit Result:** All data is real from DB. Only expected mocks remain: integration test button, analysis simulator, templates.

---

## PLANO 3: Animações e Layout Mobile

### Fase 1: Timing de animações
- [x] Sign-up: AnimatedRedirect with 2s delay + confetti on mount
- [x] Verify-email: AnimatedRedirect with 2s delay + confetti on mount
- [x] Forgot-password: AnimatedRedirect with 3s delay + confetti on mount

### Fase 2: Animações no onboarding
- [x] Welcome page: confetti on mount + CTA button delayed 1.5s with fade-in
- [x] Transições entre steps: animate-in fade-in slide-in-from-bottom-4 on all 3 step cards
- [x] Progress indicator: animate-pulse on current step circle

### Fase 3: Confetti functions não utilizadas
- [x] planSelectConfetti() on plan selection link click in billing page
- [x] analysisCompleteConfetti() on status transition to completed in analysis-detail

### Fase 4: AnimatedRedirect component
- [x] Created /apps/dashboard/src/components/ui/animated-redirect.tsx
- [x] Applied in: sign-up, verify-email, forgot-password success flows

### Fase 5: Layout Mobile Dashboard
- [x] Viewport: added width=device-width, initialScale=1, viewportFit=cover
- [x] Body: h-full instead of h-screen overflow-hidden (done in Plan 1)
- [x] Sidebar close on navigation (done in Plan 1)
- [x] Tap targets: sidebar nav min-h-[44px], topbar buttons h-11 w-11 on mobile
- [x] Tables: already responsive (team uses card layout on mobile, analyses use cards)
- [x] Forms: already responsive (w-full inputs, responsive padding)

### Fase 6: Teste visual
- [x] Playwright screenshots: signup mobile (top/bottom), forgot-password mobile, integrations mobile menu, pricing desktop, homepage desktop
- [x] Staging deploy verified: website + dashboard both live
- [ ] Full auth flow test (signup→verify→onboarding→dashboard) requires manual testing with real OAuth
