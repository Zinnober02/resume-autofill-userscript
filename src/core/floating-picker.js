// 弹层选择控件：页面上是一个只读的展示框，点它弹出候选浮层，
// 浮层里可以先输入关键词，再点中候选项。
// 这里不认具体类名，靠「点下去之后新出现的浮层」与「同结构的一组条目」来判断
import { norm } from './rules.js';
import { sleep, visible, isOurUI } from './dom.js';
import { setVal } from './form-control.js';

const MIN_ITEMS = 3;
const OPEN_ROUNDS = 8;
const PICK_ROUNDS = 12;

// 点一下：候选项常是 a / li 这类元素，直接调 click() 在部分环境里不派发事件
export function clickNode(node) {
  node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function snapshotVisible() {
  const seen = new Set();
  const all = document.querySelectorAll('body *');
  for (let i = 0; i < all.length; i += 1) {
    if (visible(all[i])) seen.add(all[i]);
  }
  return seen;
}

// 一个容器里「同标签同 class 的直接子元素」最多的一组，就是候选条目
export function sameStructureChildren(container) {
  const groups = new Map();
  const kids = container.children || [];
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    if (!visible(child)) continue;
    // 空着的容器也要算进来：多列面板里还没轮到的那几列就是空的
    const text = norm(child.textContent);
    if (text.length > 80) continue;
    const key = child.tagName + '|' + String(child.className || '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(child);
  }
  let best = [];
  groups.forEach((list) => { if (list.length > best.length) best = list; });
  return best;
}

// 在整棵子树里找条目最多的那一组（候选列表常埋在浮层里面几层）
export function candidateItems(root) {
  let best = [];
  let bestScore = -1;
  const nodes = [root];
  const inside = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (let i = 0; i < inside.length; i += 1) nodes.push(inside[i]);
  for (let i = 0; i < nodes.length; i += 1) {
    const items = sameStructureChildren(nodes[i]);
    const texts = items.map((item) => norm(item.textContent)).filter(Boolean);
    if (texts.length < MIN_ITEMS) continue;
    // 一列容器与它里面的条目都是「一组同构元素」，取每条文字更短的那一组
    let total = 0;
    for (let k = 0; k < texts.length; k += 1) total += texts[k].length;
    const score = texts.length * 10 - total / texts.length;
    if (score > bestScore) {
      bestScore = score;
      best = items;
    }
  }
  return best;
}

// 多列面板：面板的直接子元素里有不止一列，每列里都装着自己的条目
export function panelColumns(panel) {
  const cols = sameStructureChildren(panel);
  if (cols.length < 2) return null;
  // 后面几列要等前一级选完才有内容，只要有一列装着条目就够了
  const hasItems = cols.some((col) => sameStructureChildren(col).length > 0);
  if (!hasItems) return null;
  return cols;
}

// 条目内部通常还有一个真正带点击处理的元素（a / button / role=option），
// 点它，事件会冒泡到条目本身；只点条目外层的话，挂在里面的处理收不到
function clickTargetFor(node) {
  const inner = node.querySelector && node.querySelector('a, button, [role="option"], [role="menuitem"]');
  return inner || node;
}

export function pickItem(items, want) {
  const w = norm(want);
  const hits = [];
  for (let i = 0; i < items.length; i += 1) {
    const text = norm(items[i].textContent);
    if (!text) continue;
    let score = 0;
    if (text === w) score = 100;
    else if (text.indexOf(w) >= 0) score = 60;
    else if (w.indexOf(text) >= 0) score = 40;
    if (score) hits.push({ node: items[i], score });
  }
  if (!hits.length) return null;
  let bestScore = 0;
  for (let i = 0; i < hits.length; i += 1) bestScore = Math.max(bestScore, hits[i].score);
  const top = hits.filter((h) => h.score === bestScore).map((h) => h.node);
  // 条目常是「外层格子 + 内层文字」两层，点最内层，事件会冒泡上去
  for (let i = 0; i < top.length; i += 1) {
    const node = top[i];
    if (!top.some((other) => other !== node && node.contains(other))) return clickTargetFor(node);
  }
  return clickTargetFor(top[0]);
}

// 新出现的浮层长这样：里面有输入框，或者已经有一组同结构的条目。
// 候选常常是输入关键词之后才加载的，所以这两条都不能少
function looksLikePanel(node) {
  if (node.querySelector && node.querySelector('input, textarea, [role="option"], [role="listbox"]')) return true;
  return sameStructureChildren(node).length >= MIN_ITEMS;
}

// 容器的整棵子树都是点击之后才出现的
function whollyFresh(node, before) {
  const all = node.querySelectorAll ? node.querySelectorAll('*') : [];
  for (let i = 0; i < all.length; i += 1) {
    if (before.has(all[i])) return false;
  }
  return true;
}

export async function openPanel(el) {
  const before = snapshotVisible();
  clickNode(el);
  for (let round = 0; round < OPEN_ROUNDS; round += 1) {
    await sleep(150);
    const fresh = [];
    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length; i += 1) {
      const node = all[i];
      if (isOurUI(node) || before.has(node) || !visible(node)) continue;
      fresh.push(node);
    }
    // 浮层是「整棵子树都是新的」的那种容器；页面里原本就有的元素还混在里面的不算
    const hits = [];
    for (let i = 0; i < fresh.length; i += 1) {
      const node = fresh[i];
      if (!looksLikePanel(node)) continue;
      if (!whollyFresh(node, before)) continue;
      hits.push(node);
    }
    if (!hits.length) continue;
    // 取最外层：多列面板的每一列也是新的，但它们都装在面板里
    for (let i = 0; i < hits.length; i += 1) {
      const node = hits[i];
      if (!hits.some((other) => other !== node && other.contains(node))) return { panel: node };
    }
    return { panel: hits[0] };
  }
  return null;
}

function searchBoxIn(panel) {
  const list = panel.querySelectorAll('input, textarea');
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (node.readOnly || node.disabled || !visible(node)) continue;
    const type = (node.type || '').toLowerCase();
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file') continue;
    return node;
  }
  return null;
}

// 展示框可能是 input，也可能是 div 做的（role=combobox 那种），两种都认
function shownText(el) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return String(el.value || '');
  return String(el.textContent || '');
}

async function waitPicked(el, want) {
  const w = norm(want);
  for (let i = 0; i < 10; i += 1) {
    await sleep(120);
    const value = norm(shownText(el));
    if (value && value.indexOf(w) >= 0) return true;
  }
  return false;
}

// 返回是否选中。失败时把浮层收起来，不影响后面的字段
export async function fillFloatingPicker(el, value) {
  const want = String(value == null ? '' : value).trim();
  if (!want) return false;
  const opened = await openPanel(el);
  if (!opened) return false;
  const box = searchBoxIn(opened.panel);
  if (box) setVal(box, want);
  for (let round = 0; round < PICK_ROUNDS; round += 1) {
    await sleep(150);
    const hit = pickItem(candidateItems(opened.panel), want);
    if (!hit) continue;
    clickNode(hit);
    if (await waitPicked(el, want)) return true;
    break;
  }
  clickNode(el);
  return false;
}
