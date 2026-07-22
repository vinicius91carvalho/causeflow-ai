#!/usr/bin/env node
/**
 * mint export assumes site root `/`. GitHub project Pages serves under
 * `/{repo}/`, so rewrite static HTML/CSS asset URLs and Next.js router basePath.
 *
 * JS chunk paths stay unprefixed: with basePath set, the Next.js runtime
 * prefixes them. Rewriting both would double-prefix (`/repo/repo/_next/...`).
 *
 * Usage: node rewrite-github-pages-base.mjs <site-dir> [base-path]
 * Example: node rewrite-github-pages-base.mjs _site /causeflow-ai
 */
import fs from "node:fs";
import path from "node:path";

const siteDir = path.resolve(process.argv[2] || "_site");
const basePath = (process.argv[3] || "/causeflow-ai").replace(/\/$/, "") || "";

if (!basePath.startsWith("/")) {
  console.error("base path must start with /");
  process.exit(1);
}
if (!fs.existsSync(siteDir)) {
  console.error(`site dir not found: ${siteDir}`);
  process.exit(1);
}

const TEXT_EXT = new Set([
  ".html",
  ".css",
  ".js",
  ".svg",
  ".xml",
  ".webmanifest",
]);

function rewriteMarkup(content) {
  content = content.replace(
    /\b(href|src|poster|content|action|data-href)="\/(?!\/)/g,
    `$1="${basePath}/`,
  );
  content = content.replace(/\bsrcset="([^"]*)"/g, (_, urls) => {
    const rewritten = urls.replace(/(^|,\s*)\/(?!\/)/g, `$1${basePath}/`);
    return `srcset="${rewritten}"`;
  });
  content = content.replace(/url\(\s*\/(?!\/)/g, `url(${basePath}/`);
  content = content.replace(/url\(\s*'\/(?!\/)/g, `url('${basePath}/`);
  content = content.replace(/url\(\s*"\/(?!\/)/g, `url("${basePath}/`);
  return content;
}

function rewriteRouterBasePath(content) {
  content = content.replaceAll('this.basePath=""', `this.basePath="${basePath}"`);
  content = content.replaceAll('basePath:""', `basePath:"${basePath}"`);
  return content;
}

let changed = 0;

/** @param {string} dir */
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const original = text;
    if (ext === ".html" || ext === ".css" || ext === ".svg" || ext === ".xml" || ext === ".webmanifest") {
      text = rewriteMarkup(text);
    }
    if (ext === ".js" || ext === ".html") {
      text = rewriteRouterBasePath(text);
    }
    if (text !== original) {
      fs.writeFileSync(full, text, "utf8");
      changed += 1;
    }
  }
}

walk(siteDir);
console.log(`rewrote ${changed} files for base path ${basePath}`);
