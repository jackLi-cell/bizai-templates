/* === 小商家 AI 工作流与模板库 - 前端交互 === */

// --- Copy Prompt (template detail pages) ---
function copyPrompt() {
  const el = document.getElementById('prompt-text');
  if (!el) return;
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement.querySelector('.btn-copy');
    if (btn) {
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '复制 Prompt'; btn.classList.remove('copied'); }, 2000);
    }
  }).catch(() => {
    fallbackCopy(text);
  });
}

function copyGenerated() {
  const el = document.getElementById('pb-result');
  if (!el) return;
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement.querySelector('.btn-copy');
    if (btn) {
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 2000);
    }
  }).catch(() => {
    fallbackCopy(text);
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// --- Search & Filter (templates list page) ---
(function() {
  const searchInput = document.getElementById('search-input');
  const filterIndustry = document.getElementById('filter-industry');
  const filterTask = document.getElementById('filter-task');
  const table = document.getElementById('template-table');

  if (!searchInput || !table) return;

  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const industry = filterIndustry ? filterIndustry.value : '';
    const task = filterTask ? filterTask.value : '';
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowIndustry = row.getAttribute('data-industry');
      const rowTask = row.getAttribute('data-task');

      const matchSearch = !query || text.includes(query);
      const matchIndustry = !industry || rowIndustry === industry;
      const matchTask = !task || rowTask === task;

      row.style.display = (matchSearch && matchIndustry && matchTask) ? '' : 'none';
    });
  }

  searchInput.addEventListener('input', applyFilters);
  if (filterIndustry) filterIndustry.addEventListener('change', applyFilters);
  if (filterTask) filterTask.addEventListener('change', applyFilters);
})();

// --- Prompt Builder ---
function generatePrompt() {
  const industry = document.getElementById('pb-industry');
  const task = document.getElementById('pb-task');
  const tone = document.getElementById('pb-tone');
  const extra = document.getElementById('pb-extra');
  const output = document.getElementById('pb-output');
  const result = document.getElementById('pb-result');

  if (!industry || !task || !tone || !output || !result) return;

  const indText = industry.options[industry.selectedIndex]?.text || '';
  const taskText = task.options[task.selectedIndex]?.text || '';
  const toneMap = {
    'friendly': '亲切友好',
    'professional': '专业正式',
    'casual': '轻松随意',
    'warm': '温暖贴心'
  };
  const toneText = toneMap[tone.value] || '亲切友好';

  if (!industry.value || !task.value) {
    alert('请选择行业和任务类型');
    return;
  }

  let prompt = `你是一位${indText}行业的${taskText}助手。请根据以下信息生成内容。\n\n`;
  prompt += `语气要求：${toneText}\n\n`;
  prompt += `请用户提供以下信息后开始生成：\n`;
  prompt += `1. 具体需求描述：{请描述你的具体需求}\n`;
  prompt += `2. 关键信息：{列出需要包含的关键信息}\n`;
  prompt += `3. 字数要求：{期望的字数范围}\n\n`;
  prompt += `生成要求：\n`;
  prompt += `- 语气${toneText}，符合${indText}行业特点\n`;
  prompt += `- 不使用绝对化用语（如「最好」「第一」「绝对」）\n`;
  prompt += `- 不做虚假承诺\n`;
  prompt += `- 内容真实可信，贴近实际经营场景`;

  if (extra && extra.value.trim()) {
    prompt += `\n- ${extra.value.trim()}`;
  }

  result.textContent = prompt;
  output.style.display = 'block';
  output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- AI Output Quality Checker ---
function checkOutput() {
  const input = document.getElementById('oc-input');
  const output = document.getElementById('oc-output');
  const results = document.getElementById('oc-results');

  if (!input || !output || !results) return;

  const text = input.value.trim();
  if (!text) {
    alert('请先粘贴需要检查的文案');
    return;
  }

  const checks = [];

  // Check 1: Absolute terms
  const absoluteTerms = ['最好', '最佳', '第一', '顶级', '绝对', '100%', '最优', '最强', '最大', '最小', '最高', '最低', '唯一', '首选', '极致', '无敌', '史上最'];
  const foundAbsolute = absoluteTerms.filter(term => text.includes(term));
  if (foundAbsolute.length > 0) {
    checks.push({ status: 'fail', message: `发现绝对化用语：「${foundAbsolute.join('」「')}」，建议修改以符合广告法要求` });
  } else {
    checks.push({ status: 'pass', message: '未发现绝对化用语' });
  }

  // Check 2: Unfilled placeholders
  const placeholderPattern = /\{[^}]+\}/g;
  const foundPlaceholders = text.match(placeholderPattern);
  if (foundPlaceholders) {
    checks.push({ status: 'fail', message: `发现未替换的占位符：${foundPlaceholders.join('、')}，请填入实际信息` });
  } else {
    checks.push({ status: 'pass', message: '未发现未替换的占位符' });
  }

  // Check 3: Sensitive promises
  const promiseTerms = ['保证', '承诺', '一定', '必定', '肯定能', '保你', '包你', '稳赚', '躺赚', '日入', '月入', '年入', '保证效果', '无效退款', '签约保障'];
  const foundPromises = promiseTerms.filter(term => text.includes(term));
  if (foundPromises.length > 0) {
    checks.push({ status: 'warn', message: `发现可能的敏感承诺：「${foundPromises.join('」「')}」，请确认是否合规` });
  } else {
    checks.push({ status: 'pass', message: '未发现敏感承诺用语' });
  }

  // Check 4: Contact info check
  const hasPhone = /1[3-9]\d{9}/.test(text) || /\d{3,4}-\d{7,8}/.test(text);
  const hasWechat = text.includes('微信') || text.includes('wx');
  if (hasPhone || hasWechat) {
    checks.push({ status: 'warn', message: '文案中包含联系方式，请确认信息准确且为最新' });
  }

  // Check 5: Length check
  const charCount = text.length;
  if (charCount < 20) {
    checks.push({ status: 'warn', message: `文案较短（${charCount}字），可能信息不够完整` });
  } else if (charCount > 500) {
    checks.push({ status: 'warn', message: `文案较长（${charCount}字），建议检查是否适合目标发布平台` });
  } else {
    checks.push({ status: 'pass', message: `文案长度适中（${charCount}字）` });
  }

  // Check 6: Price format
  const pricePattern = /\d+(\.\d+)?元/;
  if (pricePattern.test(text)) {
    checks.push({ status: 'warn', message: '文案中包含价格信息，请务必核实金额准确' });
  }

  // Render results
  const icons = { pass: '✓', warn: '!', fail: '✗' };
  results.innerHTML = checks.map(c => `
    <div class="check-item">
      <span class="check-icon check-${c.status}">${icons[c.status]}</span>
      <span>${c.message}</span>
    </div>
  `).join('');

  output.style.display = 'block';
  output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- Customer Service Reply Filter ---
function filterReply() {
  const scenario = document.getElementById('rf-scenario');
  const output = document.getElementById('rf-output');
  const result = document.getElementById('rf-result');

  if (!scenario || !output || !result) return;

  const val = scenario.value;
  if (!val) {
    alert('请选择场景类型');
    return;
  }

  const frameworks = {
    'complaint': {
      title: '投诉处理回复框架',
      steps: [
        '1. 表达歉意：「很抱歉给您带来不好的体验」',
        '2. 确认问题：复述客户反馈的具体问题',
        '3. 说明原因：简要说明已知原因（不推卸）',
        '4. 给出方案：提供1-2个具体解决方案',
        '5. 后续跟进：说明处理时间和跟进方式'
      ],
      example: '您好，很抱歉这次体验没有达到您的期望。关于您提到的[问题]，我们已经核实了情况。目前可以为您提供[方案A]或[方案B]，您看哪个方便？我会在[时间]内跟进处理结果。'
    },
    'inquiry': {
      title: '咨询回复框架',
      steps: [
        '1. 问候：简短友好的开头',
        '2. 直接回答：先回答客户的核心问题',
        '3. 补充信息：提供相关的有用信息',
        '4. 引导下一步：告知客户接下来可以做什么',
        '5. 结束语：友好收尾，表示随时可以再问'
      ],
      example: '您好～关于您问的[问题]，[直接回答]。另外补充一下，[相关信息]。如果需要[下一步动作]，随时告诉我哦。'
    },
    'refund': {
      title: '退款处理回复框架',
      steps: [
        '1. 表示理解：理解客户的退款诉求',
        '2. 确认信息：核实订单和退款原因',
        '3. 说明政策：简要说明退款政策',
        '4. 给出方案：退款金额、方式、时间',
        '5. 操作指引：告知客户需要配合什么'
      ],
      example: '理解您的情况。确认了您的订单[订单号]，根据我们的售后政策，支持[退款方式]。退款[金额]预计[时间]到账。需要您[配合事项]，我这边马上处理。'
    },
    'praise': {
      title: '好评回复框架',
      steps: [
        '1. 真诚感谢：感谢客户的认可',
        '2. 具体回应：针对客户提到的点回应',
        '3. 适度推荐：自然推荐相关产品/服务',
        '4. 欢迎再来：表达期待'
      ],
      example: '感谢您的好评和认可～很高兴[具体点]让您满意。下次来可以试试我们的[推荐]，相信您也会喜欢。期待再次为您服务！'
    }
  };

  const fw = frameworks[val];
  if (!fw) return;

  let html = `<h3>${fw.title}</h3>`;
  html += '<div style="margin:1rem 0"><strong>回复步骤：</strong></div>';
  html += '<ul style="margin-bottom:1rem">';
  fw.steps.forEach(s => { html += `<li>${s}</li>`; });
  html += '</ul>';
  html += '<div style="margin:1rem 0"><strong>参考模板：</strong></div>';
  html += `<div class="prompt-box"><div class="prompt-text">${fw.example}</div></div>`;
  html += '<p class="tool-note">以上为通用框架，请根据实际情况调整内容和语气。</p>';

  result.innerHTML = html;
  output.style.display = 'block';
  output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
