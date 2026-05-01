/**
 * Popup Controller — Website Study Analyzer
 * Orchestrates the analysis, renders results, and handles user actions.
 */

(function () {
  'use strict';

  // --- DOM References ---
  const $status = document.getElementById('status');
  const $results = document.getElementById('results');
  const $error = document.getElementById('error');
  const $errorText = document.getElementById('error-text');
  const $btnRetry = document.getElementById('btn-retry');
  const $btnExport = document.getElementById('btn-export');
  const $btnClone = document.getElementById('btn-clone');

  const $pageTitle = document.getElementById('page-title');
  const $pageHost = document.getElementById('page-host');
  const $elementCount = document.getElementById('element-count');
  const $colorList = document.getElementById('color-list');
  const $colorCount = document.getElementById('color-count');
  const $fontList = document.getElementById('font-list');
  const $fontCount = document.getElementById('font-count');
  const $spacingList = document.getElementById('spacing-list');
  const $spacingCount = document.getElementById('spacing-count');
  const $domPreview = document.getElementById('dom-preview');

  // --- State ---
  let analysisData = null;

  // --- Initialization ---
  function init() {
    $btnRetry.addEventListener('click', runAnalysis);
    $btnExport.addEventListener('click', exportJSON);
    $btnClone.addEventListener('click', cloneWebsite);
    runAnalysis();
  }

  // --- Analysis Flow ---
  async function runAnalysis() {
    showStatus();

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) {
        throw new Error('No active tab found.');
      }

      const tab = tabs[0];

      // Validate tab is a regular webpage
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze browser system pages. Please open a regular website.');
      }

      // Ensure content script is injected
      await ensureContentScript(tab.id);

      // Send analysis request
      const response = await sendMessage(tab.id, { action: 'analyze' });

      if (!response) {
        throw new Error('No response from content script. The page may restrict script injection.');
      }

      if (!response.success) {
        throw new Error(response.error || 'Analysis failed.');
      }

      analysisData = response.data;
      renderResults(analysisData);
      showResults();
    } catch (err) {
      console.error('[Website Study Analyzer]', err);
      showError(err?.message || 'An unexpected error occurred.');
    }
  }

  function ensureContentScript(tabId) {
    return new Promise((resolve, reject) => {
      // Try pinging the content script first
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded — inject it
          chrome.scripting
            .executeScript({
              target: { tabId },
              files: ['content.js'],
            })
            .then(() => {
              // Small delay to let the script initialize
              setTimeout(resolve, 100);
            })
            .catch(reject);
        } else {
          resolve();
        }
      });
    });
  }

  function sendMessage(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        resolve(response);
      });
    });
  }

  // --- Rendering ---
  function renderResults(data) {
    if (!data) return;

    // Meta
    $pageTitle.textContent = data.meta?.title || 'Untitled';
    $pageHost.textContent = data.meta?.hostname || '—';
    $elementCount.textContent = String(data.meta?.totalElements ?? '—');

    // Colors
    renderColors(data.designTokens?.colors || []);

    // Fonts
    renderFonts(data.designTokens?.fonts || []);

    // Spacing
    renderSpacing(data.designTokens?.spacing || []);

    // DOM Tree
    renderDOMTree(data.domTree || []);
  }

  function renderColors(colors) {
    $colorCount.textContent = String(colors.length);
    $colorList.innerHTML = '';

    if (colors.length === 0) {
      $colorList.innerHTML = '<p class="info-value" style="grid-column: 1 / -1; padding: 8px 0;">No colors detected.</p>';
      return;
    }

    colors.forEach((c) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';

      const box = document.createElement('div');
      box.className = 'color-box';
      box.style.backgroundColor = c.value;
      box.title = `${c.value} (${c.type})`;

      const hex = document.createElement('span');
      hex.className = 'color-hex';
      hex.textContent = c.value;

      swatch.appendChild(box);
      swatch.appendChild(hex);
      $colorList.appendChild(swatch);
    });
  }

  function renderFonts(fonts) {
    $fontCount.textContent = String(fonts.length);
    $fontList.innerHTML = '';

    if (fonts.length === 0) {
      $fontList.innerHTML = '<p class="info-value" style="padding: 8px 0;">No fonts detected.</p>';
      return;
    }

    fonts.forEach((f) => {
      const item = document.createElement('div');
      item.className = 'font-item';

      const sample = document.createElement('span');
      sample.className = 'font-sample';
      sample.textContent = 'Ag';
      sample.style.fontFamily = f.family;

      const details = document.createElement('div');
      details.className = 'font-details';

      const family = document.createElement('div');
      family.className = 'font-family';
      family.textContent = f.family;

      const meta = document.createElement('div');
      meta.className = 'font-meta';
      meta.textContent = `${f.size} / ${f.weight}`;

      const count = document.createElement('span');
      count.className = 'font-count';
      count.textContent = `×${f.count}`;

      details.appendChild(family);
      details.appendChild(meta);
      item.appendChild(sample);
      item.appendChild(details);
      item.appendChild(count);
      $fontList.appendChild(item);
    });
  }

  function renderSpacing(spacing) {
    $spacingCount.textContent = String(spacing.length);
    $spacingList.innerHTML = '';

    if (spacing.length === 0) {
      $spacingList.innerHTML = '<p class="info-value" style="padding: 8px 0;">No spacing patterns detected.</p>';
      return;
    }

    spacing.forEach((s) => {
      const tag = document.createElement('span');
      tag.className = 'spacing-tag';
      tag.textContent = s;
      $spacingList.appendChild(tag);
    });
  }

  function renderDOMTree(elements) {
    $domPreview.innerHTML = '';

    if (!elements || elements.length === 0) {
      $domPreview.textContent = 'No visible DOM elements found.';
      return;
    }

    elements.forEach((el) => {
      $domPreview.appendChild(buildDOMNode(el));
    });
  }

  function buildDOMNode(node) {
    const container = document.createElement('div');
    container.className = 'dom-node';

    // Tag line
    const tagLine = document.createElement('div');

    const tagSpan = document.createElement('span');
    tagSpan.className = 'dom-tag';
    tagSpan.textContent = node.tag;

    tagLine.appendChild(tagSpan);

    // Attributes
    if (node.id) {
      const idAttr = document.createElement('span');
      idAttr.className = 'dom-attr';
      idAttr.textContent = ` #${node.id}`;
      tagLine.appendChild(idAttr);
    }

    if (node.classes && node.classes.length) {
      const clsAttr = document.createElement('span');
      clsAttr.className = 'dom-attr';
      clsAttr.textContent = ` .${node.classes.slice(0, 3).join('.')}`;
      if (node.classes.length > 3) {
        clsAttr.textContent += ` (+${node.classes.length - 3})`;
      }
      tagLine.appendChild(clsAttr);
    }

    // Text preview
    if (node.text) {
      const textSpan = document.createElement('span');
      textSpan.className = 'dom-text';
      textSpan.textContent = ` "${node.text}"`;
      tagLine.appendChild(textSpan);
    }

    // Bounds
    if (node.bounds) {
      const boundsSpan = document.createElement('span');
      boundsSpan.className = 'dom-text';
      boundsSpan.style.marginLeft = '8px';
      boundsSpan.textContent = ` [${node.bounds.width}×${node.bounds.height}]`;
      tagLine.appendChild(boundsSpan);
    }

    container.appendChild(tagLine);

    // Children
    if (node.children && node.children.length) {
      node.children.forEach((child) => {
        container.appendChild(buildDOMNode(child));
      });
    }

    return container;
  }

  // --- Export JSON ---
  function exportJSON() {
    if (!analysisData) return;

    const blob = new Blob([JSON.stringify(analysisData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `website-analysis-${analysisData.meta?.hostname || 'page'}-${timestamp}.json`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true,
    });

    URL.revokeObjectURL(url);
  }

  // --- Clone Website ---
  async function cloneWebsite() {
    if (!analysisData) return;

    const originalHTML = $btnClone.innerHTML;
    $btnClone.disabled = true;
    $btnClone.style.opacity = '0.7';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) {
        throw new Error('No active tab found.');
      }

      const tab = tabs[0];
      await ensureContentScript(tab.id);

      const response = await sendMessage(tab.id, { action: 'clonePage' });
      if (!response?.success) {
        throw new Error(response?.error || 'Could not clone this page.');
      }

      const blob = new Blob([response.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `website-clone-${analysisData.meta?.hostname || 'page'}-${timestamp}.html`;

      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true,
      });

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Website Study Analyzer]', err);
      showError(err?.message || 'Could not clone this website.');
    } finally {
      $btnClone.disabled = false;
      $btnClone.style.opacity = '';
      $btnClone.innerHTML = originalHTML;
    }
  }

  function buildMockupHTML(data) {
    const meta = data.meta || {};
    const colors = (data.designTokens?.colors || []).slice(0, 12);
    const fonts = (data.designTokens?.fonts || []).slice(0, 6);
    const spacing = (data.designTokens?.spacing || []).slice(0, 6);

    // Extract unique color values for the palette
    const uniqueColors = [...new Set(colors.map((c) => c.value))];

    // Build color CSS variables
    const colorVars = uniqueColors
      .map((c, i) => `  --color-${i + 1}: ${c};`)
      .join('\n');

    const colorClasses = uniqueColors
      .map((c, i) => `.bg-${i + 1} { background-color: var(--color-${i + 1}); }`)
      .join('\n');

    // Build font CSS variables
    const fontVars = fonts
      .map((f, i) => `  --font-${i + 1}: ${f.family};`)
      .join('\n');

    // Build spacing CSS variables
    const spacingVars = spacing
      .map((s, i) => `  --space-${i + 1}: ${s};`)
      .join('\n');

    // Generate layout blocks from DOM tree
    const layoutBlocks = buildMockupBlocks(data.domTree || [], 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Educational Mockup — ${escapeHTML(meta.title || 'Untitled')}</title>
  <style>
    :root {
${colorVars}
${fontVars}
${spacingVars}
      --font-body: ${fonts[0]?.family || 'system-ui, sans-serif'};
      --bg-page: ${uniqueColors.find((c) => colors.find((x) => x.value === c && x.type === 'background')) || '#fafafa'};
      --text-main: ${uniqueColors.find((c) => colors.find((x) => x.value === c && x.type === 'text')) || '#111827'};
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-body);
      background: var(--bg-page);
      color: var(--text-main);
      line-height: 1.6;
      min-height: 100vh;
    }

${colorClasses}

    .placeholder-img {
      background: linear-gradient(135deg, #e5e7eb 25%, #d1d5db 25%, #d1d5db 50%, #e5e7eb 50%, #e5e7eb 75%, #d1d5db 75%);
      background-size: 20px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 12px;
      border-radius: 4px;
    }

    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

    .meta-info {
      background: var(--surface, #fff);
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .meta-info h1 { font-size: 18px; margin-bottom: 8px; }

    .meta-info p { font-size: 13px; color: #6b7280; }

    .palette-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

    .palette-swatch { width: 48px; height: 48px; border-radius: 6px; border: 1px solid #e5e7eb; }

    .layout-block { border: 1px dashed #cbd5e1; padding: 16px; margin: 8px 0; border-radius: 6px; background: rgba(255,255,255,0.5); }

    .layout-block > .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 8px; }

    .placeholder-text { background: #e5e7eb; height: 1em; border-radius: 3px; display: inline-block; margin: 2px 0; }

    .placeholder-text.short { width: 40%; }

    .placeholder-text.medium { width: 70%; }

    .placeholder-text.long { width: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Study Info Header -->
    <div class="meta-info">
      <h1>Educational Mockup</h1>
      <p><strong>Original:</strong> ${escapeHTML(meta.title || 'Untitled')}</p>
      <p><strong>Host:</strong> ${escapeHTML(meta.hostname || '—')}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      <p style="margin-top:8px; color:#9ca3af; font-size:12px;">
        This is a simplified structural approximation for educational study only.
        Not a pixel-perfect copy. All content is placeholder text.
      </p>
      <div class="palette-strip">
        ${uniqueColors.map((c) => `<div class="palette-swatch" style="background:${c};" title="${c}"></div>`).join('\n        ')}
      </div>
    </div>

    <!-- Approximated Layout -->
    ${layoutBlocks}
  </div>
</body>
</html>`;
  }

  function buildMockupBlocks(elements, depth) {
    if (!elements || !elements.length || depth > 4) return '';

    return elements
      .map((el) => {
        const tagLabel = el.tag + (el.classes?.length ? `.${el.classes[0]}` : '');
        const hasText = !!el.text;
        const hasChildren = el.children && el.children.length > 0;

        let content = '';

        if (hasText) {
          // Show placeholder text lines
          const wordCount = el.text.split(/\s+/).length;
          const lines = Math.min(Math.ceil(wordCount / 6), 4);
          content = Array.from({ length: lines }, (_, i) => {
            const width = i % 3 === 0 ? 'short' : i % 3 === 1 ? 'medium' : 'long';
            return `<span class="placeholder-text ${width}"></span>`;
          }).join('<br>');
          content = `<p>${content}</p>`;
        }

        if (hasChildren) {
          content += buildMockupBlocks(el.children, depth + 1);
        }

        // If leaf with no text, show a placeholder indicator
        if (!content) {
          content = '<span class="placeholder-text medium"></span>';
        }

        // Determine background from element's style
        const bgColor = el.style?.backgroundColor;
        const bgStyle = bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)'
          ? `background: ${bgColor};`
          : '';

        return `
    <div class="layout-block" style="${bgStyle}">
      <div class="label">&lt;${tagLabel}&gt; ${el.bounds ? `[${el.bounds.width}×${el.bounds.height}]` : ''}</div>
      ${content}
    </div>`;
      })
      .join('\n');
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- View State Management ---
  function showStatus() {
    $status.classList.remove('hidden');
    $results.classList.add('hidden');
    $error.classList.add('hidden');
  }

  function showResults() {
    $status.classList.add('hidden');
    $results.classList.remove('hidden');
    $error.classList.add('hidden');
  }

  function showError(message) {
    $status.classList.add('hidden');
    $results.classList.add('hidden');
    $error.classList.remove('hidden');
    $errorText.textContent = message;
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
