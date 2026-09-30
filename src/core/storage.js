// 资料存储：优先用 Tampermonkey 的 GM_getValue / GM_setValue
import { SEED_PROFILES } from './profile-schema.js';

export const STORE_KEY = 'ra_data_v1';

export function seedData() {
  const profiles = {};
  const names = Object.keys(SEED_PROFILES);
  names.forEach((n) => { profiles[n] = JSON.parse(JSON.stringify(SEED_PROFILES[n])); });
  return { v: 1, current: names[0], profiles };
}

export function loadData() {
  let d = null;
  try { d = GM_getValue(STORE_KEY, null); } catch (e) { d = null; }
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || !d.profiles || !Object.keys(d.profiles).length) d = seedData();
  if (!d.current || !d.profiles[d.current]) d.current = Object.keys(d.profiles)[0];
  return d;
}

export function saveData(d) {
  try { GM_setValue(STORE_KEY, d); } catch (e) { /* 忽略写入失败 */ }
}
