// 资料存储：优先用 Tampermonkey 的 GM_getValue / GM_setValue
import { SEED_PROFILES } from './profile-schema.js';

export const STORE_KEY = 'ra_data_v1';

export function seedData() {
  const profiles = {};
  const names = Object.keys(SEED_PROFILES);
  names.forEach((n) => { profiles[n] = JSON.parse(JSON.stringify(SEED_PROFILES[n])); });
  return { v: 1, current: names[0], profiles };
}

// 结构必须完整：缺 educations / works / extra 的资料直接报错，不做补齐
export function assertData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('不是 json 对象');
  if (!d.profiles || typeof d.profiles !== 'object' || !Object.keys(d.profiles).length) throw new Error('没有 profiles');
  Object.keys(d.profiles).forEach((name) => {
    const p = d.profiles[name];
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('方案「' + name + '」不是对象');
    if (!Array.isArray(p.educations)) throw new Error('方案「' + name + '」缺 educations 数组');
    if (!Array.isArray(p.works)) throw new Error('方案「' + name + '」缺 works 数组');
    if (!Array.isArray(p.extra)) throw new Error('方案「' + name + '」缺 extra 数组');
  });
  if (!d.current || !d.profiles[d.current]) d.current = Object.keys(d.profiles)[0];
  return d;
}

export function loadData() {
  let d = null;
  try { d = GM_getValue(STORE_KEY, null); } catch (e) { d = null; }
  if (typeof d === 'string') d = JSON.parse(d);
  if (!d) return seedData();
  return assertData(d);
}

export function saveData(d) {
  try { GM_setValue(STORE_KEY, d); } catch (e) { /* 忽略写入失败 */ }
}
