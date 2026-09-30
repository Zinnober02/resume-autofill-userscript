// 地址分段与可搜索下拉
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field } from './helpers/userscript-env.mjs';
import { splitAddress } from '../src/core/address.js';

const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };

test('整串地址拆成省、市、区与详细地址', () => {
  assert.deepEqual(splitAddress('浙江省杭州市西湖区'), { province: '浙江省', city: '杭州市', district: '西湖区', detail: '' });
  assert.deepEqual(splitAddress('北京市朝阳区'), { province: '北京市', city: '', district: '朝阳区', detail: '' });
  assert.deepEqual(splitAddress('浙江省杭州市西湖区文三路 100 号'), { province: '浙江省', city: '杭州市', district: '西湖区', detail: '文三路 100 号' });
  assert.deepEqual(splitAddress('浙江杭州'), { province: '', city: '', district: '', detail: '浙江杭州' });
  assert.deepEqual(splitAddress(''), { province: '', city: '', district: '', detail: '' });
});

const ADDRESS_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>籍贯</span>',
  '<select name="p"><option value="">请选择</option><option>浙江省</option><option>江苏省</option></select>',
  '<select name="c"><option value="">请选择</option><option>杭州市</option><option>南京市</option></select>',
  '<select name="d"><option value="">请选择</option><option>西湖区</option><option>玄武区</option></select>',
  '</div>',
  '</form></body></html>',
].join('');

test('省 / 市 / 区三个下拉一起填', async () => {
  const { dom, window } = await createPage(ADDRESS_PAGE);
  const report = await runFill(window, { hometown: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="p"]').value, '浙江省');
  assert.equal(field(dom, 'select[name="c"]').value, '杭州市');
  assert.equal(field(dom, 'select[name="d"]').value, '西湖区');
  assert.deepEqual(Array.from(report.manual), []);
});

// 学校这类字段：原生下拉的选项由搜索动态给，要点开、输入、再点候选
function installSearchSelect(window) {
  const select = window.document.querySelector('select[name="school"]');
  const wrap = select.closest('.bootstrap-select');
  const toggle = window.document.createElement('button');
  toggle.className = 'dropdown-toggle';
  wrap.appendChild(toggle);
  let panel = null;
  toggle.addEventListener('click', () => {
    if (panel) return;
    panel = window.document.createElement('div');
    panel.className = 'dropdown-menu open';
    panel.innerHTML = '<div class="bs-searchbox"><input type="text" class="form-control"></div>'
      + '<ul class="dropdown-menu inner"><li><a>南京大学金陵学院</a></li><li><a>南京大学</a></li></ul>';
    wrap.appendChild(panel);
    panel.querySelectorAll('li a').forEach((a) => a.addEventListener('click', () => {
      const option = window.document.createElement('option');
      option.value = a.textContent;
      option.textContent = a.textContent;
      select.appendChild(option);
      select.value = a.textContent;
      panel.remove();
      panel = null;
    }));
  });
}

const SEARCH_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="cell"><span>学校名称</span>',
  '<div class="btn-group bootstrap-select">',
  '<select name="school" data-live-search="true" class="selectpicker"><option value="">请选择</option></select>',
  '</div></div>',
  '</form></body></html>',
].join('');

const PHONE_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>移动电话</span>',
  '<select name="country"><option value="">请选择</option><option value="86">中国大陆 +86</option><option value="852">中国香港 +852</option></select>',
  '<input name="number">',
  '</div>',
  '</form></body></html>',
].join('');

test('手机号前面的国家 / 地区代码下拉会被选中', async () => {
  const { dom, window } = await createPage(PHONE_PAGE);
  const report = await runFill(window, { phone: '13800000000', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="country"]').value, '86');
  assert.equal(field(dom, 'input[name="number"]').value, '13800000000');
  assert.deepEqual(Array.from(report.manual), []);
});

test('可搜索下拉会点开、输入关键词、再点候选', async () => {
  const { dom, window } = await createPage(SEARCH_PAGE);
  installSearchSelect(window);
  const report = await runFill(window, { educations: [{ school: '南京大学' }], extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="school"]').value, '南京大学');
  assert.deepEqual(Array.from(report.manual), []);
});
