import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// ─── Config ──────────────────────────────────────────────

const DASHBOARD_URL = 'https://dashboard-staging.causeflow.ai';
const STAGING_PASSWORD = 'causeflow-staging-2026';
const PASSWORD = 'Demo2026!secure';

// Hard limit: 130s of recording
const TIME_BUDGET = 130;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Temporary Email (mail.tm) ───────────────────────────

const MAIL_API = 'https://api.mail.tm';
const MAIL_PASSWORD = 'TempMailPass99!';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${opts.method || 'GET'} ${url} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function createTempEmail() {
  // 1. Get available domain
  const domains = await fetchJson(`${MAIL_API}/domains`);
  const domain = domains['hydra:member']?.[0]?.domain;
  if (!domain) throw new Error('No mail.tm domains available');

  // 2. Create account
  const address = `causeflow-demo-${Date.now()}@${domain}`;
  await fetchJson(`${MAIL_API}/accounts`, {
    method: 'POST',
    body: JSON.stringify({ address, password: MAIL_PASSWORD }),
  });

  // 3. Get auth token
  const auth = await fetchJson(`${MAIL_API}/token`, {
    method: 'POST',
    body: JSON.stringify({ address, password: MAIL_PASSWORD }),
  });

  console.log(`  Temp email: ${address}`);
  return { address, token: auth.token };
}

/**
 * Poll the mail.tm inbox for a 6-digit OTP code.
 * Cognito sends: "Your verification code is: 123456"
 */
async function pollForOTP(token, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const msgs = await fetchJson(`${MAIL_API}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const messages = msgs['hydra:member'] || [];
    if (messages.length > 0) {
      // Read the first message
      const msgId = messages[0].id;
      const full = await fetchJson(`${MAIL_API}/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Build searchable text from all available fields
      // Note: full.html can be an array of strings
      const textBody = typeof full.text === 'string' ? full.text : '';
      const htmlBody = Array.isArray(full.html)
        ? full.html.join(' ')
        : typeof full.html === 'string'
          ? full.html
          : '';
      const intro = typeof full.intro === 'string' ? full.intro : '';
      const subject = typeof full.subject === 'string' ? full.subject : '';
      const searchText = [subject, intro, textBody, htmlBody].join(' ');

      // Extract 6-digit OTP code
      const match = searchText.match(/\b(\d{6})\b/);
      if (match) {
        console.log(`  OTP found: ${match[1]}`);
        return match[1];
      }
      console.log(`  Email received but no 6-digit code found. Subject: ${full.subject}`);
    }

    // Wait 3s before next poll
    await sleep(3000);
  }
  throw new Error('OTP not received within timeout');
}

// ─── Fake Cursor ─────────────────────────────────────────

const CURSOR_CSS = `
  * { cursor: none !important; }
  #demo-cursor { position:fixed; top:0; left:0; width:20px; height:20px;
    pointer-events:none; z-index:999999;
    transform:translate(var(--cx,-100px),var(--cy,-100px)); }
  #demo-cursor svg { width:20px; height:20px; filter:drop-shadow(1px 2px 2px rgba(0,0,0,.35)); }
`;

async function injectCursor(page) {
  await page.evaluate((css) => {
    document.getElementById('dc-s')?.remove();
    document.getElementById('demo-cursor')?.remove();

    const s = document.createElement('style');
    s.id = 'dc-s';
    s.textContent = css;
    document.head.appendChild(s);

    const d = document.createElement('div');
    d.id = 'demo-cursor';

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute(
      'd',
      'M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86c-.31-.31-.85-.1-.85.35Z',
    );
    p.setAttribute('fill', 'white');
    p.setAttribute('stroke', 'black');
    p.setAttribute('stroke-width', '1.2');
    svg.appendChild(p);
    d.appendChild(svg);
    document.body.appendChild(d);

    document.addEventListener('mousemove', (e) => {
      const c = document.getElementById('demo-cursor');
      if (c) {
        c.style.setProperty('--cx', `${e.clientX}px`);
        c.style.setProperty('--cy', `${e.clientY}px`);
      }
    });
  }, CURSOR_CSS);
}

// ─── Helpers ─────────────────────────────────────────────

async function moveTo(page, x, y) {
  await page.mouse.move(x, y, { steps: 4 });
  await sleep(30);
}

async function quickClick(page, locator, wait = 100) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(60);
  await locator.click();
  await sleep(wait);
}

async function quickFill(page, locator, text, delay = 25) {
  const box = await locator.boundingBox();
  if (box) await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(30);
  await locator.click();
  await locator.pressSequentially(text, { delay });
  await sleep(30);
}

async function ensureCursor(page) {
  const ok = await page.evaluate(() => !!document.getElementById('demo-cursor'));
  if (!ok) await injectCursor(page);
}

async function smoothScroll(page, y) {
  await page.evaluate((yy) => {
    const c = document.getElementById('main-content');
    (c || window).scrollTo({ top: yy, behavior: 'smooth' });
  }, y);
  await sleep(400);
}

async function getContainerScrollTop(page) {
  return page.evaluate(() => {
    const c = document.getElementById('main-content');
    return c ? c.scrollTop : window.scrollY;
  });
}

async function navigateTo(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await ensureCursor(page);
}

/**
 * Scroll to a section heading on the analysis detail page.
 * Uses the absolute document position (scrollY + viewport-relative y).
 */
async function scrollToSection(page, label, fallback) {
  try {
    const el = page
      .locator('section, h3')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    const b = await el.boundingBox();
    if (!b) throw new Error('no box');
    const scrollTop = await getContainerScrollTop(page);
    const containerTop = await page.evaluate(() => {
      const c = document.getElementById('main-content');
      return c ? c.getBoundingClientRect().top : 0;
    });
    await smoothScroll(page, Math.max(0, scrollTop + b.y - containerTop - 20));
  } catch {
    const scrollTop = await getContainerScrollTop(page);
    await smoothScroll(page, scrollTop + fallback);
  }
}

// ─── Main ────────────────────────────────────────────────

(async () => {
  console.log('CauseFlow AI Demo Recording (staging)\n');

  // Step 0: Create temporary email BEFORE starting the recording
  console.log('[0] Creating temporary email...');
  let EMAIL, mailToken;
  try {
    const temp = await createTempEmail();
    EMAIL = temp.address;
    mailToken = temp.token;
  } catch (err) {
    console.error(`Failed to create temp email: ${err.message}`);
    console.error('Falling back to timestamp-based email (OTP retrieval will not work)');
    EMAIL = `demo-${Date.now()}@acmecorp.com`;
    mailToken = null;
  }
  console.log(`  Using: ${EMAIL}\n`);

  const browser = await chromium.launch({ headless: true });

  // Staging auth cookie: base64 of "staging-authorized:<password>"
  const stagingCookie = Buffer.from(`staging-authorized:${STAGING_PASSWORD}`).toString('base64');

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: './demo-video/', size: { width: 1440, height: 900 } },
    colorScheme: 'dark',
  });

  // Pre-inject staging auth cookie so the password gate is bypassed
  await context.addCookies([
    {
      name: 'staging-authorized',
      value: stagingCookie,
      domain: 'dashboard-staging.causeflow.ai',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Hide native cursor on every navigation
  await page.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = '* { cursor: none !important; }';
    (document.head || document.documentElement).appendChild(s);
  });

  try {
    const t0 = Date.now();
    const vt = () => ((Date.now() - t0) / 1000).toFixed(1);
    const elapsed = () => (Date.now() - t0) / 1000;
    const remaining = () => TIME_BUDGET - elapsed();

    // ─── SCENE 1: Sign Up ──────────────────────────────
    console.log(`[1] Sign-up (${vt()}s)`);
    await page.addInitScript(() => {
      localStorage.setItem(
        'causeflow-theme',
        JSON.stringify({ themeId: 'original', colorMode: 'dark' }),
      );
    });
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await injectCursor(page);
    await sleep(500);

    // Fill sign-up form
    await quickFill(
      page,
      page.getByRole('textbox', { name: /full name/i }).or(page.getByPlaceholder(/jane/i)),
      'Sarah Chen',
    );
    await quickFill(
      page,
      page.getByRole('textbox', { name: /email/i }).or(page.getByPlaceholder(/company/i)),
      EMAIL,
    );
    await quickFill(page, page.locator('input[type="password"]').first(), PASSWORD);
    await quickFill(page, page.locator('input[type="password"]').nth(1), PASSWORD);
    await quickClick(
      page,
      page.locator('input[type="checkbox"]').first().or(page.getByRole('checkbox').first()),
      80,
    );
    await sleep(200);

    console.log('  Submit...');
    await quickClick(page, page.getByRole('button', { name: /create/i }).first(), 100);
    await page.waitForSelector('text=Account created', { timeout: 20000 }).catch(() => {});
    await sleep(800);

    // Start OTP polling in background IMMEDIATELY after sign-up
    // (Cognito sends the email at sign-up time, so start polling now)
    const otpPromise = mailToken
      ? pollForOTP(mailToken, 45000).catch((err) => {
          console.warn(`  OTP poll failed: ${err.message}`);
          return null;
        })
      : Promise.resolve(null);

    await sleep(700); // Brief pause to show success message

    // ─── SCENE 2: Verify Email ─────────────────────────
    console.log(`[2] Verify email (${vt()}s)`);
    await navigateTo(page, `${DASHBOARD_URL}/auth/verify-email?email=${encodeURIComponent(EMAIL)}`);
    await sleep(500);

    // Wait for OTP (polling started earlier, should overlap with navigation)
    console.log('  Waiting for verification code...');
    const otpCode = await otpPromise;

    if (!otpCode) {
      console.error('  Could not retrieve OTP code. Aborting verification.');
      throw new Error('OTP retrieval failed — Cognito email not received');
    }

    console.log(`  Entering code: ${otpCode}`);
    await quickFill(
      page,
      page
        .locator('input[inputmode="numeric"]')
        .or(page.getByPlaceholder(/000000/i))
        .first(),
      otpCode,
      20,
    );
    await sleep(300);
    await quickClick(page, page.getByRole('button', { name: /verify/i }).first(), 100);
    await page.waitForSelector('text=verified', { timeout: 15000 }).catch(() => {});
    await sleep(1200); // Let user read "verified" message

    // ─── SCENE 3: Sign In ──────────────────────────────
    console.log(`[3] Sign-in (${vt()}s)`);
    await navigateTo(page, `${DASHBOARD_URL}/auth/sign-in`);
    await sleep(300);

    await quickFill(page, page.getByRole('textbox', { name: /email/i }), EMAIL);
    await quickFill(page, page.locator('input[type="password"]').first(), PASSWORD);
    await sleep(200);
    await quickClick(page, page.getByRole('button', { name: /sign in/i }), 100);

    // Wait for redirect — use pathname check to avoid matching callbackUrl in query string
    await page.waitForURL(
      (url) => {
        const p = new URL(url).pathname;
        return p.startsWith('/onboarding') || p.startsWith('/dashboard');
      },
      { timeout: 30000 },
    );
    await page.waitForLoadState('load');
    await ensureCursor(page);
    await sleep(300);

    const currentPath = new URL(page.url()).pathname;
    console.log(`  -> ${currentPath} (${vt()}s)`);

    // ─── SCENE 4: Onboarding (if shown) ────────────────
    if (currentPath.startsWith('/onboarding')) {
      console.log(`[4] Onboarding (${vt()}s)`);

      // Full Name
      await quickFill(
        page,
        page
          .locator('#full-name')
          .or(page.getByRole('textbox', { name: /full name/i }))
          .first(),
        'Sarah Chen',
      );

      // Company Name (required)
      await quickFill(
        page,
        page
          .locator('#company-name')
          .or(page.getByRole('textbox', { name: /company name/i }))
          .first(),
        'Acme Corp',
      );

      // Company Website
      await quickFill(
        page,
        page
          .locator('#company-website')
          .or(page.getByRole('textbox', { name: /website/i }))
          .first(),
        'https://acmecorp.com',
      );

      // Role
      await quickFill(
        page,
        page
          .locator('#role')
          .or(page.getByRole('textbox', { name: /role/i }))
          .first(),
        'VP of Engineering',
      );

      // Team Size — native <select id="team-size">
      const teamSelect = page.locator('#team-size');
      const tsBox = await teamSelect.boundingBox();
      if (tsBox) await moveTo(page, tsBox.x + tsBox.width / 2, tsBox.y + tsBox.height / 2);
      await sleep(80);
      await teamSelect.selectOption('21_50');
      await sleep(200);

      // Submit
      await quickClick(
        page,
        page.getByRole('button', { name: /continue|complete|get started/i }).first(),
        100,
      );
      await page.waitForURL((url) => new URL(url).pathname.startsWith('/dashboard'), {
        timeout: 30000,
      });
      await page.waitForLoadState('load');
      await ensureCursor(page);
      console.log(`  -> dashboard (${vt()}s)`);
    }

    // ─── SCENE 5: Dashboard Overview ───────────────────
    console.log(`[5] Dashboard (${vt()}s)`);
    await sleep(500);
    await moveTo(page, 720, 300);
    await sleep(1500); // Let viewer absorb the dashboard layout

    // ─── SCENE 6: Create Analysis ──────────────────────
    console.log(`[6] New analysis (${vt()}s)`);
    await navigateTo(page, `${DASHBOARD_URL}/dashboard/analyses/new`);
    await sleep(400);

    // Type incident description with visible, deliberate typing
    const promptField = page.locator('#analysis-prompt').or(page.locator('textarea').first());
    await promptField.waitFor({ state: 'visible', timeout: 10000 });

    const prompt =
      "Our checkout page is returning 500 errors after the latest deploy. Customers can't complete purchases.";
    const pBox = await promptField.boundingBox();
    if (pBox) await moveTo(page, pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
    await sleep(100);
    await promptField.click();
    await promptField.pressSequentially(prompt, { delay: 32 }); // Slower for dramatic effect
    await sleep(400);

    // Select severity: Critical
    await quickClick(page, page.locator('label').filter({ hasText: 'Critical' }).first(), 100);

    // Select integrations
    for (const name of ['Slack', 'GitHub']) {
      try {
        await quickClick(page, page.locator('label').filter({ hasText: name }).first(), 80);
      } catch {}
    }
    await sleep(300);

    console.log('  Submit...');
    await quickClick(
      page,
      page
        .getByRole('button', { name: /start analysis/i })
        .or(page.getByRole('button', { name: /create|submit|analyze/i }).first()),
      150,
    );

    // ─── SCENE 7: Processing Wait ──────────────────────
    console.log(`[7] Processing (${vt()}s)`);
    try {
      await page.waitForURL((url) => /\/analyses\/[a-zA-Z0-9-]+/.test(new URL(url).pathname), {
        timeout: 30000,
      });
    } catch {}
    await ensureCursor(page);
    await sleep(300);

    // Poll for completion (simulator takes 10-15s)
    let done = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const txt = await page.textContent('body');
      if (txt?.includes('Completed') || txt?.includes('Analysis complete')) {
        console.log(`  Analysis complete! (${vt()}s)`);
        done = true;
        break;
      }
      // Safety: if we've used too much time, force-reload
      if (elapsed() > 105) {
        console.log(`  Time budget: forcing reload (${vt()}s)`);
        break;
      }
      // Subtle cursor movement while waiting
      await moveTo(page, 500 + (i % 4) * 60, 320 + (i % 3) * 30);
    }
    if (!done) {
      await page.reload({ waitUntil: 'load' });
      await ensureCursor(page);
      await sleep(1000);
    }

    // ─── SCENE 8: Analysis Results (MAIN FOCUS) ────────
    console.log(`[8] Results - detailed walkthrough (${vt()}s)`);
    await ensureCursor(page);
    await smoothScroll(page, 0);

    // Calculate adaptive pause based on remaining time
    const resultsTimeAvailable = Math.max(15, remaining() - 9);
    const basePause = Math.floor((resultsTimeAvailable * 1000) / 10);
    const sectionPause = (weight) => Math.min(Math.floor(basePause * weight), 5000);

    console.log(
      `  Time available for results: ${resultsTimeAvailable.toFixed(0)}s (pause base: ${basePause}ms)`,
    );

    // Header — status, severity, timestamps
    await moveTo(page, 720, 200);
    await sleep(sectionPause(0.8));

    // Incident Description
    console.log(`  Incident Description (${vt()}s)`);
    await scrollToSection(page, 'Incident Description', 250);
    await moveTo(page, 500 + Math.random() * 300, 250 + Math.random() * 150);
    await sleep(sectionPause(1.0));

    // Root Cause Analysis — THE key section
    console.log(`  Root Cause Analysis (${vt()}s)`);
    await scrollToSection(page, 'Root Cause', 300);
    await moveTo(page, 450 + Math.random() * 300, 280 + Math.random() * 120);
    await sleep(sectionPause(1.3));
    // Sub-scroll within root cause (it's usually long)
    const rcY = await getContainerScrollTop(page);
    await smoothScroll(page, rcY + 180);
    await moveTo(page, 500 + Math.random() * 250, 300 + Math.random() * 100);
    await sleep(sectionPause(1.0));

    // Event Timeline
    console.log(`  Event Timeline (${vt()}s)`);
    await scrollToSection(page, 'Event Timeline', 300);
    await moveTo(page, 400 + Math.random() * 350, 260 + Math.random() * 130);
    await sleep(sectionPause(1.0));
    const tlY = await getContainerScrollTop(page);
    await smoothScroll(page, tlY + 150);
    await sleep(sectionPause(0.7));

    // Recommendations
    console.log(`  Recommendations (${vt()}s)`);
    await scrollToSection(page, 'Recommendation', 300);
    await moveTo(page, 420 + Math.random() * 320, 270 + Math.random() * 120);
    await sleep(sectionPause(1.1));
    const rmY = await getContainerScrollTop(page);
    await smoothScroll(page, rmY + 120);
    await sleep(sectionPause(0.6));

    // Data Sources
    console.log(`  Data Sources (${vt()}s)`);
    await scrollToSection(page, 'Data Sources', 250);
    await moveTo(page, 450 + Math.random() * 300, 290 + Math.random() * 100);
    await sleep(sectionPause(0.9));

    // Investigation Audit Trail
    console.log(`  Audit Trail (${vt()}s)`);
    await scrollToSection(page, 'Audit Trail', 250);
    await moveTo(page, 400 + Math.random() * 350, 280 + Math.random() * 110);
    await sleep(sectionPause(0.9));
    const atY = await getContainerScrollTop(page);
    await smoothScroll(page, atY + 150);
    await sleep(sectionPause(0.5));

    // Scroll back to top — final overview
    await smoothScroll(page, 0);
    await moveTo(page, 720, 250);
    await sleep(sectionPause(0.5));

    // ─── SCENE 9: Billing ───────────────────────────────
    console.log(`[9] Billing (${vt()}s)`);
    await navigateTo(page, `${DASHBOARD_URL}/dashboard/billing`);
    await sleep(600);
    await moveTo(page, 720, 350);
    await sleep(1500);
    await smoothScroll(page, 300);
    await sleep(1200);
    await smoothScroll(page, 0);
    await sleep(500);

    console.log(`\n=== Done! Total: ${vt()}s ===`);
  } catch (error) {
    console.error(`\n!!! Error: ${error.message}`);
    console.error(error.stack);
    await page
      .screenshot({ path: './demo-video/error-screenshot.png', fullPage: true })
      .catch(() => {});
  } finally {
    await context.close();
    await browser.close();

    // ─── Convert to MP4 ──────────────────────────────────
    console.log('\nVideo files:');
    const files = readdirSync('./demo-video/').filter((f) => f.endsWith('.webm'));
    console.log(execFileSync('ls', ['-lah', './demo-video/']).toString());

    if (files.length > 0) {
      // Use the most recently created WebM file
      const webm = path.join('./demo-video/', files[files.length - 1]);
      const mp4 = './demo-video/causeflow-demo.mp4';

      console.log(`Converting ${webm} -> ${mp4} ...`);
      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            webm,
            '-c:v',
            'libx264',
            '-crf',
            '23',
            '-preset',
            'fast',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            '-an', // no audio track
            mp4,
          ],
          { stdio: 'inherit', timeout: 120_000 },
        );
        console.log('\nMP4 conversion complete!');
        console.log(execFileSync('ls', ['-lah', mp4]).toString());
      } catch (e) {
        console.error('MP4 conversion failed:', e.message);
      }
    } else {
      console.log('No WebM files found to convert.');
    }
  }
})();
