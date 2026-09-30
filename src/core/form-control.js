// 往控件里写值：原生 setter、下拉框选项匹配、自定义下拉框
import { norm } from './rules.js';
import { sleep, deepQueryAll, visible } from './dom.js';

// 直接改 value 属性 React 不会认，必须走原生 setter 再派发事件
export function setVal(el, value) {
  let proto = HTMLInputElement.prototype;
  if (el instanceof HTMLTextAreaElement) proto = HTMLTextAreaElement.prototype;
  else if (el instanceof HTMLSelectElement) proto = HTMLSelectElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function bestOptionIndex(select, want, preferEnrolled) {
  const w = norm(want);
  if (!w) return -1;
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < select.options.length; i += 1) {
    const o = select.options[i];
    const t = norm(o.text || o.value || '');
    if (!t) continue;
    let s = 0;
    if (t === w) s = 100;
    else if (t.indexOf(w) === 0 || w.indexOf(t) === 0) s = 80;
    else if (t.indexOf(w) >= 0) s = 60;
    else if (w.indexOf(t) >= 0) s = 40;
    if (!s) continue;
    if (preferEnrolled && /在读|应届/.test(t)) s += 15;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

export function isCustomSelect(el) {
  const cls = String(el.className || '') + ' ' + String((el.parentElement && el.parentElement.className) || '');
  return /ant-select|el-select|ivu-select|van-select|n-select|arco-select|select2|v-select|chosen/i.test(cls);
}

export async function fillCustomSelect(el, value) {
  try {
    el.click();
    await sleep(260);
    const opts = deepQueryAll('[role="option"], .ant-select-item-option, .el-select-dropdown__item, .ivu-select-item, .select2-results__option, .arco-select-option');
    const w = norm(value);
    let target = null;
    let bestScore = 0;
    for (let i = 0; i < opts.length; i += 1) {
      const o = opts[i];
      if (!visible(o)) continue;
      const t = norm(o.textContent);
      if (!t) continue;
      let s = 0;
      if (t === w) s = 100;
      else if (t.indexOf(w) >= 0) s = 60;
      else if (w.indexOf(t) >= 0) s = 40;
      if (s > bestScore) { bestScore = s; target = o; }
    }
    if (target) {
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      target.click();
      await sleep(120);
      return true;
    }
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return false;
  } catch (e) {
    return false;
  }
}
