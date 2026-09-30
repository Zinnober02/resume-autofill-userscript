// 日期时间控件：格式换算、年/月/日分组、组件库弹层、写入后回读
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field } from './helpers/userscript-env.mjs';
import { formatValue, splitDateTime } from '../src/core/value.js';

const el = (type, placeholder, maxlength) => ({
  type,
  getAttribute: (name) => {
    if (name === 'placeholder') return placeholder || null;
    if (name === 'maxlength') return maxlength == null ? null : String(maxlength);
    return null;
  },
});
const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };

test('splitDateTime 拆出年月日与时刻', () => {
  assert.deepEqual(splitDateTime('2003-09'), { year: '2003', month: '09', day: '01', hasDay: false, time: '' });
  assert.deepEqual(splitDateTime('2003-9-5'), { year: '2003', month: '09', day: '05', hasDay: true, time: '' });
  assert.deepEqual(splitDateTime('2027-07-01 09:30'), { year: '2027', month: '07', day: '01', hasDay: true, time: '09:30' });
  assert.equal(splitDateTime('下周'), null);
});

test('formatValue 按控件类型输出', () => {
  assert.equal(formatValue(el('date'), '2003-09'), '2003-09-01');
  assert.equal(formatValue(el('month'), '2003-09'), '2003-09');
  assert.equal(formatValue(el('datetime-local'), '2003-09'), '2003-09-01T00:00');
  assert.equal(formatValue(el('datetime-local'), '2003-09-01 09:30'), '2003-09-01T09:30');
  assert.equal(formatValue(el('time'), '2003-09'), '');
  assert.equal(formatValue(el('time'), '2003-09-01 09:30'), '09:30');
  assert.equal(formatValue(el('text', 'YYYY/MM/DD'), '2003-09'), '2003/09/01');
  assert.equal(formatValue(el('text', '年 月'), '2003-09'), '2003年09月');
  assert.equal(formatValue(el('text', '年 月 日'), '2003-09'), '2003年09月01日');
  assert.equal(formatValue(el('text'), '一周内'), '一周内');
});

const SEGMENT_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>出生日期</span>',
  '<select name="by"><option value="">请选择</option><option>2002</option><option>2003</option></select>',
  '<select name="bm"><option value="">请选择</option><option>08</option><option>09</option></select>',
  '<select name="bd"><option value="">请选择</option><option>01</option><option>15</option></select>',
  '</div>',
  '</form></body></html>',
].join('');

test('只收年月的控件按 placeholder、maxlength、字段名三种线索截断', () => {
  assert.equal(formatValue(el('text', 'YYYY-MM'), '2003-09-15', '出生日期'), '2003-09');
  assert.equal(formatValue(el('text', 'yyyy/mm'), '2003-09-15', '出生日期'), '2003/09');
  assert.equal(formatValue(el('text', '年 月'), '2003-09-15', '出生日期'), '2003年09月');
  assert.equal(formatValue(el('text', ''), '2003-09-15', '出生年月'), '2003-09');
  assert.equal(formatValue(el('text', '', 7), '2003-09-15', '出生日期'), '2003-09');
  assert.equal(formatValue(el('text', '', 10), '2003-09-15', '出生年月'), '2003-09');
  assert.equal(formatValue(el('text', ''), '2003-09-15', '出生日期'), '2003-09-15');
  assert.equal(formatValue(el('text', '年 月 日'), '2003-09-15', '出生日期'), '2003年09月15日');
});

test('年 / 月 / 日 三个下拉框一起填', async () => {
  const { dom, window } = await createPage(SEGMENT_PAGE);
  const report = await runFill(window, { birthday: '2003-09', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="by"]').value, '2003');
  assert.equal(field(dom, 'select[name="bm"]').value, '09');
  assert.equal(field(dom, 'select[name="bd"]').value, '01');
  assert.equal(report.manual.length, 0);
});

test('控件不接受格式时记进需要手动处理，不再谎报已填', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>到岗时间</span><input type="time" name="t"></div>',
    '<div class="row"><span>姓名</span><input name="fullName"></div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { name: '张三', availableDate: '2027-07', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'input[name="fullName"]').value, '张三');
  assert.deepEqual(Array.from(report.filled), ['姓名']);
  assert.equal(report.manual.length, 1);
  assert.match(report.manual[0], /到岗时间/);
});

// 一个简化版的组件库日期选择器：点输入框弹出面板，逐级选年、月、日
function installDatePicker(window) {
  const input = window.document.querySelector('.ant-picker-input');
  const state = { view: '', year: '', month: '', day: '' };
  let panel = null;
  const cells = (list) => '<table><tbody><tr>' + list.map((t) => '<td class="ant-picker-cell"><div class="ant-picker-cell-inner">' + t + '</div></td>').join('') + '</tr></tbody></table>';
  const draw = () => {
    if (!panel) return;
    let header = '';
    let body = '';
    if (state.view === 'year') {
      header = '<div class="ant-picker-header"><button class="ant-picker-header-view">2020年-2029年</button></div>';
      body = cells(['2024', '2025', '2027']);
    } else if (state.view === 'month') {
      header = '<div class="ant-picker-header"><button class="ant-picker-header-view">' + state.year + '年</button></div>';
      body = cells(['6月', '7月', '8月']);
    } else {
      header = '<div class="ant-picker-header"><button class="ant-picker-header-view">' + (state.year || '2026') + '年</button>'
        + '<button class="ant-picker-header-view">' + (state.month || '1') + '月</button></div>';
      body = cells(['14', '15', '16']);
    }
    panel.innerHTML = header + '<div class="ant-picker-body">' + body + '</div>';
    panel.querySelectorAll('.ant-picker-header-view').forEach((btn) => {
      if (/^\d{4}\s*年?$/.test(btn.textContent.trim())) btn.addEventListener('click', () => { state.view = 'year'; draw(); });
    });
    panel.querySelectorAll('.ant-picker-cell-inner').forEach((cell) => {
      cell.addEventListener('click', () => {
        const text = cell.textContent.trim();
        const td = cell.parentElement;
        if (state.view === 'year') { state.year = text; state.view = 'month'; }
        else if (state.view === 'month') { state.month = String(Number(text.replace('月', ''))); state.view = 'day'; }
        else {
          state.day = text;
          input.value = state.year + '-' + ('0' + state.month).slice(-2) + '-' + ('0' + state.day).slice(-2);
          panel.remove();
          panel = null;
          return;
        }
        td.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
        draw();
      });
    });
  };
  input.addEventListener('click', () => {
    if (panel) return;
    panel = window.document.createElement('div');
    panel.className = 'ant-picker-dropdown';
    window.document.body.appendChild(panel);
    state.view = 'day';
    draw();
  });
}

test('组件库日期选择器：点开弹层后逐级选中日期', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="form-item"><span>毕业时间</span>',
    '<div class="ant-picker"><input class="ant-picker-input" name="grad" readonly placeholder="请选择日期"></div>',
    '</div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  installDatePicker(window);
  const report = await runFill(window, { educations: [{ eduEnd: '2027-07-15' }], extra: [] }, OPTIONS);
  assert.equal(field(dom, 'input[name="grad"]').value, '2027-07-15');
  assert.deepEqual(Array.from(report.manual), []);
});
