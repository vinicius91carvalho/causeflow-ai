import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const PORT = process.env.PORT || '5170';
const BASE = `http://127.0.0.1:${PORT}`;
const TENANT_ID = 'b90e1e00-2f76-4862-99d4-85621c136f71';
const INCIDENT_ID = 'f5276dde-9b84-48b2-b888-bb080498924e';
const EVIDENCE = process.env.EVIDENCE || '/home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/widget-and-portal/WI-AC-035-integrated-qa.log';

const passes = [];
const fails = [];
const network = [];

function pass(msg) { passes.push(msg); }
function fail(msg) { fails.push(msg); }

async function main() {
  const lines = [`=== AC-035 Integrated Verification ===`, `BASE=${BASE}`];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((cfg) => {
    localStorage.setItem('causeflow_config', JSON.stringify(cfg));
  }, {
    baseUrl: BASE,
    jwtSecret: 'oss-dev-jwt-secret-change-me',
    tenantId: TENANT_ID,
  });

  const page = await context.newPage();
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/hypotheses') || url.includes('/notifications/stream') || url.includes('/dashboard')) {
      network.push(`${res.request().method()} ${res.status()} ${url}`);
    }
  });

  const dash = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (dash?.status() === 200) pass('GET /dashboard: status=200');
  else fail(`GET /dashboard: status=${dash?.status()}`);

  await page.waitForTimeout(2000);

  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('QA Tenant AC035')) pass("sidebar tenant name: QA Tenant AC035");
  else fail(`sidebar tenant name missing; got snippet: ${bodyText.slice(0, 200)}`);

  if (bodyText.includes('New investigation')) pass('New investigation button visible');
  else fail('New investigation button not visible');

  if (bodyText.includes('AC035 checkout latency spike')) pass('recent incident in sidebar: AC035 checkout latency spike');
  else fail('recent incident not found in sidebar');

  const incidentBtn = page.getByText('AC035 checkout latency spike', { exact: false }).first();
  await incidentBtn.click();
  await page.waitForTimeout(2500);

  const detailText = await page.locator('body').innerText();
  if (/evidence/i.test(detailText)) pass('evidence panel visible');
  else fail('evidence panel not visible');
  if (/hypothes/i.test(detailText)) pass('hypotheses panel chrome visible');
  else fail('hypotheses panel chrome not visible');
  if (/chat/i.test(detailText)) pass('chat panel visible');
  else fail('chat panel not visible');
  if (/remediation/i.test(detailText)) pass('remediation panel chrome visible');
  else fail('remediation panel chrome not visible');

  const hypResp = network.find((n) => n.includes('/hypotheses'));
  if (hypResp) {
    const status = Number(hypResp.split(' ')[1]);
    if (status === 200) pass(`GET hypotheses API: status=200 url=${hypResp.split(' ').slice(2).join(' ')}`);
    else fail(`GET hypotheses API: status=${status} url=${hypResp.split(' ').slice(2).join(' ')}`);
  } else {
    fail(`GET hypotheses API: no request observed for incident ${INCIDENT_ID}`);
  }

  const sseResp = network.find((n) => n.includes('/notifications/stream'));
  if (sseResp) {
    const status = Number(sseResp.split(' ')[1]);
    if (status === 200) pass(`SSE /v1/notifications/stream: status=200`);
    else fail(`SSE /v1/notifications/stream: status=${status}`);
  } else {
    fail('SSE /v1/notifications/stream: no connection observed');
  }

  await browser.close();

  lines.push(`PASS (${passes.length}):`);
  for (const p of passes) lines.push(`  + ${p}`);
  lines.push(`FAIL (${fails.length}):`);
  for (const f of fails) lines.push(`  - ${f}`);
  lines.push('NETWORK:');
  for (const n of network) lines.push(`  ${n}`);
  lines.push(`OVERALL: ${fails.length === 0 ? 'PASS' : 'FAIL'}`);

  const output = lines.join('\n');
  writeFileSync(EVIDENCE, output);
  console.log(output);
  process.exit(fails.length === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
