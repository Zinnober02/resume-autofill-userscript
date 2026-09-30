// DOM 查询与标签文字提取
import { UI_ID } from './env.js';
import { norm, sectionType, pickKey, matchKeys, EDU_RE, WORK_RE } from './rules.js';
import { groupOf } from './value.js';

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

// 依次找字段名：属性里写的 → label 元素 → 旁边的文字 → title / placeholder
export function labelText(el) {
  if (!el.getAttribute) return '';
  const parts = [];
  const push = (v) => {
    const t = String(v == null ? '' : v).trim();
    if (t && parts.indexOf(t) < 0 && parts.length < 4) parts.push(t);
  };
  push(attrLabel(el));
  const lb = el.getAttribute('aria-labelledby');
  if (lb) {
    lb.split(/\s+/).forEach((id) => {
      const t = document.getElementById(id);
      if (t) push(visibleText(t, 80));
    });
  }
  if (el.id) {
    try {
      const lab = document.querySelector('label[for="' + cssEscape(el.id) + '"]');
      if (lab) push(visibleText(lab, 80));
    } catch (e) { /* 忽略非法选择器 */ }
  }
  const wrap = el.closest && el.closest('label');
  if (wrap) push(visibleText(wrap, 80));
  // 很多老表单不写 label for，标签就是前一个格子，这里补上
  if (!parts.length) {
    const likeLabel = (n) => {
      if (!n || !n.tagName) return '';
      const tag = n.tagName;
      const okTag = tag === 'LABEL' || tag === 'TD' || tag === 'TH' || tag === 'SPAN' || tag === 'DIV' || tag === 'P' || tag === 'B' || tag === 'STRONG' || tag === 'EM';
      if (!okTag) return '';
      if (n.querySelector && n.querySelector('input, select, textarea')) return '';
      return visibleText(n, 30).trim().slice(0, 30);
    };
    push(meaningfulLabel(likeLabel(el.previousElementSibling)));
    if (!parts.length && el.parentElement) push(meaningfulLabel(likeLabel(el.parentElement.previousElementSibling)));
  }
  push(meaningfulLabel(el.getAttribute('title')));
  push(meaningfulLabel(el.getAttribute('placeholder')));
  return parts.join(' ').trim();
}

// 参与字段名匹配的属性。class 里放的是样式与行为标记（dayType、requireInput、startDate 这类），
// 拿它去匹配字段名会把「入学时间」认成到岗时间，所以不取
export function attrText(el) {
  const keys = ['name', 'id', 'placeholder', 'data-name', 'data-field', 'data-label', 'autocomplete'];
  const parts = [];
  keys.forEach((k) => {
    const v = el.getAttribute && el.getAttribute(k);
    if (v && v.length < 120) parts.push(v);
  });
  return parts.join(' ');
}

// 属性值里写着的字段名。属性名只用来排优先级，换一套组件库只要改这张表
const LABEL_ATTRS = ['aria-label', 'msg', 'data-label', 'data-name', 'data-title', 'label'];
const ANCESTOR_LABEL_ATTRS = ['msg', 'data-label', 'data-name'];

// 只留像字段名的值：去掉纯提示语与过长的文本
function meaningfulLabel(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return '';
  const flat = norm(t);
  if (!flat || flat.length > 24) return '';
  if (/^(请选择|请输入|请填写|请选择或输入|请选择或填写|选择|输入|select|choose|enter|input)+$/.test(flat)) return '';
  return t;
}

// 有的组件把字段信息塞在 data 属性里的 json 中，例如 data='{"id":41,"name":"个人照片"}'
function jsonLabel(node) {
  const raw = node.getAttribute && node.getAttribute('data');
  if (!raw || raw.charAt(0) !== '{') return '';
  try {
    const obj = JSON.parse(raw);
    return obj && obj.name ? String(obj.name) : '';
  } catch (e) {
    return '';
  }
}

function attrLabel(el) {
  for (let i = 0; i < LABEL_ATTRS.length; i += 1) {
    const v = meaningfulLabel(el.getAttribute(LABEL_ATTRS[i]));
    if (v) return v;
  }
  const own = meaningfulLabel(jsonLabel(el));
  if (own) return own;
  let node = el.parentElement;
  for (let depth = 0; depth < 3 && node; depth += 1) {
    for (let i = 0; i < ANCESTOR_LABEL_ATTRS.length; i += 1) {
      const v = meaningfulLabel(node.getAttribute && node.getAttribute(ANCESTOR_LABEL_ATTRS[i]));
      if (v) return v;
    }
    const json = meaningfulLabel(jsonLabel(node));
    if (json) return json;
    node = node.parentElement;
  }
  return '';
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

const FIELD_SELECTOR = 'input, textarea, select';

// 往上找最近的一栏：包含至少两个表单控件的祖先。用结构判断，
// 不依赖容器文字长短，否则字段多、选项文字长的一栏会被判成「太大」而跳过
export function sectionContainer(el) {
  let cur = el;
  for (let i = 0; i < 10 && cur; i += 1) {
    cur = cur.parentElement;
    if (!cur || cur.tagName === 'BODY' || cur.tagName === 'HTML') break;
    if (cur.querySelectorAll(FIELD_SELECTOR).length >= 2) return cur;
  }
  return null;
}

const blockTypeCache = new WeakMap();

// 栏内字段投票。一个名字同时属于好几组时（「开始时间」在教育、工作、活动里都成立）弃权，
// 只让归属唯一的字段说话
function countVotes(scope) {
  const votes = {};
  const list = scope.querySelectorAll(FIELD_SELECTOR);
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    const keys = matchKeys({ label: labelText(node), attr: attrText(node) });
    const groups = [];
    for (let j = 0; j < keys.length; j += 1) {
      const group = groupOf(keys[j]);
      if (group && groups.indexOf(group) < 0) groups.push(group);
    }
    if (groups.length === 1) votes[groups[0]] = (votes[groups[0]] || 0) + 1;
  }
  return votes;
}

function bestVote(votes, min) {
  let best = '';
  let bestCount = 0;
  Object.keys(votes).forEach((group) => {
    if (votes[group] > bestCount) { bestCount = votes[group]; best = group; }
  });
  return bestCount >= min ? best : '';
}

// 这一栏是教育、工作、专利还是别的。先看这一栏文字里写着的线索，
// 拿不到时再让栏内字段投票（专利、论文那一类栏目里全是带区块限定的字段名）
export function sectionBlockType(el) {
  const scope = sectionContainer(el);
  if (!scope) return '';
  if (blockTypeCache.has(scope)) return blockTypeCache.get(scope);
  const byVote = bestVote(countVotes(scope), 2);
  const result = byVote || sectionType(norm(visibleText(scope, 600)));
  blockTypeCache.set(scope, result);
  return result;
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

// 文字线索的兜底：容器文字里直接写着区块类型（「教育经历」这类标题）
function textSection(el) {
  let cur = el;
  for (let i = 0; i < 8 && cur; i += 1) {
    cur = cur.parentElement;
    if (!cur || cur.tagName === 'BODY') break;
    const t = cur.textContent || '';
    if (t.length <= 800 && sectionType(t)) return cur;
  }
  return null;
}

export function fieldHint(el) {
  const sec = sectionContainer(el) || textSection(el);
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
