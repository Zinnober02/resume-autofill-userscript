// 资料存储：优先用 Tampermonkey 的 GM_getValue / GM_setValue
import { SEED_PROFILES } from './profile-schema.js';

export const STORE_KEY = 'ra_data_v1';

export function seedData() {
  const profiles = {};
  const names = Object.keys(SEED_PROFILES);
  names.forEach((n) => { profiles[n] = JSON.parse(JSON.stringify(SEED_PROFILES[n])); });
  return { v: 1, current: names[0], profiles };
}

// 旧文件里没有多段经历数组，读进来时补上，其余字段原样保留
export function normalizeData(d) {
  Object.keys(d.profiles).forEach((name) => {
    const p = d.profiles[name];
    if (!p || typeof p !== 'object') { d.profiles[name] = seedData().profiles['默认']; return; }
    if (!Array.isArray(p.educations)) p.educations = [];
    if (!Array.isArray(p.works)) p.works = [];
    if (!Array.isArray(p.extra)) p.extra = [];
  });
  return d;
}

export function loadData() {
  let d = null;
  try { d = GM_getValue(STORE_KEY, null); } catch (e) { d = null; }
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || !d.profiles || !Object.keys(d.profiles).length) d = seedData();
  if (!d.current || !d.profiles[d.current]) d.current = Object.keys(d.profiles)[0];
  return normalizeData(d);
}

export function saveData(d) {
  try { GM_setValue(STORE_KEY, d); } catch (e) { /* 忽略写入失败 */ }
}
