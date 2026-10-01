// 级联控件：一组下拉（或一个多列面板）共同表达一个分级的值，比如省 / 市 / 区县。
// 四段：认组 → 分角色 → 逐级驱动 → 等就绪
import { norm } from './rules.js';
import { visible, isOurUI, sectionContainer } from './dom.js';
import { setVal, bestOptionIndex } from './form-control.js';
import { isSearchSelect, fillSearchSelect } from './search-select.js';
import {
  fillFloatingPicker, openPanel, candidateItems, pickItem, clickNode, panelColumns, sameStructureChildren,
} from './floating-picker.js';
import { normalizeRegion } from './region-names.js';
import { waitFor } from './wait.js';
import { ADDRESS_KEYS } from './value.js';
import { assignRoles, valueForRole, ADDRESS_ROLES } from './address.js';

const MAX_LEVELS = 4;

// 目前只有地址类是分级字段；以后有别的分级字段，在这里登记即可
function isCascadeKey(key) {
  return !!ADDRESS_KEYS[key];
}

function selectableControls(scope) {
  const out = [];
  const list = scope.querySelectorAll('input, select');
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (isOurUI(node) || node.disabled) continue;
    const t = (node.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') continue;
    if (t === 'file' || t === 'checkbox' || t === 'radio') continue;
    if (node.tagName !== 'INPUT' && node.tagName !== 'SELECT' && node.getAttribute('role') !== 'combobox') continue;
    out.push(node);
  }
  return out;
}

// 一栏的范围：往上找到第一个「兄弟里也有同类控件」的祖先。
// 组件自己的包装盒不算——bootstrap-select 的 .btn-group 里塞着搜索框，
// 按「容器里有几个控件」去找会停在包装盒上，一组控件就被拆散了
export function cascadeScope(el) {
  const tag = el.tagName;
  let node = el;
  for (let depth = 0; depth < 8 && node && node.parentElement; depth += 1) {
    const parent = node.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) break;
    const hasSibling = Array.prototype.some.call(parent.children, (child) => {
      if (child === node) return false;
      if (child.tagName === tag) return true;
      return !!(child.querySelector && child.querySelector(tag));
    });
    if (hasSibling) return parent;
    node = parent;
  }
  return sectionContainer(el);
}

// 同一个控件在栏内的位置：同标签的控件按顺序排，它排第几
export function cascadePositionOf(el) {
  const scope = cascadeScope(el);
  if (!scope) return 0;
  const list = selectableControls(scope).filter((node) => node.tagName === el.tagName);
  const idx = list.indexOf(el);
  return idx < 0 ? 0 : idx;
}

// 控件常常被组件包一层，盒子里还塞着自己的搜索框（bootstrap-select 就是这样）。
// 划段按包装盒来，一个盒子最多算一个控件，搜索框才不会把一组下拉切断
function controlUnits(scope) {
  const controls = selectableControls(scope);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < controls.length; i += 1) {
    const node = controls[i];
    let box = node;
    while (box.parentElement && box.parentElement !== scope) box = box.parentElement;
    if (box.parentElement !== scope) continue;
    if (seen.has(box)) continue;
    seen.add(box);
    const inside = controls.filter((n) => n === box || box.contains(n));
    const pick = inside.find((n) => n.tagName === 'SELECT') || inside[0];
    out.push({ box, node: pick });
  }
  return out;
}

// 认组：一栏里连续的同类控件，其中至少一个能认出是分级字段
export function detectCascade(el, classify) {
  if (!el || (el.tagName !== 'SELECT' && el.tagName !== 'INPUT')) return null;
  const scope = cascadeScope(el);
  if (!scope) return null;
  const units = controlUnits(scope);
  const list = units.map((u) => ({ node: u.node, key: classify(u.node) }));
  const idx = list.findIndex((item) => item.node === el);
  if (idx < 0) return null;
  const tag = el.tagName;
  let start = idx;
  let end = idx;
  while (start > 0 && list[start - 1].node.tagName === tag) start -= 1;
  while (end < list.length - 1 && list[end + 1].node.tagName === tag) end += 1;
  const seg = list.slice(start, end + 1);
  let groupKey = '';
  for (let i = 0; i < seg.length; i += 1) {
    if (seg[i].key && isCascadeKey(seg[i].key)) { groupKey = seg[i].key; break; }
  }
  if (!groupKey) return null;
  // 组里只留「没有字段名的」和「就是这个分级字段的」，旁边的学历、性别不拉进来
  const members = seg.filter((item) => !item.key || item.key === groupKey);
  if (!members.length || members.length > MAX_LEVELS) return null;
  const nodes = members.map((item) => item.node);
  return {
    key: groupKey,
    nodes,
    roles: assignRoles(nodes),
    position: members.findIndex((item) => item.node === el),
  };
}

// 组件把原生控件藏起来、只留自己那个按钮时，仍然要处理它
export function hasVisibleMirror(node) {
  if (!node || node.tagName !== 'SELECT') return false;
  const wrap = node.closest && node.closest('.bootstrap-select');
  if (!wrap) return false;
  const toggle = wrap.querySelector('button.dropdown-toggle, [data-toggle="dropdown"]');
  return !!(toggle && visible(toggle));
}

function mirrorText(node) {
  const wrap = node.closest && node.closest('.bootstrap-select');
  if (!wrap) return '';
  const span = wrap.querySelector('.filter-option');
  if (span) return String(span.textContent).trim();
  const toggle = wrap.querySelector('button.dropdown-toggle');
  return toggle ? String(toggle.getAttribute('title') || '').trim() : '';
}

// 写完值要验一下：原生选项变了、或者组件显示的文本变了，才算真的选中
function verifyWritten(node, want) {
  const w = normalizeRegion(want);
  if (!w) return false;
  if (node.tagName === 'SELECT') {
    const text = node.selectedIndex >= 0 ? String(node.options[node.selectedIndex].textContent) : '';
    if (text && normalizeRegion(text).indexOf(w) >= 0) return true;
    const mirror = normalizeRegion(mirrorText(node));
    return !!mirror && mirror.indexOf(w) >= 0;
  }
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
    const value = normalizeRegion(node.value);
    return !!value && value.indexOf(w) >= 0;
  }
  const text = normalizeRegion(node.textContent);
  return !!text && text.indexOf(w) >= 0;
}

async function writeNative(node, want) {
  if (node.tagName !== 'SELECT') {
    setVal(node, want);
    return verifyWritten(node, want);
  }
  const idx = bestOptionIndex(node, want, false);
  if (idx < 0) return false;
  setVal(node, node.options[idx].value);
  return verifyWritten(node, want);
}

// 一个控件写值的策略链：先按组件的方式驱动，验不过再退回原生写值
export async function driveControl(node, want) {
  const attempts = [];
  if (node.tagName === 'SELECT') {
    if (isSearchSelect(node)) attempts.push(() => fillSearchSelect(node, want));
    attempts.push(() => writeNative(node, want));
  } else if (node.readOnly) {
    attempts.push(() => fillFloatingPicker(node, want));
    attempts.push(() => writeNative(node, want));
  } else {
    attempts.push(() => writeNative(node, want));
  }
  for (let i = 0; i < attempts.length; i += 1) {
    let ok = false;
    try { ok = await attempts[i](); } catch (e) { ok = false; }
    if (ok && verifyWritten(node, want)) return true;
  }
  return false;
}

function optionsReady(node) {
  if (!node || node.tagName !== 'SELECT') return true;
  if (node.options && node.options.length > 1) return true;
  // 候选靠关键词去后端换的下拉，原生选项一直是空的，不能干等
  return isSearchSelect(node);
}

// 逐级驱动：等这一级的选项就绪 → 写值 → 等下一级就绪
export async function fillCascade(group, values, options) {
  const opts = options || {};
  const levelTimeout = opts.timeout == null ? 6000 : opts.timeout;
  const result = { written: 0, blocked: [], missing: [] };
  for (let i = 0; i < group.nodes.length; i += 1) {
    const node = group.nodes[i];
    const role = group.roles[i];
    if (!role) continue;
    const want = valueForRole(values, role);
    if (!want) continue;
    if (node.tagName === 'SELECT') {
      await waitFor(() => optionsReady(node), { timeout: levelTimeout, root: node.parentElement || node });
    }
    if (await driveControl(node, want)) result.written += 1;
    else result.blocked.push(role);
  }
  // 资料里还有下一级、页面上没有对应控件时记下来，让用户补
  ADDRESS_ROLES.forEach((role) => {
    if (group.roles.indexOf(role) >= 0) return;
    if (valueForRole(values, role)) result.missing.push(role);
  });
  return result;
}

// 单控件多级面板（一列一级的浮层）：在当前列里点中匹配项，等下一列出来，再点
export async function fillCascadePanel(el, values, options) {
  const opts = options || {};
  const result = { written: 0, blocked: [], missing: [] };
  const opened = await openPanel(el);
  if (!opened) return result;
  // 一列一级的面板按列走；只有一列时整块当一级
  const cols = panelColumns(opened.panel);
  for (let i = 0; i < ADDRESS_ROLES.length; i += 1) {
    const role = ADDRESS_ROLES[i];
    const want = valueForRole(values, role);
    if (!want) continue;
    const scope = cols ? cols[i] : opened.panel;
    if (!scope) {
      result.missing = ADDRESS_ROLES.slice(i).filter((r) => valueForRole(values, r));
      break;
    }
    const itemsIn = () => (cols ? sameStructureChildren(scope) : candidateItems(scope));
    const hit = await waitFor(() => pickItem(itemsIn(), want), { timeout: opts.timeout || 2500 });
    if (!hit) {
      result.blocked.push(role);
      result.missing = ADDRESS_ROLES.slice(i + 1).filter((r) => valueForRole(values, r));
      break;
    }
    clickNode(hit);
    result.written += 1;
  }
  return result;
}
