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
import { cascadeValues, valueForRole, addressRole, ROLE_NAMES } from './address.js';
import {
  detectCascade, hasVisibleMirror, fillCascade, fillCascadePanel,
} from './cascade.js';
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

// 有的表单把提示文字直接写在 value 里，没有 placeholder 属性。
// 这类内容不算已经填过，否则「只填空白字段」会把整页字段都跳过去
const HINT_RE = /^(请输入|请填写|请选择|请上传|输入|填写|选择|上传|字数控制在|只支持|支持)/;

function isHintText(el, value) {
  const placeholder = String(el.getAttribute('placeholder') || '').trim();
  if (placeholder && value === placeholder) return true;
  if (el.getAttribute('data-noevent') !== null && HINT_RE.test(value)) return true;
  return HINT_RE.test(value);
}

export function alreadyFilled(el) {
  if (el.tagName === 'SELECT') {
    return !!(el.value && el.selectedIndex > 0 && String(el.options[el.selectedIndex].text).trim());
  }
  const value = String(el.value || '').trim();
  if (!value) return false;
  return !isHintText(el, value);
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
function roleText(list) {
  return list.map((role) => ROLE_NAMES[role] || role).join(' / ');
}

function addressValueFor(el, value) {
  const values = cascadeValues(value);
  return valueForRole(values, addressRole(el) || 'province') || values.raw;
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

  // 不是表单控件做成的下拉（div 加 role=combobox 那类）：点开浮层选候选
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') {
    if (await fillFloatingPicker(el, value)) {
      st.count += 1;
      st.filled.push(name);
      if (options.highlight) highlight(el);
    } else {
      st.manual.push(name + '：弹出层里没有匹配项，请手动选');
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
    // 地址类字段在只读框上可能是「一列一级」的多级面板
    if (ADDRESS_KEYS[key]) {
      const panelRes = await fillCascadePanel(el, cascadeValues(value), { timeout: 2500 });
      if (panelRes.written) {
        st.count += panelRes.written;
        st.filled.push(name);
        if (options.highlight) highlight(el);
        if (panelRes.missing.length) st.manual.push(name + '：' + roleText(panelRes.missing) + ' 请手动补全');
        return;
      }
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
  const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0, skipped: 0 };
  const nodes = deepQueryAll('input, textarea, select, [role="combobox"]');
  const handled = new Set();
  const segments = new Map();

  const skipNode = (el) => {
    if (isOurUI(el) || el.disabled) return true;
    const t = (el.type || '').toLowerCase();
    if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    // 页面上看不见的控件不填：弹层里的搜索框、隐藏的模型输入框都在这一类。
    // 只读的输入框不在这里排除，它可能是「点开才出候选」的展示框
    if (!visible(el)) {
      // 组件把原生控件藏起来、只留自己那个按钮时，这个控件仍然要处理
      if (hasVisibleMirror(el)) return false;
      return true;
    }
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

  // 同一个栏容器编号，用来判断「同名字段在这一栏里是不是第二次出现」
  const scopeIds = new WeakMap();
  let scopeSeq = 0;
  const scopeIdOf = (node) => {
    if (!scopeIds.has(node)) { scopeSeq += 1; scopeIds.set(node, scopeSeq); }
    return scopeIds.get(node);
  };
  const claimed = new Set();
  const isRepeatInSection = (el, key) => {
    if (!groupOf(key)) return false;
    const scope = sectionContainer(el) || rowContainer(el);
    if (!scope) return false;
    const stamp = scopeIdOf(scope) + '|' + key + '|' + rowIndexOf(el, key);
    if (claimed.has(stamp)) return true;
    claimed.add(stamp);
    return false;
  };

  const segmentOf = (el) => {
    const row = rowContainer(el);
    if (!row) return null;
    if (!segments.has(row)) segments.set(row, dateSegmentGroup(el));
    return segments.get(row);
  };


  // 分级字段（省 / 市 / 区县这类）走四段管线：认组、分角色、逐级驱动、等就绪
  const cascadeKeyCache = new Map();
  const classifyForCascade = (node) => {
    if (cascadeKeyCache.has(node)) return cascadeKeyCache.get(node);
    const k = pickKey({
      label: labelText(node),
      attr: attrText(node),
      block: sectionBlockType(node),
      hint: '',
      allowHint: false,
    });
    cascadeKeyCache.set(node, k);
    return k;
  };

  const runCascade = async (group) => {
    const label = FIELD_NAMES[group.key] || group.key;
    const values = cascadeValues(valueForField(group.key, profile, 1));
    if (!values.province && !values.city && !values.raw) return false;
    const res = await fillCascade(group, values, { timeout: 6000 });
    group.nodes.forEach((n) => handled.add(n));
    if (res.written) {
      st.count += res.written;
      st.filled.push(label + '（分级选择）');
      if (options.highlight) group.nodes.forEach((n) => highlight(n));
    }
    if (res.blocked.length) st.manual.push(label + '：' + roleText(res.blocked) + ' 没有选中，请手动选');
    if (res.missing.length) st.manual.push(label + '：这一栏没有 ' + roleText(res.missing) + ' 控件，请手动补全');
    return res.written > 0 || res.blocked.length > 0 || res.missing.length > 0;
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
      if (options.onlyEmpty && alreadyFilled(node)) { st.skipped += 1; continue; }
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
      if (all.some((n) => n.checked) && options.onlyEmpty) { st.skipped += 1; continue; }
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

    // 分级字段先按一组处理：第一级那个下拉往往没有字段名，单独看认不出来。
    // 组里只有一个控件、而且它自己有字段名时，交回下面按普通字段处理
    const cascade = detectCascade(el, classifyForCascade);
    if (cascade && (cascade.nodes.length > 1 || !key)) {
      if (await runCascade(cascade)) continue;
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
    // 一栏里同一个字段出现第二次（例如「双学位」那组又有一个专业名称），
    // 而这一栏又认不出经历分段时，只填第一次出现的那个，避免把第一段的值抄进第二组
    if (isRepeatInSection(el, key)) continue;

    const pair = pairedStart(el, key);
    if (pair && !alreadyFilled(pair.node)) {
      const pairValue = valueForField(pair.key, profile, rowIndexOf(pair.node, pair.key));
      if (pairValue) await applyValue(pair.node, pair.key, pairValue, options, profile, st);
    }

    if (options.onlyEmpty && alreadyFilled(el)) { st.skipped += 1; continue; }
    await applyValue(el, key, value, options, profile, st);
  }

  return st;
}
