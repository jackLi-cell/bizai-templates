/**
 * Multilingual site builder for bizai.jtlcook.com
 * Creates /zh/ and /en/ directories from existing Chinese HTML files
 */
const fs = require('fs');
const path = require('path');

const SITE_DIR = __dirname;
const BASE_URL = normalizeSiteUrl(process.env.SITE_URL, 'https://bizai.jtlcook.com');
const TODAY = '2026-05-26';
const CONTENT_DIRS = ['guides', 'industries', 'pages', 'scenarios', 'tasks', 'templates', 'tools'];
const SITEMAP_PAGE_LIMIT = Number(process.env.SITEMAP_PAGE_LIMIT || 49);

function normalizeSiteUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  return raw.replace(/^http:\/\//i, 'https://');
}

// Load translation dictionary from external JSON file
const T = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'translations.json'), 'utf-8'));

// Sort keys by length (longest first) for replacement
const SORTED_KEYS = Object.keys(T).sort((a, b) => b.length - a.length);

function translateText(text) {
  let result = text;
  for (const key of SORTED_KEYS) {
    if (result.includes(key)) {
      result = result.split(key).join(T[key]);
    }
  }
  return result;
}

function getAssetPrefix(relFilePath) {
  const depth = relFilePath.split('/').length - 1;
  return depth === 0 ? '../assets/' : '../../assets/';
}

function getFaviconPath(relFilePath) {
  const depth = relFilePath.split('/').length - 1;
  return depth === 0 ? '../favicon.svg' : '../../favicon.svg';
}

function getAppJsPath(relFilePath) {
  const depth = relFilePath.split('/').length - 1;
  return depth === 0 ? '../assets/app.js' : '../../assets/app.js';
}

function getUrlPath(relFilePath) {
  if (relFilePath === 'index.html') return '';
  if (relFilePath.endsWith('/index.html')) return relFilePath.replace('/index.html', '/');
  return relFilePath.replace('.html', '');
}

// Process HTML for zh version (adjust paths, add hreflang, add switcher)
function processForZh(content, relFilePath) {
  const urlPath = getUrlPath(relFilePath);
  const zhUrl = `${BASE_URL}/zh/${urlPath}`;
  const enUrl = `${BASE_URL}/en/${urlPath}`;
  const assetPrefix = getAssetPrefix(relFilePath);
  const faviconPath = getFaviconPath(relFilePath);
  const appJsPath = getAppJsPath(relFilePath);

  let html = content;

  // Fix asset paths
  html = html.replace(/href="\.\/assets\/styles\.css"/g, `href="${assetPrefix}styles.css"`);
  html = html.replace(/href="\.\.\/assets\/styles\.css"/g, `href="${assetPrefix}styles.css"`);
  html = html.replace(/src="\.\/assets\/app\.js"/g, `src="${appJsPath}"`);
  html = html.replace(/src="\.\.\/assets\/app\.js"/g, `src="${appJsPath}"`);
  html = html.replace(/href="\.\/favicon\.svg"/g, `href="${faviconPath}"`);
  html = html.replace(/href="\.\.\/favicon\.svg"/g, `href="${faviconPath}"`);

  // Update canonical
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${zhUrl}">`);

  // Add hreflang tags after canonical
  const hreflangTags = `\n<link rel="alternate" hreflang="zh" href="${zhUrl}">\n<link rel="alternate" hreflang="en" href="${enUrl}">\n<link rel="alternate" hreflang="x-default" href="${enUrl}">`;
  html = html.replace(/(<link rel="canonical"[^>]*>)/, `$1${hreflangTags}`);

  // Update og:url
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${zhUrl}">`);

  // Add language switcher in nav
  const switcherPath = relFilePath === 'index.html' ? '../en/index.html' : `../../en/${relFilePath}`;
  const switcher = `<div class="lang-switcher"><a href="${switcherPath}" class="lang-btn" title="English">EN</a></div>`;
  html = html.replace(/(<\/nav>\s*\n)(<\/header>)/, `$1  ${switcher}\n$2`);

  return html;
}

// Process HTML for en version (translate + adjust paths + hreflang + switcher)
function processForEn(content, relFilePath) {
  const urlPath = getUrlPath(relFilePath);
  const zhUrl = `${BASE_URL}/zh/${urlPath}`;
  const enUrl = `${BASE_URL}/en/${urlPath}`;
  const assetPrefix = getAssetPrefix(relFilePath);
  const faviconPath = getFaviconPath(relFilePath);
  const appJsPath = getAppJsPath(relFilePath);

  let html = content;

  // Change lang attribute
  html = html.replace(/<html lang="zh-CN">/, '<html lang="en">');

  // Fix asset paths
  html = html.replace(/href="\.\/assets\/styles\.css"/g, `href="${assetPrefix}styles.css"`);
  html = html.replace(/href="\.\.\/assets\/styles\.css"/g, `href="${assetPrefix}styles.css"`);
  html = html.replace(/src="\.\/assets\/app\.js"/g, `src="${appJsPath}"`);
  html = html.replace(/src="\.\.\/assets\/app\.js"/g, `src="${appJsPath}"`);
  html = html.replace(/href="\.\/favicon\.svg"/g, `href="${faviconPath}"`);
  html = html.replace(/href="\.\.\/favicon\.svg"/g, `href="${faviconPath}"`);

  // Update canonical
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${enUrl}">`);

  // Add hreflang
  const hreflangTags = `\n<link rel="alternate" hreflang="zh" href="${zhUrl}">\n<link rel="alternate" hreflang="en" href="${enUrl}">\n<link rel="alternate" hreflang="x-default" href="${enUrl}">`;
  html = html.replace(/(<link rel="canonical"[^>]*>)/, `$1${hreflangTags}`);

  // Update og:url and og:locale
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${enUrl}">`);
  html = html.replace(/<meta property="og:locale" content="zh_CN">/, '<meta property="og:locale" content="en_US">');

  // Protect prompt-text blocks from translation
  const promptBlocks = [];
  html = html.replace(/<pre class="prompt-text"[^>]*>[\s\S]*?<\/pre>/g, (match) => {
    promptBlocks.push(match);
    return `__PROMPT_${promptBlocks.length - 1}__`;
  });

  // Translate all text content
  html = translateText(html);

  // Restore prompt blocks
  promptBlocks.forEach((block, i) => {
    html = html.replace(`__PROMPT_${i}__`, block);
  });

  // Add language switcher
  const switcherPath = relFilePath === 'index.html' ? '../zh/index.html' : `../../zh/${relFilePath}`;
  const switcher = `<div class="lang-switcher"><a href="${switcherPath}" class="lang-btn" title="Chinese">CN</a></div>`;
  html = html.replace(/(<\/nav>\s*\n)(<\/header>)/, `$1  ${switcher}\n$2`);

  return html;
}

// Main build function
function build() {
  console.log('Starting multilingual build...');

  const zhDir = path.join(SITE_DIR, 'zh');
  const enDir = path.join(SITE_DIR, 'en');

  // Clean existing
  if (fs.existsSync(zhDir)) fs.rmSync(zhDir, { recursive: true });
  if (fs.existsSync(enDir)) fs.rmSync(enDir, { recursive: true });
  fs.mkdirSync(zhDir, { recursive: true });
  fs.mkdirSync(enDir, { recursive: true });

  // Process root index.html
  const rootContent = fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf-8');
  fs.writeFileSync(path.join(zhDir, 'index.html'), processForZh(rootContent, 'index.html'));
  fs.writeFileSync(path.join(enDir, 'index.html'), processForEn(rootContent, 'index.html'));
  console.log('  Processed: index.html');

  // Process content directories
  let totalFiles = 0;
  for (const dir of CONTENT_DIRS) {
    const srcDir = path.join(SITE_DIR, dir);
    if (!fs.existsSync(srcDir)) continue;

    fs.mkdirSync(path.join(zhDir, dir), { recursive: true });
    fs.mkdirSync(path.join(enDir, dir), { recursive: true });

    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
    for (const file of files) {
      const relPath = `${dir}/${file}`;
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      fs.writeFileSync(path.join(zhDir, dir, file), processForZh(content, relPath));
      fs.writeFileSync(path.join(enDir, dir, file), processForEn(content, relPath));
      totalFiles++;
    }
    console.log(`  Processed: ${dir}/ (${files.length} files)`);
  }

  console.log(`  Total content files: ${totalFiles + 1}`);

  // Generate sitemap
  generateSitemap();

  // Create root index.html (language detection)
  createRootIndex();

  // Delete old content pages from root
  deleteOldPages();

  console.log('Build complete!');
}

function generateSitemap() {
  const pages = [];

  // Collect all pages
  pages.push({ path: '', priority: '1.0', changefreq: 'weekly' });

  for (const dir of CONTENT_DIRS) {
    const srcDir = path.join(SITE_DIR, dir);
    if (!fs.existsSync(srcDir)) continue;
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
    for (const file of files) {
      const relPath = `${dir}/${file}`;
      const urlPath = getUrlPath(relPath);
      let priority = '0.6';
      let changefreq = 'monthly';
      if (dir === 'industries' || dir === 'tasks') priority = '0.7';
      if (dir === 'tools') { priority = '0.8'; changefreq = 'weekly'; }
      if (dir === 'scenarios') priority = '0.5';
      if (dir === 'pages') priority = '0.4';
      if (file === 'index.html' && dir === 'templates') { priority = '0.9'; changefreq = 'weekly'; }
      pages.push({ path: urlPath, priority, changefreq });
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
  xml += `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  for (const page of selectSitemapPages(pages)) {
    const zhUrl = `${BASE_URL}/zh/${page.path}`;
    const enUrl = `${BASE_URL}/en/${page.path}`;
    xml += `  <url>\n    <loc>${zhUrl}</loc>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="zh" href="${zhUrl}"/>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${enUrl}</loc>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="zh" href="${zhUrl}"/>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
  }
  xml += '</urlset>\n';
  fs.writeFileSync(path.join(SITE_DIR, 'sitemap.xml'), xml);
  console.log('  Generated: sitemap.xml');
}

function selectSitemapPages(pages) {
  const score = (page) => {
    if (page.path === '') return 0;
    if (page.path === 'templates/') return 1;
    if (/^industries\//.test(page.path)) return 2;
    if (/^tasks\//.test(page.path)) return 3;
    if (/^tools\//.test(page.path)) return 4;
    if (/^guides\//.test(page.path)) return 5;
    if (/^scenarios\//.test(page.path)) return 6;
    if (/^pages\//.test(page.path)) return 7;
    if (/^templates\//.test(page.path)) return 9;
    return 20;
  };
  return [...pages]
    .sort((a, b) => score(a) - score(b) || a.path.localeCompare(b.path))
    .slice(0, SITEMAP_PAGE_LIMIT);
}

function createRootIndex() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Small Business AI Templates</title>
<link rel="alternate" hreflang="zh" href="${BASE_URL}/zh/">
<link rel="alternate" hreflang="en" href="${BASE_URL}/en/">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/">
<script>
(function(){
  var saved = localStorage.getItem('lang');
  if(saved === 'en') { window.location.replace('./en/'); return; }
  if(saved === 'zh') { window.location.replace('./zh/'); return; }
  var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if(lang.startsWith('zh')) { window.location.replace('./zh/'); }
  else { window.location.replace('./en/'); }
})();
</script>
</head>
<body>
<noscript>
<p><a href="./zh/">中文版</a> | <a href="./en/">English</a></p>
</noscript>
</body>
</html>`;
  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);
  console.log('  Created: root index.html (language detection)');
}

function deleteOldPages() {
  for (const dir of CONTENT_DIRS) {
    const dirPath = path.join(SITE_DIR, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true });
      console.log(`  Deleted: ${dir}/`);
    }
  }
}

build();
