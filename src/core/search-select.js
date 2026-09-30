// 可搜索下拉：学校、公司这类字段是「输入关键词再选候选」的控件，
// 直接给原生控件写值，组件不会认，要点开、输入、再点候选项
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
    if (String(node.className || '').indexOf('no-results') >= 0) continue;
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

// 点开下拉 → 在搜索框里输入 → 点候选。返回是否选中
export async function fillSearchSelect(el, value) {
  const want = String(value == null ? '' : value).trim();
  if (!want) return false;
  const wrap = (el.closest && el.closest('.bootstrap-select')) || el.parentElement;
  const toggle = wrap && wrap.querySelector('button.dropdown-toggle, [data-toggle="dropdown"]');
  if (toggle) clickNode(toggle);
  else {
    try { el.focus(); } catch (e) { /* 忽略 */ }
  }
  await sleep(220);
  const box = wrap && wrap.querySelector('.bs-searchbox input, input[type="search"]');
  // 选项可能是点开之后才去后端取的：每等一轮都看两个地方，
  // 一是原生控件里有没有被填进选项，二是弹层里有没有出现候选项
  const settled = () => {
    const idx = bestOptionIndex(el, want, false);
    if (idx >= 0) {
      setVal(el, el.options[idx].value);
      return true;
    }
    return false;
  };
  let hit = null;
  for (let i = 0; i < 8 && !hit; i += 1) {
    await sleep(180);
    if (settled()) return true;
    hit = pickOption(optionsIn(wrap), want);
  }
  if (!hit && box) {
    setVal(box, want);
    for (let i = 0; i < 10 && !hit; i += 1) {
      await sleep(180);
      if (settled()) return true;
      hit = pickOption(optionsIn(wrap), want);
    }
  }
  if (!hit) {
    if (toggle) clickNode(toggle);
    return false;
  }
  clickNode(hit);
  // 组件把选中结果写回原生控件需要一点时间，轮询等一下
  for (let i = 0; i < 8; i += 1) {
    await sleep(80);
    if (el.tagName === 'SELECT' && String(el.value || '').trim()) return true;
  }
  return el.tagName !== 'SELECT';
}
