#!/usr/bin/env node
/**
 * Build a static GitHub Pages export of the marketing website.
 * Parks middleware + staging-auth (+ server actions) outside `src/` for the build —
 * those features are unsupported with `output: 'export'`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const parkRoot = path.join(appRoot, '.pages-park');

const parked = [
  path.join(srcRoot, 'middleware.ts'),
  path.join(srcRoot, 'app', 'staging-auth'),
  path.join(srcRoot, 'contexts', 'shell', 'api'),
  path.join(srcRoot, 'contexts', 'shell', 'presentation', 'components', 'staging-auth-form.tsx'),
  path.join(srcRoot, 'contexts', 'shell', 'presentation', 'pages', 'staging-auth-page.tsx'),
  path.join(srcRoot, 'contexts', 'shell', 'presentation', 'pages', 'staging-auth-layout.tsx'),
];

/** @param {string} from */
function parkPathFor(from) {
  return path.join(parkRoot, path.relative(srcRoot, from));
}

function park() {
  fs.rmSync(parkRoot, { recursive: true, force: true });
  for (const from of parked) {
    if (!fs.existsSync(from)) continue;
    const to = parkPathFor(from);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    console.log('parked', path.relative(appRoot, from));
  }
}

function restore() {
  if (!fs.existsSync(parkRoot)) return;
  for (const from of parked) {
    const to = parkPathFor(from);
    if (!fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(from), { recursive: true });
    if (fs.existsSync(from)) {
      fs.rmSync(from, { recursive: true, force: true });
    }
    fs.renameSync(to, from);
    console.log('restored', path.relative(appRoot, from));
  }
  fs.rmSync(parkRoot, { recursive: true, force: true });
}

/** @param {string} outDir @param {string} locale */
function mirrorDefaultLocaleToRoot(outDir, locale) {
  const localeDir = path.join(outDir, locale);
  if (!fs.existsSync(localeDir)) {
    throw new Error(`missing default locale export at ${localeDir}`);
  }
  /** @param {string} dir */
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, ent.name);
      const rel = path.relative(localeDir, from);
      const to = path.join(outDir, rel);
      if (ent.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        walk(from);
        continue;
      }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
  walk(localeDir);
  console.log(`mirrored /${locale}/ pages to site root`);
}

park();
let exitCode = 0;
try {
  const env = {
    ...process.env,
    GITHUB_PAGES: '1',
    NODE_ENV: 'production',
    NEXT_PUBLIC_DEPLOYMENT_STAGE: process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE || 'development',
    // Published Pages CTAs open the public GitHub repo (not a hosted dashboard).
    NEXT_PUBLIC_DASHBOARD_URL:
      process.env.NEXT_PUBLIC_DASHBOARD_URL ||
      'https://github.com/vinicius91carvalho/causeflow-ai',
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || 'https://vinicius91carvalho.github.io/causeflow-ai',
  };
  const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
    cwd: appRoot,
    env,
    stdio: 'inherit',
  });
  exitCode = result.status ?? 1;
  if (exitCode === 0) {
    const outDir = path.join(appRoot, 'out');
    if (!fs.existsSync(outDir)) {
      console.error('expected static export directory missing:', outDir);
      exitCode = 1;
    } else {
      // Without middleware, next-intl exports default locale under /en/.
      // Mirror English pages to the site root so /causeflow-ai/ matches production.
      mirrorDefaultLocaleToRoot(outDir, 'en');
      console.log('GitHub Pages website export ready at', outDir);
    }
  }
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  restore();
}
process.exit(exitCode);
