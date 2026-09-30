// 需要点「添加」才会出现编辑框的表单：按资料里的段数把区块补足
import { deepQueryAll, isOurUI } from './dom.js';
import { blockContainers } from './blocks.js';
import { GROUP_ARRAYS } from './value.js';

const ADD_RE = /添加|新增|再加|继续添加|增加一条|添加一条|add/i;
const SECTION_RE = {
  edu: /教育|学历|院校|学校/,
  work: /工作|实习|职业/,
  cert: /证书|资格/,
  patent: /专利/,
  paper: /论文|期刊/,
  award: /奖励|奖项|荣誉/,
  family: /家庭|亲属/,
};

export function targetBlockCount(profile, type) {
  const list = profile[GROUP_ARRAYS[type]];
  return Array.isArray(list) ? list.length : 0;
}

function findAddButton(type) {
  const re = SECTION_RE[type];
  const nodes = deepQueryAll('button, a, [role="button"]');
  let loose = null;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (isOurUI(node)) continue;
    const text = String(node.textContent || '').replace(/\s+/g, '');
    if (!text || !ADD_RE.test(text)) continue;
    let cur = node.parentElement;
    for (let depth = 0; depth < 6 && cur; depth += 1) {
      if (re.test(String(cur.textContent || '').slice(0, 400))) return node;
      cur = cur.parentElement;
    }
    if (!loose) loose = node;
  }
  return null;
}

async function waitForGrow(type, before, limit) {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) {
    if (blockContainers(type).length > before) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

// 点「添加」把区块补到资料里的段数，返回实际新增的段数
export async function addMissingBlocks(profile, type) {
  const target = targetBlockCount(profile, type);
  if (target <= 1) return 0;
  let added = 0;
  for (let i = 1; i < target; i += 1) {
    if (blockContainers(type).length >= target) break;
    const btn = findAddButton(type);
    if (!btn) break;
    const before = blockContainers(type).length;
    btn.click();
    if (!await waitForGrow(type, before, 1500)) break;
    added += 1;
  }
  return added;
}
