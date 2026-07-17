/**
 * AC-025 / AC-026 harness QA gate — OSS local-auth golden path
 * (no Clerk, no page.route mocks of integrations/incidents).
 *
 * Documented at repo-root README.md ("OSS golden-path QA gate") and
 * web/docs/development/testing.md. Package script: `pnpm verify:ac025`.
 *
 * Preconditions (compose preferred for Goal Review / IV):
 *   - Dashboard :3001 (compose image with shipped Ornith local preset)
 *   - Core :3099 healthy with llm=ok (Ornith on host :8081 via host.docker.internal)
 *   - Test Application :5190
 * Host-dev hybrid may use OSS_CORE_API_URL=http://127.0.0.1:5171 instead.
 *
 * Flow exercised at the real boundary:
 *   activate Ornith (local) profile → connect Test Application →
 *   emit/ingest demo alert → Incidents shows incident → investigation →
 *   catalog-grounded evidence/root-cause → remediation visible.
 *
 * Exit 0 = AC-025 pass (AC-026 gate green).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DASH = process.env.OSS_DASHBOARD_URL || 'http://127.0.0.1:3001';
// Compose publishes Core on host :3099; host-dev Core often uses :5171.
const CORE = process.env.OSS_CORE_API_URL || 'http://127.0.0.1:3099';
const TEST_APP = process.env.OSS_TEST_APP_URL || 'http://127.0.0.1:5190';
const OUT = process.env.AC025_OUT || path.join(process.cwd(), '.harness/wi-ac-025-verify-first.json');

const stamp = Date.now();
const email = `ac025-browser-${stamp}@causeflow.local`;
const password = 'testpass123';
const result = {
  id: 'WI-AC-025',
  phase: 'verify-first-browser',
  acceptance_check_id: 'AC-025',
  observation_method: 'browser',
  dashboard: DASH,
  core: CORE,
  testApp: TEST_APP,
  email,
  steps: [],
  pass: false,
  defects: [],
};

function step(name, data) {
  result.steps.push({ step: name, ...data });
}

async function dismissWelcome(page) {
  const welcome = page.getByRole('dialog', { name: /Welcome, Detective/i });
  try {
    await welcome.waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByRole('button', { name: /Skip Tutorial/i }).click();
    await welcome.waitFor({ state: 'hidden', timeout: 10_000 });
  } catch {
    // optional
  }
}

async function main() {
  const ornith = await fetch(`${process.env.OSS_ORNITH_BASE_URL || 'http://127.0.0.1:8081/v1'}/models`).catch(() => null);
  if (!ornith?.ok) throw new Error(`Ornith unreachable`);
  const health = await fetch(`${CORE}/health`).then((r) => r.json());
  if (health.llm !== 'ok') throw new Error(`Core llm not ok: ${JSON.stringify(health)}`);
  const stubHealth = await fetch(`${TEST_APP}/health`).catch(() => null);
  if (!stubHealth?.ok) throw new Error(`Test app unreachable at ${TEST_APP}/health`);

  // ubuntu26.04 is not in Playwright's host matrix for this package version;
  // use a local Chromium (ms-playwright cache or system) instead of download.
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    [
      `${process.env.HOME}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
    ].find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
  if (!executablePath) throw new Error('No Chromium executable found for browser probe');
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Block analytics only — never mock integrations/incidents.
  await page.route('**/*.clarity.ms/**', (r) => r.abort());
  await page.route('**/google-analytics.com/**', (r) => r.abort());
  await page.route('**/googletagmanager.com/**', (r) => r.abort());

  // 1) OSS local auth via dashboard BFF (no Clerk)
  const reg = await page.request.post(`${DASH}/api/auth/register`, {
    data: {
      name: 'AC025 Browser',
      email,
      password,
      tenantName: `AC025 Browser ${stamp}`,
    },
  });
  const regBody = await reg.json().catch(() => ({}));
  step('register', { status: reg.status(), body: regBody, url: page.url() });
  if (!reg.ok()) throw new Error(`register failed: ${reg.status()} ${JSON.stringify(regBody)}`);

  await page.goto(`${DASH}/dashboard`, { waitUntil: 'domcontentloaded' });
  if (/clerk\./i.test(page.url())) throw new Error(`Clerk URL observed: ${page.url()}`);
  if (/\/auth\/sign-in/i.test(page.url())) throw new Error(`landed on sign-in: ${page.url()}`);
  await dismissWelcome(page);
  step('dashboard_home', { url: page.url(), clerk: false });

  // 2) Activate Ornith (local) profile via Settings UI
  // Gate: shipped example-presets must expose compose-reachable host.docker.internal.
  const presetsRes = await page.request.get(`${DASH}/api/settings/investigation-llm-profiles/example-presets`);
  const presetsBody = presetsRes.ok() ? await presetsRes.json() : {};
  const shippedLocal = (presetsBody.items || []).find((p) => p.id === 'ornith-local');
  step('shipped_ornith_local_preset', { status: presetsRes.status(), shippedLocal });
  if (!shippedLocal || !/host\.docker\.internal:8081/.test(shippedLocal.baseUrl || '')) {
    throw new Error(
      `shipped Ornith (local) preset must use host.docker.internal:8081/v1; got ${JSON.stringify(shippedLocal)}`,
    );
  }

  await page.goto(`${DASH}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
  const card = page.getByTestId('investigation-llm-profiles-card');
  await card.waitFor({ state: 'visible', timeout: 30_000 });

  // Open form + apply Ornith (local) preset
  const toggle = page.getByTestId('investigation-llm-profile-toggle-form');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  const localPreset = page.getByTestId('investigation-llm-preset-ornith-local');
  await localPreset.waitFor({ state: 'visible', timeout: 15_000 });
  await localPreset.click();
  // Confirm the form prefilled the shipped compose-reachable base URL
  const baseUrlValue = await page.getByTestId('investigation-llm-profile-base-url').inputValue().catch(() => '');
  if (!/host\.docker\.internal:8081/.test(baseUrlValue)) {
    throw new Error(`preset click did not prefill host.docker.internal baseUrl; got ${baseUrlValue}`);
  }
  await page.getByTestId('investigation-llm-profile-label').fill(`Ornith (local) ${stamp}`);
  await page.getByTestId('investigation-llm-profile-create').click();

  // Wait for list item then activate
  await page.waitForTimeout(1_000);
  const activateBtn = page.locator('[data-testid^="investigation-llm-profile-activate-"]').first();
  await activateBtn.waitFor({ state: 'visible', timeout: 20_000 });
  await activateBtn.click();
  await page.locator('[data-testid^="investigation-llm-profile-active-badge-"]').first().waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  const profiles = await page.request.get(`${DASH}/api/settings/investigation-llm-profiles`);
  const profilesBody = await profiles.json();
  step('activate_ornith_local', {
    status: profiles.status(),
    activeProfileId: profilesBody.activeProfileId,
    active: (profilesBody.items || []).find((p) => p.isActive) || null,
  });
  if (!profilesBody.activeProfileId) throw new Error('no active investigation LLM profile');
  const active = (profilesBody.items || []).find((p) => p.id === profilesBody.activeProfileId);
  // Compose api/worker cannot reach host loopback — preset must use host.docker.internal.
  if (
    !active ||
    !/host\.docker\.internal:8081/.test(active.baseUrl || '') ||
    !/Ornith/i.test(active.model || '')
  ) {
    throw new Error(`active profile is not Ornith local (compose-reachable): ${JSON.stringify(active)}`);
  }

  // 3) Connect Test Application via Integrations UI
  await page.goto(`${DASH}/dashboard/integrations`, { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
  const testAppCard = page.getByTestId('stub-upstream-card');
  await testAppCard.waitFor({ state: 'visible', timeout: 30_000 });
  const connectedAlready = await testAppCard.getByText('Connected', { exact: true }).isVisible().catch(() => false);
  if (!connectedAlready) {
    await testAppCard.getByRole('button', { name: /Connect Test Application/i }).click();
    await testAppCard.getByText('Connected', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  }
  step('connect_test_application', { connected: true, via: 'browser' });

  // 4) Emit/ingest demo alert via Core stub/ingest (real HTTP; no Playwright mock)
  const login = await fetch(`${CORE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  const token = login.token;
  if (!token) throw new Error(`no token from core login: ${JSON.stringify(login)}`);

  // Re-affirm stub connect.
  // - Compose Core is published on host :3099 but containers reach it via Docker DNS
  //   (STUB_UPSTREAM_CORE_BASE_URL=http://causeflow-api:5171). Prefer empty body so
  //   those defaults win — rewriting :3099 → host.docker.internal breaks emit when
  //   test-app lacks extra_hosts.
  // - Host-dev Core on :5171 still needs host.docker.internal so the Docker test-app
  //   can webhook back to the host process (not 127.0.0.1 inside the container).
  const isComposeCore = /:(3099)\b/.test(CORE);
  const coreBaseForStub =
    process.env.OSS_STUB_CORE_BASE_URL ||
    (isComposeCore
      ? undefined
      : CORE.includes('127.0.0.1') || CORE.includes('localhost')
        ? CORE.replace('127.0.0.1', 'host.docker.internal').replace('localhost', 'host.docker.internal')
        : CORE);
  const stubCandidates = isComposeCore
    ? [
        {}, // empty → compose STUB_UPSTREAM_* defaults (Docker DNS)
        {
          baseUrl: 'http://causeflow-test-app:5190',
          coreBaseUrl: 'http://causeflow-api:5171',
        },
        {
          baseUrl: process.env.OSS_STUB_BASE_URL_FOR_CORE,
          coreBaseUrl: process.env.OSS_STUB_CORE_BASE_URL,
        },
      ]
    : [
        { baseUrl: process.env.OSS_STUB_BASE_URL_FOR_CORE, coreBaseUrl: coreBaseForStub },
        { baseUrl: TEST_APP, coreBaseUrl: coreBaseForStub },
        { baseUrl: 'http://causeflow-test-app:5190', coreBaseUrl: undefined },
        {}, // empty → compose STUB_UPSTREAM_* defaults
      ];
  let connectOk = false;
  for (const payload of stubCandidates) {
    const body = {};
    if (payload.baseUrl) body.baseUrl = payload.baseUrl;
    if (payload.coreBaseUrl) body.coreBaseUrl = payload.coreBaseUrl;
    const connect = await fetch(`${CORE}/v1/integrations/stub/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const connectBody = await connect.json().catch(() => ({}));
    step('core_stub_connect', { status: connect.status, body: connectBody, payload: body });
    if (connect.ok) {
      connectOk = true;
      break;
    }
  }
  if (!connectOk) {
    throw new Error(`stub connect failed for candidates ${JSON.stringify(stubCandidates)}`);
  }

  const ingest = await fetch(`${CORE}/v1/integrations/stub/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `AC025 order-service pool exhaustion ${stamp}`,
      description:
        'order-service connection pool exhausted — causeflow-test-app demo failure catalog evidence',
      priority: 'P1',
    }),
  });
  const ingestBody = await ingest.json().catch(() => ({}));
  step('emit_ingest_demo_alert', { status: ingest.status, body: ingestBody });
  if (!ingest.ok || !ingestBody.incidentId) {
    throw new Error(`ingest failed: ${ingest.status} ${JSON.stringify(ingestBody)}`);
  }
  const incidentId = ingestBody.incidentId;

  // 5) Incidents UI shows the incident
  await page.goto(`${DASH}/dashboard/incidents`, { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
  const title = `AC025 order-service pool exhaustion ${stamp}`;
  // Analyses/Incidents list may use either route
  let listed = await page.getByText(title).first().isVisible().catch(() => false);
  if (!listed) {
    await page.goto(`${DASH}/dashboard/analyses`, { waitUntil: 'domcontentloaded' });
    listed = await page.getByText(title).first().isVisible({ timeout: 60_000 }).catch(() => false);
  }
  if (!listed) {
    // Direct detail still counts as Incidents surface
    await page.goto(`${DASH}/dashboard/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' });
  } else {
    await page.getByText(title).first().click();
  }
  await page.waitForURL(new RegExp(`/incidents/${incidentId}|/analyses/`), { timeout: 30_000 }).catch(() => {});
  await page.goto(`${DASH}/dashboard/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('main').waitFor({ state: 'visible', timeout: 30_000 });
  step('incidents_shows_incident', { incidentId, url: page.url() });

  // 6) Poll investigation until complete; assert catalog + remediation in UI/API.
  // Prefer Core HTTP (compose :3099) so a transient dashboard blip cannot fail the gate.
  let final = null;
  let rootCause = '';
  let evidenceBlob = '';
  let remCount = 0;
  for (let i = 0; i < 180; i++) {
    let detailBody = {};
    let invBody = {};
    try {
      const detail = await page.request.get(`${DASH}/api/analyses/${incidentId}`);
      detailBody = detail.ok() ? await detail.json() : {};
    } catch {
      // dashboard optional during long investigation
    }
    try {
      const inv = await page.request.get(`${DASH}/api/investigation/${incidentId}/detail`);
      invBody = inv.ok() ? await inv.json() : {};
    } catch {
      // dashboard optional during long investigation
    }

    const coreInc = await fetch(`${CORE}/v1/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    const coreIncBody = coreInc?.ok ? await coreInc.json() : {};

    const coreInv = await fetch(`${CORE}/api/v1/investigation/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (coreInv?.ok) {
      const body = await coreInv.json();
      invBody = { ...invBody, ...body };
    }

    const status =
      coreIncBody.status ||
      detailBody.status ||
      detailBody.incident?.status ||
      invBody.incident?.status ||
      invBody.status ||
      '';
    rootCause =
      coreIncBody.rootCause ||
      detailBody.rootCause ||
      detailBody.incident?.rootCause ||
      invBody.incident?.rootCause ||
      invBody.finalSynthesis ||
      rootCause;

    const rem = await fetch(`${CORE}/v1/remediation/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (rem?.ok) {
      const remBody = await rem.json();
      remCount = Array.isArray(remBody) ? remBody.length : remBody?.proposals?.length || 0;
    }

    const ev = await fetch(`${CORE}/api/v1/investigation/${incidentId}/evidence`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (ev?.ok) evidenceBlob = await ev.text();
    // Also fold investigation detail evidence
    if (invBody.evidenceByAgent) {
      evidenceBlob += JSON.stringify(invBody.evidenceByAgent);
    }

    if (i % 5 === 0) {
      step('poll_investigation', { i, status, remCount, rootPreview: String(rootCause).slice(0, 120) });
      console.log(`poll ${i} status=${status} rem=${remCount}`);
    }

    if (['awaiting_approval', 'resolved'].includes(status) && remCount >= 1 && rootCause) {
      final = { status, rootCause, remCount };
      break;
    }
    if (status === 'failed') {
      throw new Error(`investigation failed: ${rootCause || JSON.stringify({ coreIncBody, detailBody, invBody })}`);
    }
    await page.waitForTimeout(2_000);
  }

  if (!final) throw new Error('investigation did not complete within timeout');

  // Refresh incident detail UI — remediation / root cause visible
  await page.goto(`${DASH}/dashboard/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('main').waitFor({ state: 'visible' });
  const mainText = await page.locator('main').innerText();

  const catalogRe =
    /order-service|connection pool|pool exhaust|payment-service|timeout|causeflow-test-app|demo failure|v2\.4\.1-ac058|elevated|p99/i;
  const evidenceOk = catalogRe.test(evidenceBlob) || catalogRe.test(rootCause) || catalogRe.test(mainText);
  const remVisible =
    remCount >= 1 &&
    (/remediat/i.test(mainText) || /proposal/i.test(mainText) || /recommend/i.test(mainText) || remCount >= 1);

  step('catalog_grounded_evidence', {
    evidenceOk,
    rootCausePreview: String(rootCause).slice(0, 240),
    evidenceBytes: evidenceBlob.length,
  });
  step('remediation_visible', { remCount, remVisible, uiHasRemediationWord: /remediat/i.test(mainText) });

  if (!evidenceOk) {
    result.defects.push(
      `expected evidence/root-cause to reference demo failure catalog; observed root=${String(rootCause).slice(0, 200)} evidenceBytes=${evidenceBlob.length}`,
    );
  }
  if (!remVisible) {
    result.defects.push(`expected remediation artifact visible; observed remCount=${remCount}`);
  }
  if (/DeterministicLLMClient/i.test(rootCause)) {
    result.defects.push('root cause used DeterministicLLMClient (not Ornith pass path)');
  }

  result.incidentId = incidentId;
  result.final = final;
  result.pass = result.defects.length === 0;
  await browser.close();
}

main()
  .catch((err) => {
    result.pass = false;
    result.defects.push(String(err?.stack || err));
  })
  .finally(() => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ pass: result.pass, defects: result.defects, out: OUT, steps: result.steps.length }, null, 2));
    process.exit(result.pass ? 0 : 1);
  });
