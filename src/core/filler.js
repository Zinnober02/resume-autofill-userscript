// 填充引擎：扫描页面控件，逐个识别字段并写入资料
import { pickKey, norm } from './rules.js';
import {
  deepQueryAll, labelText, attrText, visibleText, rowContainer,
  sectionContainer, sectionBlockType, fieldHint, visible, isOurUI,
} from './dom.js';
import { setVal, bestOptionIndex, isCustomSelect, fillCustomSelect } from './form-control.js';
import {
  groupOf, DATE_KEYS, ADDRESS_KEYS, valueForField, matchExtra, formatValue,
  splitDateTime, FIELD_NAMES,
} from './value.js';
import { splitAddress, addressRole, assignRoles, fillAddressSegment } from './address.js';
import { isSearchSelect, fillSearchSelect } from './search-select.js';
import { fillFloatingPicker } from './floating-picker.js';
import { isDatePicker, fillDatePicker, dateSegmentGroup, writeDateSegment } from './date-widget.js';
import { blockIndexOf } from './blocks.js';

// 右边这类字段要先填左边那个才能填：结束时间要先有开始时间，证件号码要先选证件类型
const PREREQUISITE = {
  eduEnd: 'eduStart',
  workEnd: 'workStart',
  projectEnd: 'projectStart',
  activityEnd: 'activityStart',
  idCard: 'idType',
};

export function describe(el, key) {
  const lb = labelText(el) || (el.getAttribute && el.getAttribute('placeholder')) || key || '';
  return String(lb).replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function shouldSkip(el) {
  if (!el || el.disabled || el.readOnly) return true;
  const t = (el.type || '').toLowerCase();
  if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  return false;
}

export function alreadyFilled(el) {
  if (el.tagName === 'SELECT') {
    return !!(el.value && el.selectedIndex > 0 && String(el.options[el.selectedIndex].text).trim());
  }
  return !!String(el.value || '').trim();
}

export function highlight(el) {
  try {
    const old = el.style.outline;
    el.style.outline = '2px solid #16a34a';
    el.style.outlineOffset = '1px';
    setTimeout(() => { el.style.outline = old; }, 4000);
  } catch (e) { /* 忽略 */ }
}

// 地址下拉按自己的角色取一段：省的框给省，市的框给市，区县的框给区县。
// 看不出角色时（「籍贯」这种整体字段）按省处理
function addressValueFor(el, value) {
  const addr = splitAddress(value);
  const role = addressRole(el);
  if (role === 'city') return addr.city || addr.province;
  if (role === 'district') return addr.district || addr.city || addr.province;
  return addr.province || String(value || '').trim();
}

// 手机号前面常常先有一个国家 / 地区代码下拉，电信上就是这样
function isCountrySelect(el) {
  const text = Array.from(el.options).map((o) => o.textContent).join(' ');
  if (!text) return false;
  return /中国大陆|中国香港|中国澳门|中国台湾|\+86|国家和地区|国家\/地区/.test(text);
}

// 往一个已经识别出字段的控件里写值；选不中或格式不被接受时记进「需要手动处理」
async function applyValue(el, key, value, options, profile, st) {
  const name = FIELD_NAMES[key] || '自定义';
  if (key === 'phone' && el.tagName === 'SELECT' && isCountrySelect(el)) {
    const want = String(profile.phoneCountry || '中国大陆');
    let idx = bestOptionIndex(el, want, false);
    if (idx < 0 && want === '中国大陆') idx = bestOptionIndex(el, '+86', false);
    if (idx >= 0) {
      const text = String(el.options[idx].text).trim();
      setVal(el, el.options[idx].value);
      st.count += 1;
      st.filled.push(name + ' → ' + text);
      if (options.highlight) highlight(el);
    } else {
      st.manual.push(name + '：国家 / 地区代码没有匹配项，请手动选');
    }
    return;
  }
  if (el.tagName === 'SELECT') {
    const preferEnrolled = key === 'degree' && /在读|应届/.test(String(profile.degreeNote || '在读'));
    const want = ADDRESS_KEYS[key] ? addressValueFor(el, value) : value;
    const idx = bestOptionIndex(el, want, preferEnrolled);
    if (idx >= 0) {
      const text = String(el.options[idx].text).trim();
      setVal(el, el.options[idx].value);
      st.count += 1;
      st.filled.push(name + ' → ' + text);
      if (options.highlight) highlight(el);
      if (want !== value) st.manual.push(name + '：这个下拉只到「' + text + '」，后面的部分请手动补全');
      return;
    }
    // 学校、公司这类字段是「点开、输入关键词、再选候选」的控件，直接写值组件不认
    if (isSearchSelect(el)) {
      const search = ADDRESS_KEYS[key] ? addressValueFor(el, value) : value;
      if (await fillSearchSelect(el, search)) {
        st.count += 1;
        st.filled.push(name + ' → ' + search);
        if (options.highlight) highlight(el);
      } else {
        st.manual.push(name + '：可搜索下拉里没有匹配项，请手动选');
      }
      return;
    }
    if (isCustomSelect(el)) {
      const ok = await fillCustomSelect(el, value);
      if (ok) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el);
      } else {
        st.manual.push(name + '：下拉框没有合适选项，请手动选');
      }
      return;
    }
    st.manual.push(name + '：下拉框没有合适选项，请手动选');
    return;
  }

  if (options.fillDatePickers && isDatePicker(el)) {
    const ok = await fillDatePicker(el, value);
    if (ok) {
      st.count += 1;
      st.filled.push(name);
      if (options.highlight) highlight(el);
    } else {
      st.manual.push(name + '：日期选择器没有选上，请手动选');
    }
    return;
  }

  // 只读的输入框：日期控件走日期那一套，其余多半是「点开弹层选候选」的展示框
  if (el.tagName === 'INPUT' && el.readOnly) {
    if (isDatePicker(el)) {
      if (await fillDatePicker(el, value)) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el);
      } else {
        st.manual.push(name + '：日期选择器没有选上，请手动选');
      }
      return;
    }
    if (DATE_KEYS[key]) {
      st.manual.push(name + '：只读的日期控件，请手动选');
      return;
    }
    if (await fillFloatingPicker(el, value)) {
      st.count += 1;
      st.filled.push(name);
      if (options.highlight) highlight(el);
    } else {
      st.manual.push(name + '：弹出层里没有匹配项，请手动选');
    }
    return;
  }

  if (isCustomSelect(el) && el.readOnly) {
    const ok = await fillCustomSelect(el, value);
    if (ok) {
      st.count += 1;
      st.filled.push(name);
      if (options.highlight) highlight(el);
    } else {
      st.manual.push(name + '：自定义下拉框，请手动选');
    }
    return;
  }

  const out = formatValue(el, value, labelText(el));
  if (!out) {
    st.manual.push(name + '：这个控件要填具体时刻，资料里没有，请手动填写');
    return;
  }
  setVal(el, out);
  if (!String(el.value || '').trim()) {
    st.manual.push(name + '：控件不接受这个格式，请手动填写');
    return;
  }
  st.count += 1;
  st.filled.push(name);
  if (options.highlight) highlight(el);
}

// 结束时间往往要参照开始时间，先填同一块里的开始时间
function pairedStart(el, key) {
  const startKey = PREREQUISITE[key];
  if (!startKey) return null;
  const scope = rowContainer(el) || sectionContainer(el);
  if (!scope || !scope.querySelectorAll) return null;
  const list = scope.querySelectorAll('input, select, textarea');
  for (let i = 0; i < list.length; i += 1) {
    const n = list[i];
    if (n === el) break;
    if (isOurUI(n) || shouldSkip(n) || alreadyFilled(n)) continue;
    const k = pickKey({
      label: labelText(n),
      attr: attrText(n),
      block: sectionBlockType(n),
      hint: fieldHint(n),
      allowHint: false,
    });
    if (k === startKey) return { node: n, key: k };
  }
  return null;
}

export async function runFill(profile, opts) {
  const options = Object.assign({ onlyEmpty: true, autoConsent: false, highlight: true, fillDatePickers: true }, opts || {});
  const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0 };
  const nodes = deepQueryAll('input, textarea, select');
  const handled = new Set();
  const segments = new Map();

  const skipNode = (el) => {
    if (isOurUI(el) || el.disabled) return true;
    const t = (el.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    // 页面上看不见的控件不填：弹层里的搜索框、隐藏的模型输入框都在这一类。
    // 只读的输入框不在这里排除，它可能是「点开才出候选」的展示框
    if (!visible(el)) return true;
    return false;
  };

  // 教育、工作经历可能有好几段，数出当前字段属于第几段
  const indexCache = new Map();
  const rowIndexOf = (el, key) => {
    const group = groupOf(key);
    if (!group) return 1;
    if (!indexCache.has(el)) indexCache.set(el, blockIndexOf(el, group));
    return indexCache.get(el);
  };

  const segmentOf = (el) => {
    const row = rowContainer(el);
    if (!row) return null;
    if (!segments.has(row)) segments.set(row, dateSegmentGroup(el));
    return segments.get(row);
  };

  // 一栏里连续的同类控件看成一组：地址字段常是一串下拉，
  // 其中第一级往往没有字段名（电信那个 firstLevl 就是），只能靠同组的兄弟认出来
  const classifyCache = new Map();
  const classifyIn = (scope) => {
    if (classifyCache.has(scope)) return classifyCache.get(scope);
    const out = [];
    const list = scope.querySelectorAll('input, select');
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (isOurUI(node) || node.disabled) continue;
      const t = (node.type || '').toLowerCase();
      if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') continue;
      if (t === 'file' || t === 'checkbox' || t === 'radio') continue;
      out.push({
        node,
        key: pickKey({ label: labelText(node), attr: attrText(node), block: sectionBlockType(node), hint: '', allowHint: false }),
      });
    }
    classifyCache.set(scope, out);
    return out;
  };

  const addressGroupCache = new Map();
  const addressGroupAt = (el) => {
    if (addressGroupCache.has(el)) return addressGroupCache.get(el);
    const result = computeAddressGroup(el);
    addressGroupCache.set(el, result);
    return result;
  };

  const computeAddressGroup = (el) => {
    const scope = sectionContainer(el) || rowContainer(el) || document;
    const list = classifyIn(scope);
    const idx = list.findIndex((item) => item.node === el);
    if (idx < 0) return null;
    const tag = el.tagName;
    let start = idx;
    let end = idx;
    while (start > 0 && list[start - 1].node.tagName === tag) start -= 1;
    while (end < list.length - 1 && list[end + 1].node.tagName === tag) end += 1;
    const seg = list.slice(start, end + 1);
    let groupKey = '';
    for (let i = 0; i < seg.length; i += 1) {
      if (seg[i].key && ADDRESS_KEYS[seg[i].key]) { groupKey = seg[i].key; break; }
    }
    if (!groupKey) return null;
    // 组里只留「没有字段名的」和「就是这一个地址字段的」，别把旁边的学历、性别也拉进来
    const nodes = seg.filter((item) => !item.key || item.key === groupKey).map((item) => item.node);
    if (!nodes.length || nodes.length > 3) return null;
    return { key: groupKey, nodes, roles: assignRoles(nodes) };
  };

  // 省 / 市 / 区分开的下拉或输入框：整组一起填，选完一级等下一级的选项出来
  const fillAddressGroup = async (group, key) => {
    const name = FIELD_NAMES[key] || key;
    const address = splitAddress(valueForField(key, profile, 1));
    if (!address.province && !address.city) return false;
    const res = await fillAddressSegment(group, address);
    group.nodes.forEach((n) => handled.add(n));
    if (res.written) {
      st.count += res.written;
      st.filled.push(name + '（省 / 市 / 区分开填写）');
      if (options.highlight) group.nodes.forEach((n) => highlight(n));
    }
    if (res.blocked) st.manual.push(name + '：省 / 市 / 区控件没有能选中的值，请手动选');
    return res.written > 0 || res.blocked > 0;
  };

  // 年 / 月 / 日 分开的下拉框或输入框：整组一起写
  const fillSegment = (el, group, rowKey) => {
    const date = splitDateTime(valueForField(rowKey, profile, rowIndexOf(el, rowKey)));
    if (!date) return false;
    const name = FIELD_NAMES[rowKey] || rowKey;
    let written = 0;
    let blocked = 0;
    for (let i = 0; i < group.nodes.length; i += 1) {
      const node = group.nodes[i];
      handled.add(node);
      if (options.onlyEmpty && alreadyFilled(node)) continue;
      if (writeDateSegment(node, group.roles[i], date)) written += 1;
      else blocked += 1;
    }
    if (written) {
      st.count += written;
      st.filled.push(name + '（年/月/日分开填写）');
      if (options.highlight) group.nodes.forEach((n) => highlight(n));
    }
    if (blocked) st.manual.push(name + '：年/月/日控件没有能选中的值，请手动选');
    return written > 0 || blocked > 0;
  };

  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    if (handled.has(el) || skipNode(el)) continue;
    const type = (el.type || '').toLowerCase();

    if (type === 'file') {
      if (visible(el)) st.manual.push('手动上传文件：' + describe(el));
      continue;
    }

    if (type === 'checkbox') {
      const nm = norm(labelText(el) + ' ' + attrText(el));
      if (options.autoConsent && !el.checked && /我已阅读|同意|接受|隐私政策|服务条款|agree|consent|accept/.test(nm)) {
        el.click();
        st.count += 1;
        st.filled.push('勾选：' + describe(el));
      }
      continue;
    }

    if (type === 'radio') {
      const gname = el.name || ('__radio_' + i);
      if (st.radioDone[gname]) continue;
      st.radioDone[gname] = 1;
      const all = [el];
      for (let k = 0; k < nodes.length; k += 1) {
        const n = nodes[k];
        if (n !== el && (n.type || '').toLowerCase() === 'radio' && n.name === el.name) all.push(n);
      }
      if (all.some((n) => n.checked) && options.onlyEmpty) continue;
      const sample = all[0];
      // 单选按钮自己的文字是「男/女」，组名要从整行文字里找
      const sampleBlock = sectionBlockType(sample);
      let key = pickKey({
        label: labelText(sample),
        attr: attrText(sample),
        block: sampleBlock,
        hint: fieldHint(sample),
        allowHint: false,
      });
      if (!key) {
        key = pickKey({
          label: visibleText(rowContainer(sample), 80),
          attr: '',
          block: sampleBlock,
          hint: fieldHint(sample),
          allowHint: true,
        });
      }
      if (!key) continue;
      const want = norm(valueForField(key, profile, 1));
      if (!want) continue;
      let hit = null;
      for (let k = 0; k < all.length; k += 1) {
        const n = all[k];
        const own = norm(labelText(n) + ' ' + visibleText(n.parentElement, 50) + ' ' + (n.value || ''));
        if (own && (own === want || own.indexOf(want) >= 0)) { hit = n; break; }
      }
      if (hit) {
        hit.click();
        st.count += 1;
        st.filled.push(FIELD_NAMES[key] || key);
        if (options.highlight) highlight(hit);
      }
      continue;
    }

    const label = labelText(el);
    const attr = attrText(el);
    const rowText = visibleText(rowContainer(el), 160);
    const block = sectionBlockType(el);

    // 分段的控件（年 / 月 / 日、省 / 市 / 区）要整组一起处理：
    // 单个控件只知道自己的角色，资料里的完整值要在组内拆开
    const rowKey = pickKey({ label: rowText, attr: '', block, hint: fieldHint(el), allowHint: true });
    if (rowKey && DATE_KEYS[rowKey]) {
      const segGroup = segmentOf(el);
      if (segGroup && fillSegment(el, segGroup, rowKey)) continue;
    }
    let key = pickKey({ label, attr, block, hint: fieldHint(el), allowHint: !label && !attr });

    // 地址字段先当成一组处理：第一级那个下拉往往没有字段名，单独看是认不出来的。
    // 组里只有一个控件、而且它自己有字段名时，交回下面按普通字段处理
    const addrGroup = addressGroupAt(el);
    if (addrGroup && (addrGroup.nodes.length > 1 || !key)) {
      if (await fillAddressGroup(addrGroup, addrGroup.key)) continue;
    }

    let direct = false;
    if (!key) {
      const ex = matchExtra(profile, label, attr, rowText);
      if (ex) { key = ex; direct = true; }
    }

    if (!key) {
      if (visible(el) && !alreadyFilled(el)) {
        const d = describe(el) || attr.slice(0, 30);
        if (d && st.unknown.indexOf(d) < 0) st.unknown.push(d);
      }
      continue;
    }

    const value = direct ? key.slice(6) : valueForField(key, profile, rowIndexOf(el, key));
    if (!value) continue;

    const pair = pairedStart(el, key);
    if (pair && !alreadyFilled(pair.node)) {
      const pairValue = valueForField(pair.key, profile, rowIndexOf(pair.node, pair.key));
      if (pairValue) await applyValue(pair.node, pair.key, pairValue, options, profile, st);
    }

    if (options.onlyEmpty && alreadyFilled(el)) continue;
    await applyValue(el, key, value, options, profile, st);
  }

  return st;
}
