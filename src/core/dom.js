// DOM 查询与标签文字提取
import { UI_ID } from './env.js';
import { norm, sectionType, EDU_RE, WORK_RE } from './rules.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function deepQueryAll(selector, root, out) {
  const res = out || [];
  const node = root || document;
  let list;
  try { list = node.querySelectorAll(selector); } catch (e) { list = []; }
  for (let i = 0; i < list.length; i += 1) res.push(list[i]);
  let all;
  try { all = node.querySelectorAll('*'); } catch (e) { all = []; }
  for (let i = 0; i < all.length; i += 1) {
    const sr = all[i].shadowRoot;
    if (sr) deepQueryAll(selector, sr, res);
  }
  return res;
}

export function ownRoot(el) {
  try { return el.getRootNode(); } catch (e) { return document; }
}

export function isOurUI(el) {
  const r = ownRoot(el);
  return !!(r && r.host && r.host.id === UI_ID);
}

// 取看得见的文字，跳过下拉框的选项和脚本样式，避免「请选择 本科 硕士 博士」污染判断
export function visibleText(node, limit) {
  let s = '';
  const cap = limit || 200;
  const walk = (n) => {
    if (s.length >= cap || !n) return;
    if (n.nodeType === 3) { s += n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SELECT' || tag === 'OPTION' || tag === 'SVG' || tag === 'TEXTAREA') return;
    const st = n.getAttribute && n.getAttribute('style');
    if (st && /display\s*:\s*none/i.test(st)) return;
    for (let i = 0; i < n.childNodes.length; i += 1) {
      if (s.length >= cap) break;
      walk(n.childNodes[i]);
    }
  };
  walk(node);
  return s;
}

export function cssEscape(v) {
  if (window.CSS && CSS.escape) return CSS.escape(v);
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export function labelText(el) {
  const parts = [];
  if (!el.getAttribute) return '';
  const al = el.getAttribute('aria-label');
  if (al) parts.push(al);
  const lb = el.getAttribute('aria-labelledby');
  if (lb) {
    lb.split(/\s+/).forEach((id) => {
      const t = document.getElementById(id);
      if (t) parts.push(visibleText(t, 80));
    });
  }
  if (el.id) {
    try {
      const lab = document.querySelector('label[for="' + cssEscape(el.id) + '"]');
      if (lab) parts.push(visibleText(lab, 80));
    } catch (e) { /* 忽略非法选择器 */ }
  }
  const wrap = el.closest && el.closest('label');
  if (wrap) parts.push(visibleText(wrap, 80));
  // 很多老表单不写 label for，标签就是前一个格子，这里补上
  if (!parts.length) {
    const likeLabel = (n) => {
      if (!n || !n.tagName) return '';
      const tag = n.tagName;
      const okTag = tag === 'LABEL' || tag === 'TD' || tag === 'TH' || tag === 'SPAN' || tag === 'DIV' || tag === 'P' || tag === 'B' || tag === 'STRONG' || tag === 'EM';
      if (!okTag) return '';
      if (n.querySelector && n.querySelector('input, select, textarea')) return '';
      return visibleText(n, 30).trim();
    };
    let t = likeLabel(el.previousElementSibling);
    if (!t && el.parentElement) t = likeLabel(el.parentElement.previousElementSibling);
    if (t) parts.push(t);
  }
  const ti = el.getAttribute('title');
  if (ti) parts.push(ti);
  return parts.join(' ').trim();
}

export function attrText(el) {
  const keys = ['name', 'id', 'placeholder', 'data-name', 'data-field', 'data-label', 'autocomplete', 'class'];
  const parts = [];
  keys.forEach((k) => {
    const v = el.getAttribute && el.getAttribute(k);
    if (v && v.length < 120) parts.push(v);
  });
  return parts.join(' ');
}

// 往上找最近的一块「只属于当前这一行」的区域，用来判断是本科行还是硕士行
export function rowContainer(el) {
  let cur = el;
  let best = el.parentElement || el;
  for (let i = 0; i < 6 && cur; i += 1) {
    cur = cur.parentElement;
    if (!cur) break;
    if (cur.tagName === 'BODY' || cur.tagName === 'FORM') break;
    if ((cur.textContent || '').length > 160) break;
    best = cur;
  }
  return best;
}

// 往上找最近的一块「教育经历 / 工作经历」区块
export function sectionContainer(el) {
  let cur = el;
  for (let i = 0; i < 8 && cur; i += 1) {
    cur = cur.parentElement;
    if (!cur || cur.tagName === 'BODY') break;
    const t = cur.textContent || '';
    if (t.length <= 800 && sectionType(t)) return cur;
  }
  return null;
}

// 找「整个教育经历 / 工作经历」这一大块，用来数这是第几段经历
export function sectionScope(el) {
  const probe = visibleText(el.parentElement || el, 120);
  const type = sectionType(norm(probe)) || sectionType(norm(fieldHint(el)));
  if (!type) return null;
  const re = type === 'edu' ? EDU_RE : WORK_RE;
  const otherRe = type === 'edu' ? WORK_RE : EDU_RE;
  let cur = el;
  let best = null;
  for (let i = 0; i < 8 && cur; i += 1) {
    cur = cur.parentElement;
    if (!cur || cur.tagName === 'BODY') break;
    const txt = cur.textContent || '';
    if (txt.length > 3000) break;
    if (!re.test(txt)) break;
    best = cur;
    if (otherRe.test(txt)) break;
  }
  return best;
}

export function fieldHint(el) {
  const sec = sectionContainer(el);
  if (!sec) return '';
  return visibleText(sec, 400) + ' ' + visibleText(rowContainer(el), 160);
}

export function visible(el) {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}
