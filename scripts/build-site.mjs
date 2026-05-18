import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = join(ROOT, 'site');
const DATA = join(ROOT, 'data');

const DOMAIN = 'https://bizai.jtlcook.com';
const SITE_NAME = '小商家 AI 工作流与模板库';
const EMAIL = '1055567003@qq.com';

// Load data
const industries = JSON.parse(readFileSync(join(DATA, 'industries.json'), 'utf-8'));
const tasks = JSON.parse(readFileSync(join(DATA, 'tasks.json'), 'utf-8'));
const templates = JSON.parse(readFileSync(join(DATA, 'templates.json'), 'utf-8'));
const guides = JSON.parse(readFileSync(join(DATA, 'guides.json'), 'utf-8'));
const scenarios = JSON.parse(readFileSync(join(DATA, 'scenarios.json'), 'utf-8'));

// Ensure directories
const dirs = [
  SITE, join(SITE, 'templates'), join(SITE, 'industries'),
  join(SITE, 'tasks'), join(SITE, 'guides'), join(SITE, 'tools'),
  join(SITE, 'pages'), join(SITE, 'assets'), join(SITE, 'scenarios')
];
dirs.forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

// --- Helper: path prefix ---
function getPrefix(canonicalPath) {
  const parts = canonicalPath.split('/').filter(Boolean);
  const depth = canonicalPath.endsWith('/') ? parts.length : Math.max(0, parts.length - 1);
  if (depth === 0) return './';
  return '../'.repeat(depth);
}

function relativize(html, prefix) {
  // Replace href="/" with href to index
  html = html.replace(/href="\/"/g, `href="${prefix}index.html"`);
  // Replace href="/#xxx" (root with hash) with href="${prefix}index.html#xxx"
  html = html.replace(/href="\/(#[^"]+)"/g, (match, hash) => `href="${prefix}index.html${hash}"`);
  // Replace href="/xxx/" (directory links) with href="${prefix}xxx/index.html"
  html = html.replace(/href="\/([^"]*\/)"/g, (match, path) => `href="${prefix}${path}index.html"`);
  // Replace href="/xxx" (file links) with href="${prefix}xxx"
  html = html.replace(/href="\/([^"]+)"/g, (match, path) => `href="${prefix}${path}"`);
  // Replace src="/xxx" with src="${prefix}xxx"
  html = html.replace(/src="\/([^"]+)"/g, (match, path) => `src="${prefix}${path}"`);
  return html;
}

// --- Helper: JSON-LD generators ---
function jsonLdWebSite() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": DOMAIN,
    "description": "免费的小商家 AI Prompt 模板库，覆盖餐饮、零售、美业、维修、宠物、教育6大行业",
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": DOMAIN
    }
  });
}

function jsonLdFAQPage(faqItems) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  });
}

function jsonLdHowTo(template, indName) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": template.title,
    "description": template.description,
    "step": [
      { "@type": "HowToStep", "text": `准备材料：${template.materialsNeeded.join('、')}` },
      { "@type": "HowToStep", "text": "复制 Prompt 并替换花括号中的字段为你的实际信息" },
      { "@type": "HowToStep", "text": "将 Prompt 粘贴到 AI 工具中生成内容" },
      { "@type": "HowToStep", "text": `人工复核检查清单：${template.reviewChecklist.join('；')}` }
    ],
    "tool": [{ "@type": "HowToTool", "name": "AI 对话工具（如文心一言、通义千问、ChatGPT）" }],
    "supply": template.materialsNeeded.map(m => ({ "@type": "HowToSupply", "name": m }))
  });
}

function jsonLdCollectionPage(name, description, canonical) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": name,
    "description": description,
    "url": canonical,
    "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": DOMAIN }
  });
}

function jsonLdWebApplication(name, description, canonical) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": name,
    "description": description,
    "url": canonical,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" },
    "provider": { "@type": "Organization", "name": SITE_NAME, "url": DOMAIN }
  });
}

function jsonLdArticle(title, description, canonical) {
  const today = new Date().toISOString().split('T')[0];
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": canonical,
    "datePublished": "2024-01-01",
    "dateModified": today,
    "author": { "@type": "Organization", "name": SITE_NAME, "url": DOMAIN },
    "publisher": { "@type": "Organization", "name": SITE_NAME, "url": DOMAIN }
  });
}

// --- Helper: Open Graph tags ---
function ogTags({ title, description, canonical, type = 'website' }) {
  return `<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">`;
}

// --- Helper: HTML shell ---
function htmlPage({ title, description, canonical, body, extra = '', jsonLd = null, ogType = 'website' }) {
  // Extract path from canonical URL
  const canonicalPath = canonical.replace(DOMAIN, '') || '/';
  const prefix = getPrefix(canonicalPath);
  const processedBody = relativize(body, prefix);
  const ogMetaTags = ogTags({ title: `${title} - ${SITE_NAME}`, description, canonical, type: ogType });
  const jsonLdScript = jsonLd ? `<script type="application/ld+json">${jsonLd}<\/script>` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - ${SITE_NAME}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
${ogMetaTags}
<link rel="stylesheet" href="${prefix}assets/styles.css">
${jsonLdScript}
${extra}
</head>
<body>
<header class="site-header">
  <nav class="nav-container">
    <a href="${prefix}index.html" class="logo">${SITE_NAME}</a>
    <ul class="nav-links">
      <li><a href="${prefix}templates/index.html">模板库</a></li>
      <li><a href="${prefix}tools/prompt-builder.html">Prompt 构造器</a></li>
      <li><a href="${prefix}tools/output-checker.html">内容自检</a></li>
      <li><a href="${prefix}tools/reply-filter.html">客服筛选</a></li>
      <li><a href="${prefix}guides/how-to-use-ai.html">使用指南</a></li>
    </ul>
  </nav>
</header>
<main class="main-content">
${processedBody}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <p>&copy; 2024 ${SITE_NAME}</p>
    <p>联系邮箱：${EMAIL}</p>
    <nav class="footer-links">
      <a href="${prefix}pages/about.html">关于我们</a>
      <a href="${prefix}pages/contact.html">联系我们</a>
      <a href="${prefix}pages/disclaimer.html">免责声明</a>
      <a href="${prefix}pages/privacy.html">隐私政策</a>
      <a href="${prefix}pages/terms.html">使用条款</a>
    </nav>
  </div>
</footer>
<script src="${prefix}assets/app.js"><\/script>
</body>
</html>`;
}

// --- Build Index Page ---
function buildIndex() {
  const topTemplates = templates.slice(0, 6);
  const industryCards = industries.map(i => `
    <a href="/industries/${i.slug}.html" class="card industry-card">
      <h3>${i.name}</h3>
      <p>${i.description}</p>
    </a>`).join('');

  const taskCards = tasks.map(t => `
    <a href="/tasks/${t.slug}.html" class="card task-card">
      <h3>${t.name}</h3>
      <p>${t.description}</p>
    </a>`).join('');

  const templateCards = topTemplates.map(t => `
    <a href="/templates/${t.slug}.html" class="card template-card">
      <h3>${t.title}</h3>
      <p>${t.description}</p>
      <span class="tag">${industries.find(i=>i.id===t.industry)?.name || '通用'}</span>
    </a>`).join('');

  const body = `
<section class="hero">
  <h1>小商家 AI 文案助手</h1>
  <p class="hero-sub">免费的 AI Prompt 模板库，帮助小商家快速生成日常经营所需的各类文案</p>
  <div class="hero-actions">
    <a href="/templates/" class="btn btn-primary">浏览模板库</a>
    <a href="/tools/prompt-builder.html" class="btn btn-secondary">Prompt 构造器</a>
  </div>
</section>

<section class="section">
  <h2>按行业浏览</h2>
  <div class="card-grid">${industryCards}</div>
</section>

<section class="section">
  <h2>按任务浏览</h2>
  <div class="card-grid">${taskCards}</div>
</section>

<section class="section">
  <h2>高频模板</h2>
  <div class="card-grid">${templateCards}</div>
  <p class="section-more"><a href="/templates/">查看全部模板 &rarr;</a></p>
</section>

<section class="section faq-section">
  <h2>常见问题</h2>
  <div class="faq-list">
    <details><summary>这些模板怎么用？</summary><p>选择模板后，复制 Prompt，粘贴到你常用的 AI 工具中（如文心一言、通义千问），替换花括号中的信息即可生成文案。</p></details>
    <details><summary>需要付费吗？</summary><p>本站所有模板完全免费使用。你只需要有一个可用的 AI 对话工具。</p></details>
    <details><summary>AI 生成的内容能直接发布吗？</summary><p>不建议直接发布。请务必按照每个模板附带的复核清单检查后再使用。</p></details>
    <details><summary>支持哪些 AI 工具？</summary><p>任何支持对话的 AI 工具都可以，包括 ChatGPT、文心一言、通义千问、豆包、Kimi 等。</p></details>
  </div>
</section>`;

  // FAQ items for FAQPage schema
  const faqItems = [
    { question: '这些模板怎么用？', answer: '选择模板后，复制 Prompt，粘贴到你常用的 AI 工具中（如文心一言、通义千问），替换花括号中的信息即可生成文案。' },
    { question: '需要付费吗？', answer: '本站所有模板完全免费使用。你只需要有一个可用的 AI 对话工具。' },
    { question: 'AI 生成的内容能直接发布吗？', answer: '不建议直接发布。请务必按照每个模板附带的复核清单检查后再使用。' },
    { question: '支持哪些 AI 工具？', answer: '任何支持对话的 AI 工具都可以，包括 ChatGPT、文心一言、通义千问、豆包、Kimi 等。' }
  ];

  // Combine WebSite + FAQPage JSON-LD
  const combinedJsonLd = `${jsonLdWebSite()}</script><script type="application/ld+json">${jsonLdFAQPage(faqItems)}`;

  const html = htmlPage({
    title: '首页',
    description: '免费的小商家 AI Prompt 模板库，覆盖餐饮、零售、美业、维修、宠物、教育6大行业，提供客服回复、活动文案、短视频脚本等20+实用模板',
    canonical: DOMAIN + '/',
    body,
    jsonLd: combinedJsonLd
  });
  writeFileSync(join(SITE, 'index.html'), html);
  console.log('Built: index.html');
}

// --- Build Templates List Page ---
function buildTemplatesList() {
  const rows = templates.map(t => {
    const indName = industries.find(i => i.id === t.industry)?.name || '通用';
    const taskName = tasks.find(tk => tk.id === t.task)?.name || '';
    return `<tr data-industry="${t.industry}" data-task="${t.task}">
      <td><a href="/templates/${t.slug}.html">${t.title}</a></td>
      <td>${indName}</td>
      <td>${taskName}</td>
      <td>${t.description}</td>
    </tr>`;
  }).join('');

  const indOptions = industries.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
  const taskOptions = tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  const body = `
<section class="section">
  <h1>模板资料库</h1>
  <p>共 ${templates.length} 个模板，覆盖 ${industries.length} 个行业、${tasks.length} 类任务</p>
  <div class="filter-bar">
    <input type="text" id="search-input" placeholder="搜索模板..." class="search-input">
    <select id="filter-industry" class="filter-select"><option value="">全部行业</option>${indOptions}</select>
    <select id="filter-task" class="filter-select"><option value="">全部任务</option>${taskOptions}</select>
  </div>
  <table class="template-table" id="template-table">
    <thead><tr><th>模板名称</th><th>行业</th><th>任务</th><th>说明</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;

  const html = htmlPage({
    title: '模板资料库',
    description: '浏览全部 AI Prompt 模板，按行业或任务类型筛选，找到适合你的文案生成模板',
    canonical: DOMAIN + '/templates/',
    body,
    jsonLd: jsonLdCollectionPage('模板资料库', '浏览全部 AI Prompt 模板，按行业或任务类型筛选', DOMAIN + '/templates/')
  });
  writeFileSync(join(SITE, 'templates', 'index.html'), html);
  console.log('Built: templates/index.html');
}

// --- Build Template Detail Pages ---
function buildTemplateDetails() {
  templates.forEach(t => {
    const indName = industries.find(i => i.id === t.industry)?.name || '通用';
    const taskName = tasks.find(tk => tk.id === t.task)?.name || '';

    const materials = t.materialsNeeded.map(m => `<li>${m}</li>`).join('');
    const checklist = t.reviewChecklist.map(c => `<li><label><input type="checkbox"> ${c}</label></li>`).join('');
    const fields = Object.entries(t.fieldExplanations).map(([k, v]) => `<tr><td><code>{${k}}</code></td><td>${v}</td></tr>`).join('');
    const related = (t.relatedTemplates || []).map(rid => {
      const rt = templates.find(x => x.id === rid);
      return rt ? `<a href="/templates/${rt.slug}.html" class="related-link">${rt.title}</a>` : '';
    }).filter(Boolean).join('');

    const body = `
<nav class="breadcrumb">
  <a href="/">首页</a> &gt; <a href="/templates/">模板库</a> &gt; <span>${t.title}</span>
</nav>
<article class="template-detail">
  <h1>${t.title}</h1>
  <div class="template-meta">
    <span class="tag">${indName}</span>
    <span class="tag">${taskName}</span>
  </div>
  <p class="template-desc">${t.description}</p>

  <div class="info-grid">
    <div class="info-box">
      <h3>适用场景</h3>
      <p>${t.scenario}</p>
    </div>
    <div class="info-box">
      <h3>不适合</h3>
      <p>${t.notFor}</p>
    </div>
  </div>

  <section class="template-section">
    <h2>需要准备的材料</h2>
    <ul class="materials-list">${materials}</ul>
  </section>

  <section class="template-section">
    <h2>Prompt（点击复制）</h2>
    <div class="prompt-box">
      <pre class="prompt-text" id="prompt-text">${escapeHtml(t.prompt)}</pre>
      <button class="btn-copy" onclick="copyPrompt()">复制 Prompt</button>
    </div>
  </section>

  <section class="template-section">
    <h2>字段说明</h2>
    <table class="field-table">
      <thead><tr><th>字段</th><th>说明</th></tr></thead>
      <tbody>${fields}</tbody>
    </table>
  </section>

  <section class="template-section">
    <h2>输出格式</h2>
    <p>${t.outputFormat}</p>
  </section>

  <section class="template-section">
    <h2>输出示例</h2>
    <div class="example-box">
      <p>${escapeHtml(t.exampleOutput)}</p>
      <p class="example-note">以上仅为格式示例，实际输出请根据你的素材生成</p>
    </div>
  </section>

  <section class="template-section">
    <h2>发布前复核清单</h2>
    <ul class="checklist">${checklist}</ul>
  </section>

  ${related ? `<section class="template-section"><h2>相关模板</h2><div class="related-templates">${related}</div></section>` : ''}
</article>`;

    const html = htmlPage({
      title: t.title,
      description: t.description,
      canonical: `${DOMAIN}/templates/${t.slug}.html`,
      body,
      jsonLd: jsonLdHowTo(t, indName),
      ogType: 'article'
    });
    writeFileSync(join(SITE, 'templates', `${t.slug}.html`), html);
  });
  console.log(`Built: ${templates.length} template detail pages`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Build Industry Pages ---
function buildIndustryPages() {
  industries.forEach(ind => {
    const indTemplates = templates.filter(t => t.industry === ind.id);
    const cards = indTemplates.map(t => `
      <a href="/templates/${t.slug}.html" class="card template-card">
        <h3>${t.title}</h3>
        <p>${t.description}</p>
        <span class="tag">${tasks.find(tk => tk.id === t.task)?.name || ''}</span>
      </a>`).join('');

    const body = `
<nav class="breadcrumb">
  <a href="/">首页</a> &gt; <span>${ind.name}</span>
</nav>
<section class="section">
  <h1>${ind.name} - AI 模板</h1>
  <p class="section-desc">${ind.description}</p>
  <div class="card-grid">${cards}</div>
  ${indTemplates.length === 0 ? '<p>该行业模板正在建设中，敬请期待。</p>' : ''}
</section>`;

    const html = htmlPage({
      title: ind.name + ' AI 模板',
      description: `${ind.name}行业的 AI Prompt 模板集合，${ind.description}`,
      canonical: `${DOMAIN}/industries/${ind.slug}.html`,
      body,
      jsonLd: jsonLdCollectionPage(`${ind.name} AI 模板`, `${ind.name}行业的 AI Prompt 模板集合`, `${DOMAIN}/industries/${ind.slug}.html`)
    });
    writeFileSync(join(SITE, 'industries', `${ind.slug}.html`), html);
  });
  console.log(`Built: ${industries.length} industry pages`);
}

// --- Build Task Pages ---
function buildTaskPages() {
  tasks.forEach(task => {
    const taskTemplates = templates.filter(t => t.task === task.id);
    const cards = taskTemplates.map(t => `
      <a href="/templates/${t.slug}.html" class="card template-card">
        <h3>${t.title}</h3>
        <p>${t.description}</p>
        <span class="tag">${industries.find(i => i.id === t.industry)?.name || '通用'}</span>
      </a>`).join('');

    const body = `
<nav class="breadcrumb">
  <a href="/">首页</a> &gt; <span>${task.name}</span>
</nav>
<section class="section">
  <h1>${task.name} - AI 模板</h1>
  <p class="section-desc">${task.description}</p>
  <div class="card-grid">${cards}</div>
  ${taskTemplates.length === 0 ? '<p>该任务类型模板正在建设中，敬请期待。</p>' : ''}
</section>`;

    const html = htmlPage({
      title: task.name + ' AI 模板',
      description: `${task.name}相关的 AI Prompt 模板，${task.description}`,
      canonical: `${DOMAIN}/tasks/${task.slug}.html`,
      body,
      jsonLd: jsonLdCollectionPage(`${task.name} AI 模板`, `${task.name}相关的 AI Prompt 模板`, `${DOMAIN}/tasks/${task.slug}.html`)
    });
    writeFileSync(join(SITE, 'tasks', `${task.slug}.html`), html);
  });
  console.log(`Built: ${tasks.length} task pages`);
}

// --- Build Guide Pages ---
function buildGuidePages() {
  guides.forEach(guide => {
    const sections = guide.sections.map(s => `
      <section class="guide-section">
        <h2>${s.heading}</h2>
        <div class="guide-content">${s.content.split('\n').map(line => line.startsWith('Q：') || line.startsWith('A：') ? `<p class="faq-line"><strong>${line.slice(0,2)}</strong>${line.slice(2)}</p>` : `<p>${line}</p>`).join('')}</div>
      </section>`).join('');

    const body = `
<nav class="breadcrumb">
  <a href="/">首页</a> &gt; <a href="/guides/${guide.slug}.html">指南</a> &gt; <span>${guide.title}</span>
</nav>
<article class="guide-article">
  <h1>${guide.title}</h1>
  <p class="guide-desc">${guide.description}</p>
  ${sections}
</article>`;

    const html = htmlPage({
      title: guide.title,
      description: guide.description,
      canonical: `${DOMAIN}/guides/${guide.slug}.html`,
      body,
      jsonLd: jsonLdArticle(guide.title, guide.description, `${DOMAIN}/guides/${guide.slug}.html`),
      ogType: 'article'
    });
    writeFileSync(join(SITE, 'guides', `${guide.slug}.html`), html);
  });
  console.log(`Built: ${guides.length} guide pages`);
}

// --- Build Tool Pages ---
function buildToolPages() {
  // Prompt Builder
  const promptBuilderBody = `
<section class="section">
  <h1>Prompt 构造器</h1>
  <p>选择行业、任务和语气，快速生成一个基础 Prompt 框架</p>
  <div class="tool-form">
    <div class="form-group">
      <label for="pb-industry">选择行业</label>
      <select id="pb-industry">
        <option value="">请选择行业</option>
        ${industries.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="pb-task">选择任务</label>
      <select id="pb-task">
        <option value="">请选择任务类型</option>
        ${tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="pb-tone">选择语气</label>
      <select id="pb-tone">
        <option value="friendly">亲切友好</option>
        <option value="professional">专业正式</option>
        <option value="casual">轻松随意</option>
        <option value="warm">温暖贴心</option>
      </select>
    </div>
    <div class="form-group">
      <label for="pb-extra">补充要求（可选）</label>
      <textarea id="pb-extra" rows="3" placeholder="如：字数限制、特殊格式要求等"></textarea>
    </div>
    <button class="btn btn-primary" onclick="generatePrompt()">生成 Prompt</button>
  </div>
  <div class="tool-output" id="pb-output" style="display:none;">
    <h3>生成的 Prompt</h3>
    <pre class="prompt-text" id="pb-result"></pre>
    <button class="btn-copy" onclick="copyGenerated()">复制</button>
  </div>
  <p class="tool-note">本工具在浏览器本地运行，不上传任何数据。</p>
</section>`;

  writeFileSync(join(SITE, 'tools', 'prompt-builder.html'), htmlPage({
    title: 'Prompt 构造器',
    description: '选择行业、任务和语气，快速生成适合小商家的 AI Prompt 框架',
    canonical: `${DOMAIN}/tools/prompt-builder.html`,
    body: promptBuilderBody,
    jsonLd: jsonLdWebApplication('Prompt 构造器', '选择行业、任务和语气，快速生成适合小商家的 AI Prompt 框架', `${DOMAIN}/tools/prompt-builder.html`)
  }));

  // Output Checker
  const outputCheckerBody = `
<section class="section">
  <h1>AI 输出质量自检器</h1>
  <p>粘贴 AI 生成的文案，自动检查常见问题</p>
  <div class="tool-form">
    <div class="form-group">
      <label for="oc-input">粘贴 AI 生成的文案</label>
      <textarea id="oc-input" rows="8" placeholder="将 AI 生成的文案粘贴到这里..."></textarea>
    </div>
    <button class="btn btn-primary" onclick="checkOutput()">开始检查</button>
  </div>
  <div class="tool-output" id="oc-output" style="display:none;">
    <h3>检查结果</h3>
    <div id="oc-results"></div>
  </div>
  <p class="tool-note">本工具在浏览器本地运行，不上传任何数据。检查结果仅供参考，请结合实际情况判断。</p>
</section>`;

  writeFileSync(join(SITE, 'tools', 'output-checker.html'), htmlPage({
    title: 'AI 输出质量自检器',
    description: '粘贴 AI 生成的文案，自动检查绝对化用语、未填占位符、敏感承诺等常见问题',
    canonical: `${DOMAIN}/tools/output-checker.html`,
    body: outputCheckerBody,
    jsonLd: jsonLdWebApplication('AI 输出质量自检器', '粘贴 AI 生成的文案，自动检查绝对化用语、未填占位符、敏感承诺等常见问题', `${DOMAIN}/tools/output-checker.html`)
  }));

  console.log('Built: 2 tool pages');
}

// --- Build Scenario Pages ---
function buildScenarioPages() {
  scenarios.forEach(sc => {
    const dialogueHtml = sc.dialogue.map(d => {
      if (d.role === 'customer') {
        return `<div class="dialogue-item dialogue-customer">
          <div class="dialogue-role">客户</div>
          <div class="dialogue-content">${escapeHtml(d.content)}</div>
        </div>`;
      } else if (d.role === 'not_recommended') {
        return `<div class="dialogue-item dialogue-not-recommended">
          <div class="dialogue-role">${d.label}</div>
          <div class="dialogue-content">${escapeHtml(d.content)}</div>
          <div class="dialogue-reason">原因：${d.reason}</div>
        </div>`;
      } else {
        return `<div class="dialogue-item dialogue-recommended">
          <div class="dialogue-role">${d.label}</div>
          <div class="dialogue-content">${escapeHtml(d.content)}</div>
        </div>`;
      }
    }).join('');

    const body = `
<nav class="breadcrumb">
  <a href="/">首页</a> &gt; <span>对话场景</span> &gt; <span>${sc.title}</span>
</nav>
<article class="guide-article">
  <h1>${sc.title}</h1>
  <p class="guide-desc">${sc.description}</p>
  <div class="dialogue-container">
    ${dialogueHtml}
  </div>
  <p class="tool-note">以上为参考话术框架，请根据实际情况和店铺政策调整具体内容。</p>
</article>`;

    const html = htmlPage({
      title: sc.title,
      description: sc.description,
      canonical: `${DOMAIN}/scenarios/${sc.slug}.html`,
      body,
      jsonLd: jsonLdArticle(sc.title, sc.description, `${DOMAIN}/scenarios/${sc.slug}.html`),
      ogType: 'article'
    });
    writeFileSync(join(SITE, 'scenarios', `${sc.slug}.html`), html);
  });
  console.log(`Built: ${scenarios.length} scenario pages`);
}

// --- Build Reply Filter Tool Page ---
function buildReplyFilterPage() {
  const body = `
<section class="section">
  <h1>客服回复筛选器</h1>
  <p>选择客服场景类型，获取对应的回复框架和参考话术</p>
  <div class="tool-form">
    <div class="form-group">
      <label for="rf-scenario">选择场景类型</label>
      <select id="rf-scenario">
        <option value="">请选择场景</option>
        <option value="complaint">投诉处理</option>
        <option value="inquiry">咨询回复</option>
        <option value="refund">退款协商</option>
        <option value="praise">好评回复</option>
      </select>
    </div>
    <button class="btn btn-primary" onclick="filterReply()">获取回复框架</button>
  </div>
  <div class="tool-output" id="rf-output" style="display:none;">
    <div id="rf-result"></div>
  </div>
  <div style="margin-top:2rem">
    <h2>对话场景参考</h2>
    <p>以下是完整的多轮对话场景示例，包含推荐回复和不建议的回复：</p>
    <div class="card-grid">
      ${scenarios.map(sc => `<a href="/scenarios/${sc.slug}.html" class="card"><h3>${sc.title}</h3><p>${sc.description}</p></a>`).join('')}
    </div>
  </div>
  <p class="tool-note">本工具在浏览器本地运行，不上传任何数据。</p>
</section>`;

  writeFileSync(join(SITE, 'tools', 'reply-filter.html'), htmlPage({
    title: '客服回复筛选器',
    description: '选择客服场景类型，获取对应的回复框架和参考话术',
    canonical: `${DOMAIN}/tools/reply-filter.html`,
    body,
    jsonLd: jsonLdWebApplication('客服回复筛选器', '选择客服场景类型，获取对应的回复框架和参考话术', `${DOMAIN}/tools/reply-filter.html`)
  }));
  console.log('Built: reply-filter tool page');
}

// --- Build Trust Pages ---
function buildTrustPages() {
  const pages = [
    {
      slug: 'about',
      title: '关于我们',
      description: '了解小商家 AI 工作流与模板库的创建初衷和服务理念',
      content: `<h1>关于我们</h1>
<p>${SITE_NAME}是一个免费的 AI Prompt 模板资源站，专为小商家打造。</p>
<p>我们的目标是帮助没有专业文案团队的小商家，利用 AI 工具快速生成日常经营所需的各类文案内容，节省时间和成本。</p>
<h2>我们提供什么</h2>
<ul>
<li>覆盖6大行业的实用 Prompt 模板</li>
<li>每个模板附带使用说明和复核清单</li>
<li>免费的在线工具（Prompt 构造器、内容自检器）</li>
<li>使用指南和平台规则提醒</li>
</ul>
<h2>我们的原则</h2>
<ul>
<li>所有模板免费使用，不设付费墙</li>
<li>不收集用户数据，工具本地运行</li>
<li>不承诺商业效果，只提供工具和方法</li>
<li>持续更新，根据用户反馈优化模板</li>
</ul>
<p>如有建议或合作意向，欢迎联系：${EMAIL}</p>`
    },
    {
      slug: 'disclaimer',
      title: '免责声明',
      description: '小商家 AI 工作流与模板库的免责声明和使用须知',
      content: `<h1>免责声明</h1>
<p>使用本站提供的模板和工具前，请仔细阅读以下声明：</p>
<h2>内容生成责任</h2>
<p>本站提供的 Prompt 模板仅为辅助工具。AI 生成的内容由用户自行审核和使用，本站不对 AI 输出内容的准确性、合规性承担责任。</p>
<h2>商业效果声明</h2>
<p>本站不承诺使用模板后能带来任何特定的商业效果，包括但不限于成交量提升、粉丝增长、收益增加等。模板仅帮助提高文案撰写效率。</p>
<h2>合规责任</h2>
<p>用户有责任确保发布的内容符合相关法律法规和平台规则。本站提供的复核清单仅为参考，不构成法律建议。</p>
<h2>第三方工具</h2>
<p>本站模板需配合第三方 AI 工具使用。本站与任何 AI 工具提供商无关联关系，不对第三方工具的可用性和输出质量负责。</p>`
    },
    {
      slug: 'privacy',
      title: '隐私政策',
      description: '小商家 AI 工作流与模板库的隐私政策和数据处理说明',
      content: `<h1>隐私政策</h1>
<p>最后更新：2024年1月</p>
<h2>数据收集</h2>
<p>本站不收集、存储或传输任何用户个人数据。所有在线工具（Prompt 构造器、内容自检器）均在用户浏览器本地运行，不向服务器发送任何输入内容。</p>
<h2>Cookies</h2>
<p>本站不使用 Cookies 追踪用户行为。</p>
<h2>第三方服务</h2>
<p>本站可能使用基础的网站访问统计服务，仅收集匿名的访问量数据，不涉及个人身份信息。</p>
<h2>联系方式</h2>
<p>如对隐私政策有疑问，请联系：${EMAIL}</p>`
    },
    {
      slug: 'terms',
      title: '使用条款',
      description: '小商家 AI 工作流与模板库的使用条款和服务协议',
      content: `<h1>使用条款</h1>
<p>使用本站即表示您同意以下条款：</p>
<h2>模板使用</h2>
<p>本站所有模板免费提供，用户可自由使用、修改模板内容用于商业经营。禁止将本站模板批量打包出售或用于搭建同类模板网站。</p>
<h2>内容责任</h2>
<p>用户使用模板生成的内容，其发布和使用的法律责任由用户自行承担。请确保发布内容符合《广告法》等相关法规。</p>
<h2>知识产权</h2>
<p>本站的网站设计、原创文案和工具代码受版权保护。模板中的 Prompt 文本用户可自由使用和修改。</p>
<h2>服务变更</h2>
<p>本站保留随时修改、更新或停止服务的权利，恕不另行通知。</p>
<h2>联系方式</h2>
<p>如有问题，请联系：${EMAIL}</p>`
    },
    {
      slug: 'contact',
      title: '联系我们',
      description: '联系小商家 AI 工作流与模板库',
      content: `<h1>联系我们</h1>
<p>如果你有以下问题，欢迎通过邮件联系：</p>
<ul>
<li>模板内容有误或过期</li>
<li>发现页面错误或链接失效</li>
<li>希望增加某个行业或任务的模板</li>
<li>功能建议或使用反馈</li>
<li>合作咨询</li>
</ul>
<p>联系邮箱：<strong>${EMAIL}</strong></p>
<h2>请不要发送</h2>
<p>为保护你的安全，请不要在邮件中包含：</p>
<ul>
<li>客户身份证号、完整合同或支付凭证</li>
<li>店铺后台密码或 API 密钥</li>
<li>客户隐私信息或财务数据</li>
</ul>
<h2>反馈处理</h2>
<p>我们会在收到邮件后尽快处理。模板修正通常在 3-5 个工作日内更新。</p>`
    }
  ];

  pages.forEach(page => {
    const body = `<article class="page-article">${page.content}</article>`;
    const html = htmlPage({
      title: page.title,
      description: page.description,
      canonical: `${DOMAIN}/pages/${page.slug}.html`,
      body,
      jsonLd: jsonLdArticle(page.title, page.description, `${DOMAIN}/pages/${page.slug}.html`)
    });
    writeFileSync(join(SITE, 'pages', `${page.slug}.html`), html);
  });
  console.log('Built: 5 trust pages');
}

// --- Build Sitemap and Robots ---
function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/templates/', priority: '0.9' },
    ...templates.map(t => ({ loc: `/templates/${t.slug}.html`, priority: '0.6' })),
    ...industries.map(i => ({ loc: `/industries/${i.slug}.html`, priority: '0.7' })),
    ...tasks.map(t => ({ loc: `/tasks/${t.slug}.html`, priority: '0.7' })),
    ...guides.map(g => ({ loc: `/guides/${g.slug}.html`, priority: '0.6' })),
    ...scenarios.map(s => ({ loc: `/scenarios/${s.slug}.html`, priority: '0.5' })),
    { loc: '/tools/prompt-builder.html', priority: '0.8' },
    { loc: '/tools/output-checker.html', priority: '0.8' },
    { loc: '/tools/reply-filter.html', priority: '0.8' },
    { loc: '/pages/about.html', priority: '0.4' },
    { loc: '/pages/contact.html', priority: '0.4' },
    { loc: '/pages/disclaimer.html', priority: '0.4' },
    { loc: '/pages/privacy.html', priority: '0.4' },
    { loc: '/pages/terms.html', priority: '0.4' }
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${DOMAIN}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${parseFloat(u.priority) >= 0.8 ? 'weekly' : 'monthly'}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  writeFileSync(join(SITE, 'sitemap.xml'), sitemap);

  const robots = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml`;
  writeFileSync(join(SITE, 'robots.txt'), robots);
  console.log('Built: sitemap.xml, robots.txt');
}

// --- Run All ---
console.log('Building site...');
buildIndex();
buildTemplatesList();
buildTemplateDetails();
buildIndustryPages();
buildTaskPages();
buildGuidePages();
buildToolPages();
buildScenarioPages();
buildReplyFilterPage();
buildTrustPages();
buildSitemap();
console.log('Build complete!');

