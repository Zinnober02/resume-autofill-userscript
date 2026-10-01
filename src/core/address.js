// 地址值：整串与省 / 市 / 区县之间的换算，以及每个控件该拿哪一段
import { norm } from './rules.js';
import { labelText, attrText } from './dom.js';
import { regionLevelOf, provinceAliases, cityAliases, districtAliases } from './region-names.js';

const PROVINCE_RE = /^(北京市|上海市|天津市|重庆市|.{2,10}?(?:省|自治区|特别行政区))/;
const CITY_RE = /^(.{2,10}?(?:市|自治州|地区|盟))/;
const AREA_RE = /^(.{1,12}?(?:自治县|自治旗|区|县|旗|市))/;

// 开头这一段在这一级能对上的所有可能（可能不止一种长度）
function levelCandidates(text, aliases) {
  const out = [];
  const limit = Math.min(text.length, 12);
  for (let len = limit; len >= 2; len -= 1) {
    const full = aliases.get(text.slice(0, len));
    if (full) out.push({ full, length: len });
  }
  return out;
}

// 按后缀正则切一份，用于数据里查不到的名字
function splitByPattern(text) {
  const out = { province: '', city: '', district: '', detail: '' };
  let rest = text;
  const m1 = rest.match(PROVINCE_RE);
  if (m1) { out.province = m1[1]; rest = rest.slice(m1[1].length).trim(); }
  const m2 = rest.match(CITY_RE);
  if (m2) { out.city = m2[1]; rest = rest.slice(m2[1].length).trim(); }
  const m3 = rest.match(AREA_RE);
  if (m3) { out.district = m3[1]; rest = rest.slice(m3[1].length).trim(); }
  out.detail = rest;
  return out;
}

// 把整串地址拆成省、市、区与剩下的详细地址。
// 三级一起比较，哪一组的切分切下来的名字最长就用哪一组，
// 「北京市朝阳区」这样带歧义的串才不会把「朝阳」当成市
export function splitAddress(value) {
  const text = String(value == null ? '' : value).trim();
  const out = { province: '', city: '', district: '', detail: text };
  if (!text) return out;
  const none = { full: '', length: 0 };
  let best = null;
  levelCandidates(text, provinceAliases()).concat([none]).forEach((p) => {
    const afterP = text.slice(p.length);
    levelCandidates(afterP, cityAliases()).concat([none]).forEach((c) => {
      const afterC = afterP.slice(c.length);
      levelCandidates(afterC, districtAliases()).concat([none]).forEach((a) => {
        const total = p.length + c.length + a.length;
        if (!best || total > best.total) best = { p, c, a, total };
      });
    });
  });
  if (!best || best.total === 0) return splitByPattern(text);
  out.province = best.p.full;
  out.city = best.c.full;
  out.district = best.a.full;
  out.detail = text.slice(best.total).trim();
  return out;
}

// 控件自己写明的层级：标签写着「省 / 市 / 区」，或者 name、id、placeholder 里带层级词
export function addressRole(el) {
  const label = norm(labelText(el));
  const attr = norm(String(el.getAttribute('name') || '') + String(el.getAttribute('id') || '') + String(el.getAttribute('placeholder') || ''));
  if (/province|sheng/.test(attr)) return 'province';
  if (/city|shi/.test(attr)) return 'city';
  if (/district|area|county|qu/.test(attr)) return 'district';
  if (/^省$|省份|所在省|请选择省/.test(label)) return 'province';
  if (/^市$|所在市|请选择市/.test(label)) return 'city';
  if (/^区$|^县$|区县|所在区|请选择区|请选择县/.test(label)) return 'district';
  return '';
}

// 命名里的分级线索，只在前面两条都判不出来时作参考
export function levelHintOf(el) {
  const text = norm(String(el.id || '') + ' ' + String(el.getAttribute('name') || ''));
  if (/firstlevl|firstlevel|level1|parent|province/.test(text)) return 'province';
  if (/secondlevl|secondlevel|level2|child|city/.test(text)) return 'city';
  if (/thirdlevl|thirdlevel|level3|district|county|area/.test(text)) return 'district';
  return '';
}

export const ADDRESS_ROLES = ['province', 'city', 'district'];

// 一组控件里谁管哪一级：自己能看出来的按自己的，看不出来的按顺序补
export function assignRoles(nodes) {
  const roles = [];
  const taken = {};
  nodes.forEach((node) => {
    const guess = addressRole(node) || regionLevelOf(node) || levelHintOf(node);
    // 一级只认一个控件：两个下拉装的是同一批地名时（直辖市常见），第二个留给下一级
    if (guess && !taken[guess]) {
      taken[guess] = 1;
      roles.push(guess);
    } else {
      roles.push('');
    }
  });
  const free = ADDRESS_ROLES.filter((role) => !taken[role]);
  for (let i = 0; i < roles.length; i += 1) {
    if (!roles[i]) roles[i] = free.shift() || '';
  }
  return roles;
}

const MUNICIPALITIES = ['北京', '上海', '天津', '重庆'];

export function isMunicipality(name) {
  const t = norm(name);
  if (!t) return false;
  return MUNICIPALITIES.some((m) => t.indexOf(m) === 0);
}

// 某一级该填什么。直辖市的市级就是它自己；资料里没有这一段就返回空，不跨级拿别的顶上
export function valueForRole(values, role) {
  if (!values) return '';
  if (role === 'province') return values.province || '';
  if (role === 'city') return values.city || (isMunicipality(values.province) ? values.province : '');
  if (role === 'district') return values.district || '';
  return '';
}

// 资料里的整串地址转成分级的值
export function cascadeValues(raw) {
  const addr = splitAddress(raw);
  return { province: addr.province, city: addr.city, district: addr.district, detail: addr.detail, raw: String(raw == null ? '' : raw) };
}

export const ROLE_NAMES = { province: '省', city: '市', district: '区 / 县' };
