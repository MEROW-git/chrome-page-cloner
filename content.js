/**
 * Content Script — Website Study Analyzer
 * Runs inside the page context to extract simplified DOM and style data.
 * All data stays local. Nothing is transmitted externally.
 */

(function () {
  'use strict';

  // --- Configuration ---
  const MAX_DEPTH = 12;
  const MAX_ELEMENTS = 500;
  const TEXT_PREVIEW_LENGTH = 80;
  const EXCLUDED_TAGS = new Set([
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    'video', 'audio', 'source', 'track', 'embed', 'object',
    'param', 'link', 'meta', 'base', 'head', 'template',
  ]);

  const STYLE_PROPS = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'color',
    'backgroundColor',
    'margin',
    'padding',
    'display',
    'position',
    'borderRadius',
    'boxShadow',
  ];

  const CLONE_INLINE_PROPS = [
    'accentColor', 'alignContent', 'alignItems', 'alignSelf', 'backgroundAttachment',
    'backgroundClip', 'backgroundColor', 'backgroundImage', 'backgroundOrigin',
    'backgroundPosition', 'backgroundRepeat', 'backgroundSize', 'borderBottomColor',
    'borderBottomLeftRadius', 'borderBottomRightRadius', 'borderBottomStyle',
    'borderBottomWidth', 'borderCollapse', 'borderLeftColor', 'borderLeftStyle',
    'borderLeftWidth', 'borderRightColor', 'borderRightStyle', 'borderRightWidth',
    'borderSpacing', 'borderTopColor', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderTopStyle', 'borderTopWidth', 'boxShadow', 'boxSizing', 'clear', 'color',
    'columnGap', 'display', 'flexBasis', 'flexDirection', 'flexGrow', 'flexShrink',
    'flexWrap', 'float', 'fontFamily', 'fontSize', 'fontStretch', 'fontStyle',
    'fontVariant', 'fontWeight', 'gap', 'gridAutoColumns', 'gridAutoFlow',
    'gridAutoRows', 'gridColumnEnd', 'gridColumnStart', 'gridRowEnd', 'gridRowStart',
    'gridTemplateColumns', 'gridTemplateRows', 'height', 'justifyContent',
    'justifyItems', 'justifySelf', 'letterSpacing', 'lineHeight', 'listStylePosition',
    'listStyleType', 'marginBottom', 'marginLeft', 'marginRight', 'marginTop',
    'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'objectFit', 'objectPosition',
    'opacity', 'overflow', 'overflowX', 'overflowY', 'paddingBottom', 'paddingLeft',
    'paddingRight', 'paddingTop', 'position', 'rowGap', 'tableLayout', 'textAlign',
    'textDecorationColor', 'textDecorationLine', 'textDecorationStyle', 'textIndent',
    'textOverflow', 'textTransform', 'transform', 'transformOrigin', 'verticalAlign',
    'visibility', 'whiteSpace', 'width', 'wordBreak', 'wordSpacing', 'zIndex',
  ];

  // --- Utility Functions ---

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const style = getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    return true;
  }

  function sanitizeText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, TEXT_PREVIEW_LENGTH);
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return rgb;
    return '#' + [match[1], match[2], match[3]]
      .map((x) => {
        const hex = parseInt(x, 10).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');
  }

  function isMeaningfulColor(color) {
    if (!color) return false;
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return false;
    return true;
  }

  // --- Core Extraction ---

  function extractStyle(el) {
    const computed = getComputedStyle(el);
    const style = {};

    STYLE_PROPS.forEach((prop) => {
      let value = computed[prop];
      // Normalize color values to hex for consistency
      if (prop === 'color' || prop === 'backgroundColor') {
        value = rgbToHex(value);
      }
      style[prop] = value;
    });

    return style;
  }

  function getBoundingBox(el) {
    try {
      const rect = el.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      };
    } catch (e) {
      return { width: 0, height: 0, top: 0, left: 0 };
    }
  }

  function traverse(el, depth = 0, elementCount = { value: 0 }) {
    // Hard limits
    if (depth > MAX_DEPTH || elementCount.value >= MAX_ELEMENTS) {
      return null;
    }

    // Skip non-element nodes and excluded tags
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = el.tagName.toLowerCase();
    if (EXCLUDED_TAGS.has(tag)) return null;

    // Skip hidden elements
    if (!isVisible(el)) return null;

    elementCount.value++;

    const rect = getBoundingBox(el);

    // Skip zero-size decorative containers unless they have children
    const hasVisibleChildren = Array.from(el.children).some(
      (child) => !EXCLUDED_TAGS.has(child.tagName?.toLowerCase())
    );

    const node = {
      tag,
      id: el.id || null,
      classes: Array.from(el.classList || []).slice(0, 8),
      depth,
      text: sanitizeText(el.textContent),
      style: extractStyle(el),
      bounds: rect,
      children: [],
    };

    // Recurse into children
    if (el.children && el.children.length > 0) {
      for (let i = 0; i < el.children.length; i++) {
        const child = traverse(el.children[i], depth + 1, elementCount);
        if (child) {
          node.children.push(child);
        }
        if (elementCount.value >= MAX_ELEMENTS) break;
      }
    }

    // Prune leaf nodes with no dimensions and no text
    if (node.children.length === 0 && rect.width === 0 && rect.height === 0 && !node.text) {
      return null;
    }

    return node;
  }

  // --- Design Token Detection ---

  function detectColors(elements) {
    const colorSet = new Set();
    const colors = [];

    function walk(el) {
      if (!el) return;

      const style = el.style || {};
      const textColor = style.color;
      const bgColor = style.backgroundColor;

      if (textColor && isMeaningfulColor(textColor) && !colorSet.has(textColor)) {
        colorSet.add(textColor);
        colors.push({ value: textColor, type: 'text', source: el.tag });
      }
      if (bgColor && isMeaningfulColor(bgColor) && !colorSet.has(bgColor)) {
        colorSet.add(bgColor);
        colors.push({ value: bgColor, type: 'background', source: el.tag });
      }

      if (el.children) {
        el.children.forEach(walk);
      }
    }

    elements.forEach(walk);
    return colors.slice(0, 40);
  }

  function detectFonts(elements) {
    const fontSet = new Map();

    function walk(el) {
      if (!el || !el.style) return;
      const fontFamily = el.style.fontFamily;
      const fontSize = el.style.fontSize;
      const fontWeight = el.style.fontWeight;

      if (fontFamily) {
        const key = `${fontFamily}|${fontSize}|${fontWeight}`;
        if (!fontSet.has(key)) {
          fontSet.set(key, {
            family: fontFamily,
            size: fontSize,
            weight: fontWeight,
            count: 0,
          });
        }
        fontSet.get(key).count++;
      }

      if (el.children) {
        el.children.forEach(walk);
      }
    }

    elements.forEach(walk);
    return Array.from(fontSet.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  function detectSpacing(elements) {
    const spacingSet = new Set();

    function walk(el) {
      if (!el || !el.style) return;
      const margin = el.style.margin;
      const padding = el.style.padding;

      if (margin && margin !== '0px') spacingSet.add(margin);
      if (padding && padding !== '0px') spacingSet.add(padding);

      if (el.children) {
        el.children.forEach(walk);
      }
    }

    elements.forEach(walk);
    return Array.from(spacingSet).slice(0, 20);
  }

  // --- Main Analysis ---

  function analyzePage() {
    try {
      const rootElements = [];
      const elementCount = { value: 0 };

      // Traverse direct children of body
      if (document.body && document.body.children) {
        for (let i = 0; i < document.body.children.length; i++) {
          const child = traverse(document.body.children[i], 0, elementCount);
          if (child) {
            rootElements.push(child);
          }
          if (elementCount.value >= MAX_ELEMENTS) break;
        }
      }

      const analysis = {
        meta: {
          title: document.title || 'Untitled Page',
          url: window.location.href,
          hostname: window.location.hostname,
          analyzedAt: new Date().toISOString(),
          totalElements: elementCount.value,
        },
        designTokens: {
          colors: detectColors(rootElements),
          fonts: detectFonts(rootElements),
          spacing: detectSpacing(rootElements),
        },
        domTree: rootElements,
      };

      return { success: true, data: analysis };
    } catch (err) {
      return {
        success: false,
        error: err?.message || 'Unknown error during page analysis',
      };
    }
  }

  // --- Static Page Clone ---

  function absoluteUrl(value) {
    if (!value) return value;
    try {
      return new URL(value, window.location.href).href;
    } catch (e) {
      return value;
    }
  }

  function absoluteSrcset(value) {
    if (!value) return value;
    return value
      .split(',')
      .map((part) => {
        const pieces = part.trim().split(/\s+/);
        if (!pieces[0]) return '';
        pieces[0] = absoluteUrl(pieces[0]);
        return pieces.join(' ');
      })
      .filter(Boolean)
      .join(', ');
  }

  function absolutizeCssUrls(value) {
    if (!value || value === 'none') return value;
    return value.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, url) => {
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
      return `url("${absoluteUrl(url)}")`;
    });
  }

  function copyComputedStyles(sourceRoot, cloneRoot) {
    const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
    const cloneElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];

    sourceElements.forEach((sourceEl, index) => {
      const cloneEl = cloneElements[index];
      if (!cloneEl || !sourceEl.getBoundingClientRect) return;

      const computed = getComputedStyle(sourceEl);
      const styleText = CLONE_INLINE_PROPS
        .map((prop) => {
          const cssProp = prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
          let value = computed[prop];
          if (!value) return '';
          if (prop === 'backgroundImage') value = absolutizeCssUrls(value);
          return `${cssProp}:${value}`;
        })
        .filter(Boolean)
        .join(';');

      cloneEl.setAttribute('style', styleText);
    });
  }

  function sanitizeClone(doc) {
    doc.querySelectorAll('script, noscript').forEach((el) => el.remove());

    doc.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    doc.querySelectorAll('form').forEach((form) => {
      form.setAttribute('onsubmit', 'return false');
      form.setAttribute('data-cloned-static-form', 'true');
    });

    doc.querySelectorAll('input, textarea, select, button').forEach((field) => {
      field.setAttribute('disabled', 'disabled');
      if (field.matches('input[type="password"]')) {
        field.removeAttribute('value');
      }
    });
  }

  function fixAssetUrls(doc) {
    doc.querySelectorAll('[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) el.setAttribute('src', absoluteUrl(src));
    });

    doc.querySelectorAll('[href]').forEach((el) => {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        el.setAttribute('href', absoluteUrl(href));
      }
    });

    doc.querySelectorAll('[srcset]').forEach((el) => {
      el.setAttribute('srcset', absoluteSrcset(el.getAttribute('srcset')));
    });

    doc.querySelectorAll('img').forEach((img) => {
      const source = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (source) img.setAttribute('src', absoluteUrl(source));
      img.removeAttribute('loading');
    });
  }

  function buildStaticClone() {
    try {
      const clonedDocument = document.implementation.createHTMLDocument(document.title || 'Cloned Website');
      const clonedElement = document.documentElement.cloneNode(true);
      copyComputedStyles(document.documentElement, clonedElement);

      const importedElement = clonedDocument.importNode(clonedElement, true);
      clonedDocument.replaceChild(importedElement, clonedDocument.documentElement);
      sanitizeClone(clonedDocument);
      fixAssetUrls(clonedDocument);

      let head = clonedDocument.head;
      if (!head) {
        head = clonedDocument.createElement('head');
        clonedDocument.documentElement.insertBefore(head, clonedDocument.body || null);
      }

      const base = clonedDocument.createElement('base');
      base.setAttribute('href', window.location.href);
      head.insertBefore(base, head.firstChild);

      const meta = clonedDocument.createElement('meta');
      meta.setAttribute('name', 'website-study-analyzer');
      meta.setAttribute('content', `Static local clone generated from ${window.location.href}`);
      head.appendChild(meta);

      const guardStyle = clonedDocument.createElement('style');
      guardStyle.textContent = `
        form[data-cloned-static-form] { pointer-events: none; }
        input:disabled, textarea:disabled, select:disabled, button:disabled { opacity: 1; }
      `;
      head.appendChild(guardStyle);

      return {
        success: true,
        html: '<!DOCTYPE html>\n' + clonedDocument.documentElement.outerHTML,
      };
    } catch (err) {
      return {
        success: false,
        error: err?.message || 'Unknown error during page clone',
      };
    }
  }

  // --- Message Listener ---

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ ok: true });
      return true;
    }

    if (request.action === 'analyze') {
      // Run analysis asynchronously to avoid blocking
      setTimeout(() => {
        const result = analyzePage();
        sendResponse(result);
      }, 0);
      return true; // Keep channel open for async response
    }

    if (request.action === 'clonePage') {
      setTimeout(() => {
        const result = buildStaticClone();
        sendResponse(result);
      }, 0);
      return true;
    }
    return false;
  });
})();
