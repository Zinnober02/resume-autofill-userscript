// 可搜索下拉与弹层选择控件：学校、公司、籍贯这类字段不是普通下拉，
// 要「点开 → 把关键词交给搜索框 → 等候选 → 点候选项」才认
import { norm } from './rules.js';
import { sleep, deepQueryAll, visible, isOurUI } from './dom.js';
import { setVal, bestOptionIndex } from './form-control.js';

const OPTION_SELECTOR = '[role="option"], .dropdown-menu li a, .dropdown-menu li, .ant-select-item-option, .el-select-dropdown__item, .bs-searchbox ~ .dropdown-menu li a';

export function isSearchSelect(el) {
  if (!el || el.tagName !== 'SELECT') return false;
  if (String(el.getAttribute('data-live-search')) === 'true') return true;
  return !!(el.closest && el.closest('.bootstrap-select'));
}

// 点一下：派发完整的鼠标事件序列。候选项常是 a / li 这类元素，
// 直接调 click() 在部分环境里不会派发事件，这里统一用 dispatchEvent
function clickNode(node) {
  node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function optionsIn(wrap) {
  const list = deepQueryAll(OPTION_SELECTOR);
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (isOurUI(node)) continue;
    if (wrap && !wrap.contains(node)) continue;
    if (!visible(node)) continue;
    out.push(node);
  }
  return out;
}

function pickOption(list, want) {
  const w = norm(want);
  const hits = [];
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    const text = norm(node.textContent);
    if (!text || text === '请选择') continue;
    if (/no-results|search-no/.test(String(node.className || ''))) continue;
    let score = 0;
    if (text === w) score = 100;
    else if (text.indexOf(w) >= 0) score = 60;
    else if (w.indexOf(text) >= 0) score = 40;
    if (score) hits.push({ node, score });
  }
  if (!hits.length) return null;
  let bestScore = 0;
  for (let i = 0; i < hits.length; i += 1) bestScore = Math.max(bestScore, hits[i].score);
  const top = hits.filter((h) => h.score === bestScore).map((h) => h.node);
  // 候选项常常是「外层格子 + 内层文字」两层，点最内层，事件会冒泡上去
  for (let i = 0; i < top.length; i += 1) {
    const node = top[i];
    if (!top.some((other) => other !== node && node.contains(other))) return node;
  }
  return top[0];
}

// 点开下拉 → 关键词进搜索框 → 等候选 → 点候选。返回是否选中
export async function fillSearchSelect(el, value) {
  const want = String(value == null ? '' : value).trim();
  if (!want) return false;
  const wrap = (el.closest && el.closest('.bootstrap-select')) || el.parentElement;
  const toggle = wrap && wrap.querySelector('button.dropdown-toggle, [data-toggle="dropdown"]');
  if (toggle) clickNode(toggle);
  else {
    try { el.focus(); } catch (e) { /* 忽略 */ }
  }
  await sleep(120);
  // 搜索框常常是点开之后才建出来的；候选也多是拿关键词去后端换来的。
  // 关键词要先进搜索框，空着等只能等到组件点开时就有的那几个选项
  const box = wrap && wrap.querySelector('.bs-searchbox input, input[type="search"]');
  if (box) setVal(box, want);
  for (let i = 0; i < 12; i += 1) {
    await sleep(180);
    const idx = bestOptionIndex(el, want, false);
    if (idx >= 0) {
      setVal(el, el.options[idx].value);
      return true;
    }
    const hit = pickOption(optionsIn(wrap), want);
    if (!hit) continue;
    clickNode(hit);
    // 组件把选中结果写回原生控件需要一点时间，轮询等一下
    for (let k = 0; k < 8; k += 1) {
      await sleep(80);
      if (el.tagName !== 'SELECT') return true;
      if (String(el.value || '').trim()) return true;
    }
    return el.tagName !== 'SELECT';
  }
  if (box) setVal(box, '');
  if (toggle) clickNode(toggle);
  return false;
}

// 学校、专业这类字段不是原生下拉：页面上是一个只读的展示框，
// 点它会弹出候选弹层，弹层里先给关键词再点候选
const PICKER_INPUT = 'input[readonly][school-or-subject="1"]';
const PICKER_PANEL = '.search-result-li, .school-m, .school-b, .main-data';
const PICKER_ITEM = '.search-result-li li, .search-result-li a, .school-m li, .school-m a, .school-b li, .school-b a, .main-data li, .main-data a, .main-data p, .main-data span';

// 控件与它的弹层在同一个容器里，容器里同时有只读框和候选列表
function pickerRoot(el) {
  let node = el.parentElement;
  for (let i = 0; node && node !== document.body && i < 10; i += 1) {
    if (node.querySelector && node.querySelector(PICKER_INPUT) && node.querySelector(PICKER_PANEL)) return node;
    node = node.parentElement;
  }
  return null;
}

// 只读的展示框，点它会弹出候选弹层
export function isModalPicker(el) {
  if (!el || el.tagName !== 'INPUT' || !el.readOnly) return false;
  if (el.getAttribute('school-or-subject') !== '1') return false;
  return !!pickerRoot(el);
}

// 弹层控件里的其它输入框（辅助的 input-query、弹层自己的搜索框）由 fillModalPicker 管，不单独填
export function isPickerHelper(el) {
  if (!el || el.tagName !== 'INPUT' || el.readOnly) return false;
  return !!pickerRoot(el);
}

function pickerCandidates(root) {
  const list = root.querySelectorAll(PICKER_ITEM);
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (isOurUI(node) || !visible(node)) continue;
    if (/no-results|search-no|model-close/.test(String(node.className || ''))) continue;
    out.push(node);
  }
  return out;
}

// 点开弹层 → 关键词进弹层的搜索框 → 等候选 → 点候选。返回是否选中
export async function fillModalPicker(el, value) {
  const want = String(value == null ? '' : value).trim();
  if (!want) return false;
  const root = pickerRoot(el);
  if (!root) return false;
  clickNode(el);
  await sleep(300);
  const box = root.querySelector('.search-school, .search-job');
  if (box) setVal(box, want);
  const model = root.querySelector('input[school-or-subject="2"]');
  for (let i = 0; i < 12; i += 1) {
    const hit = pickOption(pickerCandidates(root), want);
    if (hit) {
      clickNode(hit);
      // 站点把选中的值写回只读框与旁边的模型输入框需要一点时间
      for (let k = 0; k < 10; k += 1) {
        await sleep(120);
        if (String(el.value || '').trim()) return true;
        if (model && norm(model.value) === norm(want)) return true;
      }
      return false;
    }
    await sleep(180);
  }
  return false;
}
