// 日期控件：年 / 月 / 日 分开的控件组，以及组件库的日期选择弹层
import { norm, pickKey } from './rules.js';
import { sleep, deepQueryAll, labelText, attrText, rowContainer, isOurUI } from './dom.js';
import { setVal, bestOptionIndex, isCustomSelect } from './form-control.js';
import { splitDateTime, DATE_KEYS } from './value.js';

const PICKER_CLASS_RE = /ant-picker|ant-calendar-picker|el-date-editor|ivu-date-picker|arco-picker|n-date-picker|van-calendar|flatpickr|react-datepicker|vdp-datepicker|datepicker|date-picker/i;
const PANEL_SELECTOR = '.ant-picker-dropdown, .el-picker-panel, .ivu-picker-panel, .arco-picker-container, .n-date-panel, .flatpickr-calendar, .react-datepicker, [class*="picker-panel"], [class*="datepicker"], [class*="date-picker"]';
const PREV_SELECTOR = '[class*="super-prev"], [class*="prev"]';

// 控件本身是组件库的日期选择器（只读输入框 + 弹层），需要点开面板来选
export function isDatePicker(el) {
  if (!el || el.tagName !== 'INPUT' || isCustomSelect(el)) return false;
  const cls = String(el.className || '') + ' ' + String((el.parentElement && el.parentElement.className) || '');
  return PICKER_CLASS_RE.test(cls);
}

function panelVisible(panel) {
  try {
    const r = panel.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
  } catch (e) { /* 取不到尺寸就按可见处理 */ }
  const style = panel.getAttribute && panel.getAttribute('style');
  if (style && /display\s*:\s*none/i.test(style)) return false;
  return true;
}

function findPanel() {
  const list = deepQueryAll(PANEL_SELECTOR).filter(panelVisible);
  return list.length ? list[list.length - 1] : null;
}

function clickNode(node) {
  node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  node.click();
}

// 命中同一段文字的可能是外层格子和内层文字两层，点最内层，事件会自己冒泡上去
function innermost(hits) {
  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i];
    let wraps = false;
    for (let j = 0; j < hits.length; j += 1) {
      if (i !== j && hit.contains && hit.contains(hits[j])) { wraps = true; break; }
    }
    if (!wraps) return hit;
  }
  return hits[0];
}

// 在弹层里找文字匹配的单元格并点击，越过 disabled 与上/下月的格子
function clickCell(panel, texts) {
  const cells = panel.querySelectorAll('td, th, li, button, a, span, div');
  const hits = [];
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const text = String(cell.textContent || '').trim();
    if (texts.indexOf(text) < 0) continue;
    const cls = String(cell.className || '');
    if (/disabled|prev|next|out-of-range|not-current/.test(cls)) continue;
    hits.push(cell);
  }
  if (!hits.length) return false;
  clickNode(innermost(hits));
  return true;
}

// 表头上的年份按钮，点一下会切到年份列表
function openYearView(panel) {
  const headers = panel.querySelectorAll('[class*="header"], [class*="title"]');
  for (let i = 0; i < headers.length; i += 1) {
    const parts = headers[i].querySelectorAll('button, span, div, a');
    const hits = [];
    for (let j = 0; j < parts.length; j += 1) {
      if (/^\d{4}\s*年?$/.test(String(parts[j].textContent || '').trim())) hits.push(parts[j]);
    }
    if (hits.length) { clickNode(innermost(hits)); return true; }
  }
  return false;
}

function clickPrev(panel) {
  const list = panel.querySelectorAll(PREV_SELECTOR);
  for (let i = 0; i < list.length; i += 1) {
    const cls = String(list[i].className || '');
    if (/next|super-next/.test(cls)) continue;
    clickNode(list[i]);
    return true;
  }
  return false;
}

function clickNext(panel) {
  const list = panel.querySelectorAll('[class*="next"]');
  for (let i = 0; i < list.length; i += 1) {
    const cls = String(list[i].className || '');
    if (/prev/.test(cls) && !/next/.test(cls)) continue;
    clickNode(list[i]);
    return true;
  }
  return false;
}

// 年份可能不在当前显示的一页里，需要翻页去找
async function pickYear(panel, year) {
  for (let i = 0; i < 12; i += 1) {
    if (clickCell(panel, [year])) return true;
    if (!clickPrev(panel)) break;
    await sleep(90);
  }
  for (let i = 0; i < 24; i += 1) {
    if (clickCell(panel, [year])) return true;
    if (!clickNext(panel)) break;
    await sleep(90);
  }
  return false;
}

function monthTexts(month) {
  const n = String(Number(month));
  return [n + '月', month + '月', n, month];
}

function dayTexts(day) {
  const n = String(Number(day));
  return [n, day, n + '日', day + '日'];
}

// 点开日期弹层，逐级选择年、月、日，最后按输入框里的值判断是否成功
export async function fillDatePicker(el, value) {
  const date = splitDateTime(value);
  if (!date) return false;
  let panel = null;
  try {
    el.focus();
    el.click();
    await sleep(260);
    panel = findPanel();
    if (!panel) return false;
    await sleep(60);
    if (openYearView(panel)) await sleep(160);
    if (!await pickYear(panel, date.year)) return false;
    await sleep(120);
    if (!clickCell(panel, monthTexts(date.month))) return false;
    await sleep(120);
    if (!clickCell(panel, dayTexts(date.day))) return false;
    await sleep(200);
    return !!String(el.value || '').trim();
  } catch (e) {
    return false;
  } finally {
    if (panel) {
      try { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (e) { /* 忽略 */ }
    }
  }
}

// 判断一个控件在「年 / 月 / 日」三个格子里担任哪一个
export function dateRole(el) {
  const label = norm(labelText(el));
  const attr = norm(String(el.getAttribute('name') || '') + ' ' + String(el.getAttribute('id') || '') + ' ' + String(el.getAttribute('placeholder') || ''));
  const whole = pickKey({ label, attr, hint: '', allowHint: false });
  // 标签本身就是完整字段名（例如「出生年月」），说明这不是分开的格子
  if (whole && DATE_KEYS[whole]) return '';
  if (/(^|[^a-z])(year|yyyy)([^a-z]|$)/.test(attr)) return 'year';
  if (/(^|[^a-z])month([^a-z]|$)/.test(attr)) return 'month';
  if (/(^|[^a-z])(day|dd)([^a-z]|$)/.test(attr)) return 'day';
  if (/年$/.test(label)) return 'year';
  if (/月$/.test(label)) return 'month';
  if (/[日号]$/.test(label)) return 'day';
  return '';
}

function usable(node) {
  if (!node || !node.tagName) return false;
  if (node.disabled || node.readOnly) return false;
  if ((node.type || '').toLowerCase() === 'hidden') return false;
  return !isOurUI(node);
}

// 同一行里相邻的年、月、日控件组成一组，返回组内每个控件的角色
export function dateSegmentGroup(el) {
  const row = rowContainer(el);
  if (!row || !row.querySelectorAll) return null;
  const nodes = [];
  const inside = row.querySelectorAll('input, select');
  for (let i = 0; i < inside.length; i += 1) {
    if (usable(inside[i])) nodes.push(inside[i]);
  }
  if (nodes.length < 2 || nodes.length > 3) return null;
  const fallback = nodes.length === 3 ? ['year', 'month', 'day'] : ['year', 'month'];
  const roles = nodes.map((node) => dateRole(node));
  const taken = {};
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] && !taken[roles[i]]) taken[roles[i]] = 1;
    else roles[i] = '';
  }
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i]) continue;
    const pick = fallback.filter((r) => !taken[r])[0];
    if (!pick) return null;
    roles[i] = pick;
    taken[pick] = 1;
  }
  if (!(taken.year && taken.month)) return null;
  return { row, nodes, roles };
}

// 把资料里的日期按角色写进组内对应控件
export function writeDateSegment(node, role, date) {
  const want = role === 'year' ? date.year : (role === 'month' ? date.month : date.day);
  if (node.tagName === 'SELECT') {
    const idx = bestOptionIndex(node, want, false);
    if (idx < 0) return false;
    setVal(node, node.options[idx].value);
    return !!String(node.value || '').trim();
  }
  setVal(node, want);
  return !!String(node.value || '').trim();
}
