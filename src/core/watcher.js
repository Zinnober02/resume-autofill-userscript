// 页面后续出现的区块（点「添加」出现的编辑框、弹窗）出现后自动填一次
import { labelText, attrText, isOurUI } from './dom.js';
import { pickKey } from './rules.js';

const THROTTLE_MS = 600;

function fillableControls(node) {
  const list = [];
  if (!node || node.nodeType !== 1) return list;
  if (node.matches && node.matches('input, textarea, select')) list.push(node);
  if (node.querySelectorAll) {
    const inside = node.querySelectorAll('input, textarea, select');
    for (let i = 0; i < inside.length; i += 1) list.push(inside[i]);
  }
  return list;
}

function hasFillable(node) {
  if (isOurUI(node)) return false;
  const list = fillableControls(node);
  for (let i = 0; i < list.length; i += 1) {
    const el = list[i];
    if (isOurUI(el)) continue;
    const t = (el.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') continue;
    if (pickKey({ label: labelText(el), attr: attrText(el), hint: '', allowHint: false })) return true;
    if (String(el.getAttribute('name') || '').trim()) return true;
  }
  return false;
}

// 返回一个停止观察的函数
export function watchNewBlocks(onNewBlocks) {
  if (typeof MutationObserver !== 'function') return () => {};
  let timer = null;
  const observer = new MutationObserver((records) => {
    let hit = false;
    for (let i = 0; i < records.length && !hit; i += 1) {
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j += 1) {
        if (hasFillable(added[j])) { hit = true; break; }
      }
    }
    if (!hit) return;
    clearTimeout(timer);
    timer = setTimeout(() => { onNewBlocks(); }, THROTTLE_MS);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
