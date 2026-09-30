// 填充引擎：扫描页面控件，逐个识别字段并写入资料
import { pickKey, norm } from './rules.js';
import { deepQueryAll, labelText, attrText, visibleText, rowContainer, sectionScope, fieldHint, visible, isOurUI } from './dom.js';
import { setVal, bestOptionIndex, isCustomSelect, fillCustomSelect } from './form-control.js';
import { EDU_KEYS, valueForField, matchExtra, formatValue, FIELD_NAMES } from './value.js';

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

export async function runFill(profile, opts) {
  const options = Object.assign({ onlyEmpty: true, autoConsent: false, highlight: true }, opts || {});
  const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0 };
  const nodes = deepQueryAll('input, textarea, select');

  // 教育经历可能有好几段（硕士、本科），数出当前字段属于第几段。
  // 只数同一区块内带教育类字段的行，按纵向位置排序。
  const scopeCache = new Map();
  const eduRowIndex = (el) => {
    const scope = sectionScope(el) || document;
    let rowList = scopeCache.get(scope);
    if (!rowList) {
      const rows = new Map();
      const inside = scope.querySelectorAll ? scope.querySelectorAll('input, textarea, select') : [];
      for (let i = 0; i < inside.length; i += 1) {
        const n = inside[i];
        const k = pickKey({ label: labelText(n), attr: attrText(n), hint: '', allowHint: false });
        if (!k || !EDU_KEYS[k]) continue;
        const r = rowContainer(n);
        if (!rows.has(r)) {
          let top = 0;
          try { top = r.getBoundingClientRect().top; } catch (e) { top = 0; }
          rows.set(r, top);
        }
      }
      rowList = Array.from(rows.entries()).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
      scopeCache.set(scope, rowList);
    }
    const idx = rowList.indexOf(rowContainer(el));
    return idx < 0 ? 1 : idx + 1;
  };

  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    if (isOurUI(el) || shouldSkip(el)) continue;
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
      let key = pickKey({
        label: labelText(sample),
        attr: attrText(sample),
        hint: fieldHint(sample),
        allowHint: false,
      });
      if (!key) {
        key = pickKey({
          label: visibleText(rowContainer(sample), 80),
          attr: '',
          hint: fieldHint(sample),
          allowHint: true,
        });
      }
      if (!key) continue;
      const want = norm(valueForField(key, profile, visibleText(rowContainer(sample), 160), 1));
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
    let key = pickKey({ label, attr, hint: fieldHint(el), allowHint: !label && !attr });
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

    const value = direct ? key.slice(6) : valueForField(key, profile, rowText, EDU_KEYS[key] ? eduRowIndex(el) : 1);
    if (!value) continue;
    if (options.onlyEmpty && alreadyFilled(el)) continue;

    if (el.tagName === 'SELECT') {
      const preferEnrolled = key === 'degree' && /在读|应届/.test(String(profile.degreeNote || '在读'));
      const idx = bestOptionIndex(el, value, preferEnrolled);
      if (idx >= 0) {
        const text = String(el.options[idx].text).trim();
        setVal(el, el.options[idx].value);
        st.count += 1;
        st.filled.push((FIELD_NAMES[key] || '自定义') + ' → ' + text);
        if (options.highlight) highlight(el);
      } else if (isCustomSelect(el)) {
        const ok = await fillCustomSelect(el, value);
        if (ok) { st.count += 1; st.filled.push(FIELD_NAMES[key] || '自定义'); }
        else st.manual.push((FIELD_NAMES[key] || '自定义') + '：下拉框没有合适选项，请手动选');
      } else {
        st.manual.push((FIELD_NAMES[key] || '自定义') + '：下拉框没有合适选项，请手动选');
      }
      continue;
    }

    if (isCustomSelect(el) && el.readOnly) {
      const ok = await fillCustomSelect(el, value);
      if (ok) {
        st.count += 1;
        st.filled.push(FIELD_NAMES[key] || '自定义');
        if (options.highlight) highlight(el);
      } else {
        st.manual.push((FIELD_NAMES[key] || '自定义') + '：自定义下拉框，请手动选');
      }
      continue;
    }

    setVal(el, formatValue(el, value));
    st.count += 1;
    st.filled.push(FIELD_NAMES[key] || '自定义');
    if (options.highlight) highlight(el);
  }

  return st;
}
