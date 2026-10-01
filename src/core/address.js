// 地址：省 / 市 / 区 三级。资料里存整串（浙江省杭州市西湖区），
// 填充时看控件粒度：三个下拉就分开填，单个输入框就整串填
import { norm } from './rules.js';
import { sleep, labelText, attrText, rowContainer, isOurUI } from './dom.js';
import { setVal, bestOptionIndex } from './form-control.js';
import { isSearchSelect, fillSearchSelect } from './search-select.js';
import { REGIONS } from './regions.js';

// 把内置行政区划里三级的名字分别收成集合：判断一个下拉装的是哪一级，
// 看它的选项内容命中哪一级的名字，与网页怎么命名、控件怎么排都无关
const PROVINCE_NAMES = new Set();
const CITY_NAMES = new Set();
const DISTRICT_NAMES = new Set();
(function buildRegionNames() {
  const provinces = REGIONS['86'] || {};
  Object.keys(provinces).forEach((code) => {
    PROVINCE_NAMES.add(norm(provinces[code]));
    const cities = REGIONS[code] || {};
    Object.keys(cities).forEach((cityCode) => {
      CITY_NAMES.add(norm(cities[cityCode]));
      const districts = REGIONS[cityCode] || {};
      Object.keys(districts).forEach((areaCode) => {
        DISTRICT_NAMES.add(norm(districts[areaCode]));
      });
    });
  });
})();

// 看选项里装的是省名、市名还是区县名
export function regionLevelOf(node) {
  if (!node || node.tagName !== 'SELECT' || !node.options) return '';
  const texts = [];
  for (let i = 0; i < node.options.length; i += 1) {
    const t = norm(node.options[i].textContent);
    if (t) texts.push(t);
  }
  if (texts.length < 2) return '';
  let province = 0;
  let city = 0;
  let district = 0;
  texts.forEach((t) => {
    if (PROVINCE_NAMES.has(t)) province += 1;
    if (CITY_NAMES.has(t)) city += 1;
    if (DISTRICT_NAMES.has(t)) district += 1;
  });
  const best = Math.max(province, city, district);
  if (best < 2) return '';
  if (best === province) return 'province';
  if (best === city) return 'city';
  return 'district';
}

const PROVINCE_RE = /^(北京市|上海市|天津市|重庆市|.{2,10}?(?:省|自治区|特别行政区))/;
const CITY_RE = /^(.{2,10}?(?:市|自治州|地区|盟))/;
const AREA_RE = /^(.{1,12}?(?:自治县|自治旗|区|县|旗|市))/;

// 把整串地址拆成省、市、区与剩下的详细地址
export function splitAddress(value) {
  let rest = String(value == null ? '' : value).trim();
  const out = { province: '', city: '', district: '', detail: '' };
  const m1 = rest.match(PROVINCE_RE);
  if (m1) {
    out.province = m1[1];
    rest = rest.slice(out.province.length).trim();
  }
  const m2 = rest.match(CITY_RE);
  if (m2) {
    out.city = m2[1];
    rest = rest.slice(out.city.length).trim();
  }
  const m3 = rest.match(AREA_RE);
  if (m3) {
    out.district = m3[1];
    rest = rest.slice(out.district.length).trim();
  }
  out.detail = rest;
  return out;
}

// 只收省或只收市的下拉：按控件粒度给值
export function addressRole(el) {
  const label = norm(labelText(el));
  const attr = norm(String(el.getAttribute('name') || '') + String(el.getAttribute('id') || '') + String(el.getAttribute('placeholder') || ''));
  if (/province|sheng/.test(attr)) return 'province';
  if (/city|shi/.test(attr)) return 'city';
  if (/district|area|county|qu|area/.test(attr)) return 'district';
  if (/^省$|省份|所在省|请选择省/.test(label)) return 'province';
  if (/^市$|所在市|请选择市/.test(label)) return 'city';
  if (/^区$|^县$|区县|所在区|请选择区|请选择县/.test(label)) return 'district';
  return '';
}

const ADDRESS_ROLES = ['province', 'city', 'district'];

// 一组地址控件里谁管哪一级：自己能看出角色的按自己的，
// 看不出来的按先后顺序补（第一级是省，第二级是市，第三级是区县）
export function assignRoles(nodes) {
  const roles = nodes.map((node) => addressRole(node) || regionLevelOf(node));
  const taken = {};
  roles.forEach((role) => { if (role) taken[role] = 1; });
  const free = ADDRESS_ROLES.filter((role) => !taken[role]);
  for (let i = 0; i < roles.length; i += 1) {
    if (!roles[i]) roles[i] = free.shift() || '';
  }
  return roles;
}

function usable(node) {
  if (!node || !node.tagName) return false;
  if (node.disabled || node.readOnly) return false;
  if ((node.type || '').toLowerCase() === 'hidden') return false;
  return !isOurUI(node);
}

// 同一行里的省 / 市 / 区控件组成一组
export function addressSegmentGroup(el) {
  const row = rowContainer(el);
  if (!row || !row.querySelectorAll) return null;
  const nodes = [];
  const inside = row.querySelectorAll('input, select');
  for (let i = 0; i < inside.length; i += 1) {
    if (usable(inside[i])) nodes.push(inside[i]);
  }
  if (nodes.length < 2 || nodes.length > 3) return null;
  const roles = nodes.map((node) => addressRole(node));
  const taken = {};
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] && !taken[roles[i]]) taken[roles[i]] = 1;
    else roles[i] = '';
  }
  const fallback = nodes.length === 3 ? ['province', 'city', 'district'] : ['province', 'city'];
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i]) continue;
    const pick = fallback.filter((r) => !taken[r])[0];
    if (!pick) return null;
    roles[i] = pick;
    taken[pick] = 1;
  }
  if (!taken.province || !taken.city) return null;
  return { row, nodes, roles };
}

// 省选完之后市的选项才会出来，选不中时等一会儿再试
async function bestOptionWithWait(select, want, tries) {
  const rounds = tries || 4;
  for (let i = 0; i < rounds; i += 1) {
    const idx = bestOptionIndex(select, want, false);
    if (idx >= 0) return idx;
    await sleep(200);
  }
  return -1;
}

export async function fillAddressSegment(group, address) {
  let written = 0;
  let blocked = 0;
  for (let i = 0; i < group.nodes.length; i += 1) {
    const node = group.nodes[i];
    const want = address[group.roles[i]];
    if (!want) continue;
    if (node.tagName === 'SELECT') {
      const idx = await bestOptionWithWait(node, want);
      if (idx >= 0) {
        setVal(node, node.options[idx].value);
      } else if (isSearchSelect(node) && await fillSearchSelect(node, want)) {
        // 候选要拿关键词去后端换的下拉
      } else {
        blocked += 1;
        continue;
      }
    } else {
      setVal(node, want);
    }
    written += 1;
    await sleep(150);
  }
  return { written, blocked };
}
