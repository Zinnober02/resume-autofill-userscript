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

const CITY_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>户口所在地</span>',
  '<select name="prov"><option value="">请选择</option><option>浙江省</option><option>江苏省</option></select>',
  '</div>',
  '</form></body></html>',
].join('');

test('只到省的下拉，整串地址也能匹配到省，并提示后面的部分要手动补', async () => {
  const { dom, window } = await createPage(CITY_PAGE);
  const report = await runFill(window, { hukou: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="prov"]').value, '浙江省');
  const manual = Array.from(report.manual);
  assert.equal(manual.length, 1);
  assert.match(manual[0], /只到「浙江省」/);
});

test('地址下拉的搜索关键词用省名，不拿完整地址去搜', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="cell"><span>籍贯</span>',
    '<div class="btn-group bootstrap-select">',
    '<select name="hometown" data-live-search="true" class="selectpicker"><option value="">请选择</option></select>',
    '</div></div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const select = dom.window.document.querySelector('select[name="hometown"]');
  const wrap = select.closest('.bootstrap-select');
  const toggle = dom.window.document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';
  wrap.appendChild(toggle);
  const typed = [];
  let panel = null;
  toggle.addEventListener('click', () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = dom.window.document.createElement('div');
    panel.className = 'dropdown-menu open';
    panel.innerHTML = '<div class="bs-searchbox"><input type="text"></div><ul class="dropdown-menu inner"></ul>';
    wrap.appendChild(panel);
    const box = panel.querySelector('input');
    const list = panel.querySelector('ul');
    box.addEventListener('input', () => {
      typed.push(box.value);
      list.innerHTML = '';
      // 只有搜到省名时后端才给候选，整串地址是搜不出东西的
      if (box.value.indexOf('浙江省') === 0) {
        const li = dom.window.document.createElement('li');
        const a = dom.window.document.createElement('a');
        a.textContent = '浙江省';
        li.appendChild(a);
        list.appendChild(li);
        a.addEventListener('click', () => {
          const option = dom.window.document.createElement('option');
          option.value = '浙江省';
          option.textContent = '浙江省';
          select.appendChild(option);
          select.value = '浙江省';
        });
      }
    });
  });
  await runFill(window, { hometown: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.ok(typed.indexOf('浙江省') >= 0, '应该拿省名去搜');
  assert.equal(typed.indexOf('浙江省杭州市西湖区'), -1, '不应该拿完整地址去搜');
  assert.equal(select.value, '浙江省');
});

test('省、市、区各自的框只拿自己那一段', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>户口所在地</span>',
    '<select name="prov"><option value="">请选择</option><option>浙江省</option><option>江苏省</option></select>',
    '<select name="city"><option value="">请选择</option><option>杭州市</option><option>南京市</option></select>',
    '<select name="area"><option value="">请选择</option><option>西湖区</option><option>玄武区</option></select>',
    '</div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { hukou: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="prov"]').value, '浙江省');
  assert.equal(field(dom, 'select[name="city"]').value, '杭州市');
  assert.equal(field(dom, 'select[name="area"]').value, '西湖区');
  assert.deepEqual(Array.from(report.manual), []);
});

test('下拉里确实没有能对上的选项时记进需要手动处理', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>户口所在地</span>',
    '<select name="prov"><option value="">请选择</option><option>北京市</option><option>上海市</option></select>',
    '</div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { hukou: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="prov"]').value, '');
  assert.ok(Array.from(report.manual).some((m) => m.indexOf('户口所在地') >= 0));
});

test('点开之后后端把选项填进原生控件的下拉也能选中', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="cell"><span>高考生源地</span>',
    '<div class="btn-group bootstrap-select">',
    '<select name="origin" data-live-search="true" class="selectpicker"><option value="">请选择</option></select>',
    '</div></div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const select = dom.window.document.querySelector('select[name="origin"]');
  const wrap = select.closest('.bootstrap-select');
  const toggle = dom.window.document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';
  wrap.appendChild(toggle);
  toggle.addEventListener('click', () => {
    dom.window.setTimeout(() => {
      ['浙江省', '江苏省'].forEach((name) => {
        const option = dom.window.document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
    }, 500);
  });
  const report = await runFill(window, { gaokaoOrigin: '浙江省', extra: [] }, OPTIONS);
  assert.equal(select.value, '浙江省');
  assert.deepEqual(Array.from(report.manual), []);
});

test('选项是点开之后才加载的下拉也能选中', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="cell"><span>籍贯</span>',
    '<div class="btn-group bootstrap-select">',
    '<select name="hometown" data-live-search="true" class="selectpicker"><option value="">请选择</option></select>',
    '</div></div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const select = dom.window.document.querySelector('select[name="hometown"]');
  const wrap = select.closest('.bootstrap-select');
  const toggle = dom.window.document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';
  wrap.appendChild(toggle);
  // 模拟后端：点开 400 毫秒之后候选才出来
  toggle.addEventListener('click', () => {
    dom.window.setTimeout(() => {
      const panel = dom.window.document.createElement('div');
      panel.className = 'dropdown-menu open';
      panel.innerHTML = '<div class="bs-searchbox"><input type="text"></div>'
        + '<ul class="dropdown-menu inner"><li><a>浙江省</a></li><li><a>江苏省</a></li></ul>';
      wrap.appendChild(panel);
      panel.querySelectorAll('li a').forEach((a) => a.addEventListener('click', () => {
        const option = dom.window.document.createElement('option');
        option.value = a.textContent;
        option.textContent = a.textContent;
        select.appendChild(option);
        select.value = a.textContent;
      }));
    }, 400);
  });
  const report = await runFill(window, { hometown: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(select.value, '浙江省');
  assert.ok(Array.from(report.filled).some((f) => f.indexOf('籍贯') >= 0));
});

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
