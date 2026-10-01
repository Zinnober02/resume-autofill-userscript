// 行政区名的归一化与层级判断。
// 归一化把「北京市」与「北京」、「内蒙古自治区」与「内蒙古」看成同一个名字，
// 层级判断则看一个下拉里装的是省名、市名还是区县名
import { norm } from './rules.js';
import { REGIONS } from './regions.js';

const SUFFIXES = [
  '特别行政区', '自治区', '自治州', '自治县', '自治旗',
  '维吾尔', '壮族', '回族', '藏族', '蒙古族', '土家族', '苗族', '侗族',
  '布依族', '彝族', '白族', '傣族', '哈尼族', '朝鲜族', '满族', '哈萨克',
  '地区', '省', '市', '区', '县', '盟', '旗',
].map((s) => norm(s));

// 反复剥掉末尾的行政后缀，直到剥不动为止
export function normalizeRegion(name) {
  let text = norm(name);
  if (!text) return '';
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < SUFFIXES.length; i += 1) {
      const suffix = SUFFIXES[i];
      if (suffix && text.length > suffix.length && text.endsWith(suffix)) {
        text = text.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return text;
}

// 别名表：全名与去掉行政后缀的简称都指向全名，资料里写「浙江」也能对上「浙江省」
const PROVINCE_ALIASES = new Map();
const CITY_ALIASES = new Map();
const DISTRICT_ALIASES = new Map();

function addAlias(map, full) {
  if (!full) return;
  map.set(full, full);
  const short = normalizeRegion(full);
  if (short && !map.has(short)) map.set(short, full);
}

export function provinceAliases() { return PROVINCE_ALIASES; }
export function cityAliases() { return CITY_ALIASES; }
export function districtAliases() { return DISTRICT_ALIASES; }

const PROVINCE_NAMES = new Set();
const CITY_NAMES = new Set();
const DISTRICT_NAMES = new Set();
(function buildRegionNames() {
  const provinces = REGIONS['86'] || {};
  Object.keys(provinces).forEach((provinceCode) => {
    PROVINCE_NAMES.add(normalizeRegion(provinces[provinceCode]));
    addAlias(PROVINCE_ALIASES, provinces[provinceCode]);
    const cities = REGIONS[provinceCode] || {};
    Object.keys(cities).forEach((cityCode) => {
      CITY_NAMES.add(normalizeRegion(cities[cityCode]));
      addAlias(CITY_ALIASES, cities[cityCode]);
      const districts = REGIONS[cityCode] || {};
      Object.keys(districts).forEach((areaCode) => {
        DISTRICT_NAMES.add(normalizeRegion(districts[areaCode]));
        addAlias(DISTRICT_ALIASES, districts[areaCode]);
      });
    });
  });
})();

// 看选项里装的是省名、市名还是区县名。选项少于两个说明还没加载，判不出来
export function regionLevelOf(node) {
  if (!node || node.tagName !== 'SELECT' || !node.options) return '';
  const texts = [];
  for (let i = 0; i < node.options.length; i += 1) {
    const t = normalizeRegion(node.options[i].textContent);
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


