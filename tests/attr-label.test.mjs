// 标签提取：控件属性里写着的字段名（msg、data-label、data 里的 json name 等）
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { labelText, attrText } from '../src/core/dom.js';
import { pickKey } from '../src/core/rules.js';
import { createPage, runFill, field, storageWith } from './helpers/userscript-env.mjs';

function query(html, selector) {
  const dom = new JSDOM(html, { url: 'https://x.test/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  return dom.window.document.querySelector(selector);
}

test('控件属性里的字段名会被取出来', () => {
  assert.equal(labelText(query('<input msg="姓名">', 'input')), '姓名');
  assert.equal(labelText(query('<input data-label="手机号码">', 'input')), '手机号码');
  assert.equal(labelText(query('<input data-name="紧急联系人">', 'input')), '紧急联系人');
  assert.equal(labelText(query('<input aria-label="电子邮箱">', 'input')), '电子邮箱');
});

test('data 属性里的 json name 会被取出来', () => {
  const own = query('<input data=\'{"id":41,"name":"个人照片"}\'>', 'input');
  assert.equal(labelText(own), '个人照片');
  const up = query('<dy-form data=\'{"id":32,"name":"最高学历毕业院校"}\'><div><input></div></dy-form>', 'input');
  assert.equal(labelText(up), '最高学历毕业院校');
});

test('纯提示语的属性值不算字段名', () => {
  assert.equal(labelText(query('<input msg="请选择">', 'input')), '');
  assert.equal(labelText(query('<input placeholder="请输入">', 'input')), '');
  assert.equal(labelText(query('<input msg="请选择或输入">', 'input')), '');
});

test('属性里没有字段名时，仍然找 label[for] 与旁边的文字', () => {
  assert.equal(labelText(query('<label for="a">姓名</label><input id="a">', 'input')), '姓名');
  assert.equal(labelText(query('<div><span>所学专业</span><input name="major"></div>', 'input')), '所学专业');
});

test('属性里的字段名优先于 placeholder', () => {
  const el = query('<input msg="姓名" placeholder="请输入内容">', 'input');
  assert.equal(labelText(el), '姓名 请输入内容');
  assert.equal(pickKey({ label: labelText(el), attr: attrText(el), hint: '', allowHint: false }), 'name');
});

test('参与匹配的属性里不再包含 class', () => {
  const el = query('<input class="dayType requireInput startDate" name="14_49_1">', 'input');
  assert.equal(attrText(el), '14_49_1');
  assert.equal(pickKey({ label: '入学时间', attr: attrText(el), hint: '', allowHint: false }), null);
});

// 电信那套表单的结构：字段名写在控件的 msg 属性上，下拉框外面套 bootstrap-select
const TELECOM_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="mdf-table clearFloat">',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_2_1" class="ng-isolate-scope">',
  '<div class="ipt-item ng-scope"><input name="11_2_1" id="11_2_1" msg="姓名" type="text" class="ng-pristine requireInput"></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_3_1">',
  '<div class="ipt-item ng-scope"><input name="11_3_1" id="11_3_1" msg="移动电话" type="text" class="requireInput"></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_4_1">',
  '<div class="ipt-item ng-scope"><input name="11_4_1" id="11_4_1" msg="电子邮箱" type="text" class="requireInput"></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_100_1">',
  '<div class="ipt-item ng-scope"><input name="11_100_1" id="11_100_1" msg="证件号码" type="text"></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_22_1">',
  '<div class="ipt-item9 ng-scope"><div class="btn-group bootstrap-select">',
  '<select name="11_22_1" id="11_22_1" msg="民族" class="selectpicker form-control">',
  '<option value="">请选择</option><option value="01">汉族</option><option value="02">回族</option>',
  '</select></div></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_21_1">',
  '<div class="ipt-item ng-scope"><input name="11_21_1" id="11_21_1" msg="出生日期" type="text" class="dayType requireInput"></div>',
  '</dy-form></div></div>',
  '<div class="mdf-table-cell"><div class="mdf-table-cell-r"><dy-form name-num="11_50_1">',
  '<div class="ipt-item ng-scope"><input name="11_50_1" id="11_50_1" msg="英语水平" type="text"></div>',
  '</dy-form></div></div>',
  '</div>',
  '</form></body></html>',
].join('');

test('电信那种把字段名写在属性上的表单能被填上', async () => {
  const profile = {
    name: '张三',
    phone: '13800000000',
    email: 'zhangsan@example.com',
    idCard: '110101200309150011',
    nation: '汉族',
    birthday: '2003-09-15',
    englishLevel: '良好',
  };
  const { dom, window } = await createPage(TELECOM_PAGE, undefined, { storage: storageWith(profile) });
  const report = await runFill(window, profile, { onlyEmpty: true, autoConsent: false, highlight: false });
  assert.equal(field(dom, '[name="11_2_1"]').value, '张三');
  assert.equal(field(dom, '[name="11_3_1"]').value, '13800000000');
  assert.equal(field(dom, '[name="11_4_1"]').value, 'zhangsan@example.com');
  assert.equal(field(dom, '[name="11_100_1"]').value, '110101200309150011');
  assert.equal(field(dom, '[name="11_22_1"]').value, '01');
  assert.equal(field(dom, '[name="11_21_1"]').value, '2003-09-15');
  assert.equal(field(dom, '[name="11_50_1"]').value, '良好');
  assert.deepEqual(Array.from(report.manual), []);
});
