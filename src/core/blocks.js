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

// 每块只有一个字段时：先看整段的字段序列有没有原样重复一次，再看同一个字段第二次出现的位置
function repeatedBySequence(blocks, sigs) {
  const flat = sigs.map((s) => s[0]);
  const half = Math.floor(flat.length / 2);
  for (let len = 1; len <= half; len += 1) {
    let same = true;
    for (let i = 0; i < len; i += 1) {
      if (flat[i] !== flat[i + len]) { same = false; break; }
    }
    if (!same) continue;
    const out = [];
    for (let i = 0; i < flat.length; i += len) out.push(blocks[i]);
    return out;
  }
  return null;
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
      // 一个字段占一个块的表格：把各块的字段排成一列，找最短的重复周期
      if (sigs.every((s) => s.length === 1)) {
        const bySeq = repeatedBySequence(blocks, sigs);
        if (bySeq) return { node, blocks: bySeq };
      }
      for (let i = 0; i < sigs.length; i += 1) {
        // 一段经历里字段通常不止一个。只凭「有一个字段相同」就把每行当成一段，
        // 会把同一段经历拆成好几段（移动那个页面每个字段各占一个 dl 就是这样）
        if (sigs[i].length < 2) continue;
        // 块里得有至少两个不同的字段。同一批单选框被认成同一个 key 时，
        // 一行一个字段的表格会看着像「重复的经历块」
        const distinct = {};
        sigs[i].forEach((k) => { distinct[k] = 1; });
        if (Object.keys(distinct).length < 2) continue;
        for (let j = i + 1; j < sigs.length; j += 1) {
          if (sigs[i].length !== sigs[j].length) continue;
          if (!sigs[i].every((k) => sigs[j].indexOf(k) >= 0)) continue;
          // 重复出现的经历块，标签与 class 通常也一致。
          // 只比字段组合的话，一行一个字段的表格会被误当成多段经历
          if (blocks[i].tagName !== blocks[j].tagName) continue;
          if (String(blocks[i].className || '') !== String(blocks[j].className || '')) continue;
          return { node, blocks };
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
