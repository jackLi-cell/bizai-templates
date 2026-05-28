#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_HOST_SUFFIXES = ['jtlcook.com', 'jtlcookie.com'];
const SKIP_DIRS = new Set(['.git', '.next', 'node_modules', 'source-cache']);
const JSON_LD_URL_KEYS = new Set([
  '@id',
  'url',
  'item',
  'sameAs',
  'image',
  'logo',
  'contentUrl',
  'thumbnailUrl',
  'embedUrl',
  'mainEntityOfPage',
  'target'
]);
const PLACEHOLDER_ORIGINS = [
  'https://__SITE_ORIGIN__',
  'http://__SITE_ORIGIN__',
  'https://site-origin.invalid',
  'http://site-origin.invalid'
];

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const siteDir = args.siteDir ? path.resolve(args.siteDir) : null;
const origin = args.origin ? normalizeOrigin(args.origin) : null;

if (!siteDir || !origin) {
  printHelp();
  fail('Missing required --site-dir or --origin.');
}

if (!existsSync(siteDir) || !statSync(siteDir).isDirectory()) {
  fail(`Site directory does not exist: ${siteDir}`);
}

const targetUrl = new URL(origin);
const targetHost = targetUrl.hostname.toLowerCase();
const hostSuffixes = splitList(args.hostSuffixes).length
  ? splitList(args.hostSuffixes).map((item) => item.toLowerCase())
  : DEFAULT_HOST_SUFFIXES;
const explicitHosts = splitList(args.fromHosts).map((item) => item.toLowerCase());
const cleanUrls = args.cleanUrls !== false;
const dryRun = Boolean(args.dryRun || args.check);
const checkOnly = Boolean(args.check);
const strict = Boolean(args.strict);
const verbose = Boolean(args.verbose);

const files = await collectTargetFiles(siteDir);
const summary = {
  scanned: 0,
  changed: 0,
  urlChanges: 0,
  warnings: []
};

for (const file of files) {
  summary.scanned += 1;
  const original = await readFile(file, 'utf8');
  const relPath = toPublicPath(path.relative(siteDir, file));
  const result = rewriteFile(file, original, relPath);

  if (result.warnings.length) {
    for (const warning of result.warnings) {
      summary.warnings.push(`${path.relative(siteDir, file)}: ${warning}`);
    }
  }

  if (result.text !== original) {
    summary.changed += 1;
    summary.urlChanges += result.urlChanges;
    if (!dryRun) {
      await writeFile(file, result.text, 'utf8');
    }
    if (verbose || dryRun) {
      console.log(`${dryRun ? 'would update' : 'updated'} ${path.relative(siteDir, file)} (${result.urlChanges} URLs)`);
    }
  }
}

const mode = checkOnly ? 'check' : dryRun ? 'dry-run' : 'write';
console.log(`[seo-origin] mode=${mode} site=${siteDir} origin=${origin}`);
console.log(`[seo-origin] scanned=${summary.scanned} changed=${summary.changed} urlChanges=${summary.urlChanges} warnings=${summary.warnings.length}`);

if (summary.warnings.length) {
  for (const warning of summary.warnings.slice(0, 30)) {
    console.warn(`[seo-origin] warning ${warning}`);
  }
  if (summary.warnings.length > 30) {
    console.warn(`[seo-origin] warning ... ${summary.warnings.length - 30} more`);
  }
}

if (checkOnly && summary.changed > 0) {
  process.exitCode = 2;
}

if (strict && summary.warnings.length > 0) {
  process.exitCode = 3;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--check') {
      parsed.check = true;
      continue;
    }
    if (arg === '--strict') {
      parsed.strict = true;
      continue;
    }
    if (arg === '--verbose') {
      parsed.verbose = true;
      continue;
    }
    if (arg === '--no-clean-urls') {
      parsed.cleanUrls = false;
      continue;
    }
    if (!arg.startsWith('--')) {
      fail(`Unknown argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/inject-seo-origin.mjs --site-dir <public-site-dir> --origin <https://host> [options]

Required:
  --site-dir <dir>              Public output directory, for example /opt/static-sites/11-toolbox/site
  --origin <url>                Canonical public origin for this server, for example https://tools.jtlcookie.com

Options:
  --from-hosts <hosts>          Comma-separated exact hosts that may be replaced
  --host-suffixes <suffixes>    Comma-separated suffixes that may be replaced; defaults to jtlcook.com,jtlcookie.com
  --dry-run                     Show changes without writing files
  --check                       Exit 2 if files would change
  --strict                      Exit 3 if old same-site hosts remain in processed files
  --no-clean-urls               Keep .html and /index.html in SEO URLs
  --verbose                     Print changed files

The script updates sitemap XML, robots.txt, HTML canonical/hreflang/og:url metadata,
and JSON-LD URL fields. It does not rewrite normal page navigation links.`);
}

async function collectTargetFiles(root) {
  const found = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(path.join(dir, entry.name));
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const file = path.join(dir, entry.name);
      if (isTargetFile(file)) {
        found.push(file);
      }
    }
  }
  await walk(root);
  return found.sort();
}

function isTargetFile(file) {
  const name = path.basename(file).toLowerCase();
  const ext = path.extname(file).toLowerCase();
  return (
    ext === '.html' ||
    ext === '.htm' ||
    name === 'robots.txt' ||
    /^sitemap(?:[-\w]*)?\.xml$/.test(name)
  );
}

function rewriteFile(file, text, publicPath) {
  const lowerName = path.basename(file).toLowerCase();
  const ext = path.extname(file).toLowerCase();
  if (lowerName === 'robots.txt') {
    return rewriteRobots(text);
  }
  if (/^sitemap(?:[-\w]*)?\.xml$/.test(lowerName)) {
    return rewriteSitemap(text, publicPath);
  }
  if (ext === '.html' || ext === '.htm') {
    return rewriteHtml(text, publicPath);
  }
  return { text, urlChanges: 0, warnings: [] };
}

function rewriteRobots(text) {
  let urlChanges = 0;
  let next = text.replace(/^(\s*Sitemap:\s*)(\S+)(\s*)$/gim, (match, prefix, value, suffix) => {
    const updated = rewriteUrlValue(value, '/robots.txt', { forceAbsolute: true });
    if (updated.changed) {
      urlChanges += 1;
    }
    return `${prefix}${updated.value}${suffix}`;
  });

  if (!/^sitemap:/im.test(next) && existsSync(path.join(siteDir, 'sitemap.xml'))) {
    next = `${next.replace(/\s*$/, '')}\n\nSitemap: ${origin}/sitemap.xml\n`;
    urlChanges += 1;
  }

  return withWarnings(next, urlChanges);
}

function rewriteSitemap(text, publicPath) {
  let urlChanges = 0;
  let next = text.replace(/(<loc>)([^<]+)(<\/loc>)/gi, (match, open, value, close) => {
    const updated = rewriteUrlValue(decodeXml(value.trim()), publicPath, { forceAbsolute: true });
    if (updated.changed) {
      urlChanges += 1;
    }
    return `${open}${escapeXml(updated.value)}${close}`;
  });

  next = next.replace(/(<xhtml:link\b[^>]*\bhref=)(["'])([^"']+)(\2[^>]*>)/gi, (match, prefix, quote, value, suffix) => {
    const updated = rewriteUrlValue(decodeXml(value), publicPath, { forceAbsolute: true });
    if (updated.changed) {
      urlChanges += 1;
    }
    return `${prefix}${quote}${escapeXml(updated.value)}${suffix}`;
  });

  return withWarnings(next, urlChanges);
}

function rewriteHtml(text, publicPath) {
  let urlChanges = 0;
  let next = text.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = getAttr(tag, 'rel');
    if (!rel) {
      return tag;
    }
    const relTokens = rel.toLowerCase().split(/\s+/);
    const shouldRewrite = relTokens.includes('canonical') || (relTokens.includes('alternate') && Boolean(getAttr(tag, 'hreflang')));
    if (!shouldRewrite) {
      return tag;
    }
    return replaceAttr(tag, 'href', (value) => {
      const updated = rewriteUrlValue(value, publicPath, { forceAbsolute: true });
      if (updated.changed) {
        urlChanges += 1;
      }
      return updated.value;
    });
  });

  next = next.replace(/<meta\b[^>]*>/gi, (tag) => {
    const property = (getAttr(tag, 'property') || getAttr(tag, 'name') || '').toLowerCase();
    if (!['og:url', 'twitter:url', 'og:image', 'twitter:image'].includes(property)) {
      return tag;
    }
    return replaceAttr(tag, 'content', (value) => {
      const updated = rewriteUrlValue(value, publicPath, { forceAbsolute: true });
      if (updated.changed) {
        urlChanges += 1;
      }
      return updated.value;
    });
  });

  next = next.replace(/<script\b([^>]*)type=(["'])application\/ld\+json\2([^>]*)>([\s\S]*?)<\/script>/gi, (match, before, quote, after, jsonText) => {
    const rewritten = rewriteJsonLd(jsonText, publicPath);
    urlChanges += rewritten.urlChanges;
    return `<script${before}type=${quote}application/ld+json${quote}${after}>${rewritten.text}</script>`;
  });

  const canonical = ensureCanonical(next, publicPath);
  next = canonical.text;
  urlChanges += canonical.urlChanges;

  return withWarnings(next, urlChanges, collectHtmlSeoText(next));
}

function ensureCanonical(text, publicPath) {
  if (hasCanonicalLink(text)) {
    return { text, urlChanges: 0 };
  }

  const closeHead = text.match(/<\/head\s*>/i);
  if (!closeHead || typeof closeHead.index !== 'number') {
    return { text, urlChanges: 0 };
  }

  const canonicalUrl = buildOriginUrl(publicPath);
  const tag = `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">`;
  const before = text.slice(0, closeHead.index);
  const after = text.slice(closeHead.index);
  const insertion = before.endsWith('\n') ? `    ${tag}\n` : `\n    ${tag}\n`;
  return { text: `${before}${insertion}${after}`, urlChanges: 1 };
}

function hasCanonicalLink(text) {
  for (const match of text.matchAll(/<link\b[^>]*>/gi)) {
    const rel = getAttr(match[0], 'rel');
    if (!rel) {
      continue;
    }
    if (rel.toLowerCase().split(/\s+/).includes('canonical')) {
      return true;
    }
  }
  return false;
}

function rewriteJsonLd(jsonText, publicPath) {
  const trimmed = jsonText.trim();
  if (!trimmed) {
    return { text: jsonText, urlChanges: 0 };
  }

  try {
    const parsed = JSON.parse(trimmed);
    let urlChanges = 0;
    const walked = walkJson(parsed, (value) => {
      const updated = rewriteUrlValue(value, publicPath, { forceAbsolute: false });
      if (updated.changed) {
        urlChanges += 1;
      }
      return updated.value;
    });
    return { text: JSON.stringify(walked), urlChanges };
  } catch {
    let urlChanges = 0;
    const text = jsonText.replace(/https?:\/\/__SITE_ORIGIN__[^"'<\s]*/g, (value) => {
      const updated = rewriteUrlValue(value, publicPath, { forceAbsolute: true });
      if (updated.changed) {
        urlChanges += 1;
      }
      return updated.value;
    }).replace(/https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?[^"'<\s]*/g, (value) => {
      const updated = rewriteUrlValue(value, publicPath, { forceAbsolute: false });
      if (updated.changed) {
        urlChanges += 1;
      }
      return updated.value;
    });
    return { text, urlChanges };
  }
}

function walkJson(value, rewriteString) {
  if (typeof value === 'string') {
    return rewriteString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkJson(item, rewriteString));
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = walkJson(item, rewriteString);
    }
    return next;
  }
  return value;
}

function rewriteUrlValue(rawValue, publicPath, options = {}) {
  const value = rawValue.trim();
  const leading = rawValue.match(/^\s*/)?.[0] || '';
  const trailing = rawValue.match(/\s*$/)?.[0] || '';
  const forceAbsolute = Boolean(options.forceAbsolute);

  for (const placeholder of PLACEHOLDER_ORIGINS) {
    if (value.startsWith(placeholder)) {
      const suffix = value.slice(placeholder.length) || '/';
      const rewritten = buildOriginUrl(suffix);
      return changedValue(rawValue, leading, rewritten, trailing);
    }
  }

  if (value.startsWith('/')) {
    if (!forceAbsolute) {
      return { value: rawValue, changed: false };
    }
    return changedValue(rawValue, leading, buildOriginUrl(value), trailing);
  }

  if (/^(?:\.{1,2}\/|[^:/?#]+\.html(?:[?#].*)?$)/i.test(value) && forceAbsolute) {
    try {
      const base = `${origin}${toFilePublicPath(publicPath)}`;
      const resolved = new URL(value, base);
      return changedValue(rawValue, leading, buildOriginUrl(resolved.pathname + resolved.search + resolved.hash), trailing);
    } catch {
      return { value: rawValue, changed: false };
    }
  }

  if (!/^https?:\/\//i.test(value)) {
    return { value: rawValue, changed: false };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return { value: rawValue, changed: false };
  }

  const host = url.hostname.toLowerCase();
  if (host === targetHost || shouldReplaceHost(host)) {
    const rewritten = buildOriginUrl(url.pathname + url.search + url.hash);
    return changedValue(rawValue, leading, rewritten, trailing);
  }

  return { value: rawValue, changed: false };
}

function changedValue(rawValue, leading, rewritten, trailing) {
  const value = `${leading}${rewritten}${trailing}`;
  return { value, changed: value !== rawValue };
}

function buildOriginUrl(pathAndMore) {
  const value = pathAndMore || '/';
  let pathname = value;
  let search = '';
  let hash = '';

  const hashIndex = pathname.indexOf('#');
  if (hashIndex >= 0) {
    hash = pathname.slice(hashIndex);
    pathname = pathname.slice(0, hashIndex);
  }

  const queryIndex = pathname.indexOf('?');
  if (queryIndex >= 0) {
    search = pathname.slice(queryIndex);
    pathname = pathname.slice(0, queryIndex);
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  if (cleanUrls) {
    pathname = cleanPublicUrlPath(pathname);
  }

  return `${origin}${pathname}${search}${hash}`;
}

function cleanPublicUrlPath(pathname) {
  let next = pathname.replace(/\\/g, '/');
  next = next.replace(/\/index\.html$/i, '/');
  next = next.replace(/\.html$/i, '');
  next = next.replace(/\/{2,}/g, '/');
  return next || '/';
}

function shouldReplaceHost(host) {
  if (explicitHosts.includes(host)) {
    return true;
  }
  return hostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function getAttr(tag, attr) {
  const pattern = new RegExp(`\\b${escapeRegExp(attr)}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(pattern)?.[2] || null;
}

function replaceAttr(tag, attr, updater) {
  const pattern = new RegExp(`(\\b${escapeRegExp(attr)}\\s*=\\s*)(["'])(.*?)(\\2)`, 'i');
  return tag.replace(pattern, (match, prefix, quote, value, close) => `${prefix}${quote}${escapeHtmlAttr(updater(decodeHtmlAttr(value)))}${close}`);
}

function collectHtmlSeoText(text) {
  const parts = [];
  for (const match of text.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = getAttr(tag, 'rel');
    if (!rel) {
      continue;
    }
    const relTokens = rel.toLowerCase().split(/\s+/);
    if (relTokens.includes('canonical') || (relTokens.includes('alternate') && Boolean(getAttr(tag, 'hreflang')))) {
      parts.push(tag);
    }
  }
  for (const match of text.matchAll(/<meta\b[^>]*>/gi)) {
    const property = (getAttr(match[0], 'property') || getAttr(match[0], 'name') || '').toLowerCase();
    if (['og:url', 'twitter:url', 'og:image', 'twitter:image'].includes(property)) {
      parts.push(match[0]);
    }
  }
  for (const match of text.matchAll(/<script\b[^>]*type=(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/gi)) {
    parts.push(collectJsonLdSeoText(match[0]));
  }
  return parts.join('\n');
}

function collectJsonLdSeoText(scriptTag) {
  const bodyMatch = scriptTag.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  const body = bodyMatch?.[1]?.trim();
  if (!body) {
    return '';
  }

  try {
    const parsed = JSON.parse(body);
    const values = [];
    collectJsonLdUrlValues(parsed, '', values);
    return values.join('\n');
  } catch {
    return scriptTag;
  }
}

function collectJsonLdUrlValues(value, key, values) {
  if (typeof value === 'string') {
    if (JSON_LD_URL_KEYS.has(key)) {
      values.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdUrlValues(item, key, values);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectJsonLdUrlValues(childValue, childKey, values);
    }
  }
}

function withWarnings(text, urlChanges, scanText = text) {
  const warnings = [];
  const ownHosts = findOwnHosts(scanText).filter((host) => host !== targetHost);
  if (ownHosts.length) {
    warnings.push(`same-site hosts remain after injection: ${ownHosts.join(', ')}`);
  }
  return { text, urlChanges, warnings };
}

function findOwnHosts(text) {
  const hosts = new Set();
  const matches = text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)(?::\d+)?/g);
  for (const match of matches) {
    const host = match[1].toLowerCase();
    if (shouldReplaceHost(host)) {
      hosts.add(host);
    }
  }
  return Array.from(hosts).sort();
}

function toPublicPath(relativePath) {
  return `/${relativePath.replace(/\\/g, '/')}`;
}

function toFilePublicPath(publicPath) {
  return publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`Invalid origin: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(`Origin must use http or https: ${value}`);
  }
  return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
}

function splitList(value) {
  if (!value) {
    return [];
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function escapeHtmlAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function decodeHtmlAttr(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&');
}

function fail(message) {
  console.error(`[seo-origin] ${message}`);
  process.exit(1);
}
