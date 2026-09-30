// 经历区块的分段：兄弟块之间字段组合重复，就说明它们是两段经历
import { labelText, attrText, isOurUI } from './dom.js';
import { pickKey } from './rules.js';
import { KEY_GROUPS } from './value.js';

const KEYS_OF = KEY_GROUPS;

export function fieldKeyOf(el, type) {
  if (!el || !el.tagName) return null;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return null;
  if (isOurUI(el)) return null;
  const t = (el.type || '').toLowerCase();
  if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return null;
  const k = pickKey({ label: labelText(el), attr: attrText(el), hint: '', allowHint: false });
  return k && KEYS_OF[type][k] ? k : null;
}

export function fieldsOf(root, type) {
  const out = [];
  if (!root || !root.querySelectorAll) return out;
  if (fieldKeyOf(root, type)) out.push(root);
  const list = root.querySelectorAll('input, textarea, select');
  for (let i = 0; i < list.length; i += 1) {
    if (fieldKeyOf(list[i], type)) out.push(list[i]);
  }
  return out;
}

export function signatureOf(node, type) {
  return fieldsOf(node, type).map((n) => fieldKeyOf(n, type)).sort().join(',');
}

// 往上逐层看：某一层的兄弟块里出现了两组字段组合相同的块，这一层就是「一段」
function repeatedLevel(el, type) {
  let node = el;
  for (let depth = 0; depth < 8 && node && node.parentElement; depth += 1) {
    node = node.parentElement;
    if (!node || node === document.body || node === document.documentElement) break;
    const parent = node.parentElement;
    if (!parent) break;
    const blocks = [];
    for (let i = 0; i < parent.children.length; i += 1) {
      const child = parent.children[i];
      if (fieldsOf(child, type).length) blocks.push(child);
    }
    if (blocks.length > 1) {
      // 两个块里出现同一个字段，说明它们是重复的两段；只是字段各不相同的，是同一段分成几行
      const sigs = blocks.map((b) => fieldsOf(b, type).map((n) => fieldKeyOf(n, type)));
      for (let i = 0; i < sigs.length; i += 1) {
        for (let j = i + 1; j < sigs.length; j += 1) {
          if (sigs[i].some((k) => sigs[j].indexOf(k) >= 0)) return { node, blocks };
        }
      }
    }
  }
  return null;
}

function firstFieldOfType(type) {
  const list = document.querySelectorAll('input, textarea, select');
  for (let i = 0; i < list.length; i += 1) {
    if (fieldKeyOf(list[i], type)) return list[i];
  }
  return null;
}

// 页面上这种经历一共分成几段，返回各个段的容器
export function blockContainers(type) {
  const field = firstFieldOfType(type);
  if (!field) return [];
  const hit = repeatedLevel(field, type);
  return hit ? hit.blocks : [];
}

// 某个字段属于第几段，从 1 开始
export function blockIndexOf(el, type) {
  const hit = repeatedLevel(el, type);
  if (!hit) return 1;
  for (let i = 0; i < hit.blocks.length; i += 1) {
    if (hit.blocks[i] === hit.node || hit.blocks[i].contains(el)) return i + 1;
  }
  return 1;
}
