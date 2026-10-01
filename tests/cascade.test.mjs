// 级联控件矩阵：{原生 select, bootstrap-select 镜像, div 做的下拉, 单控件多列面板}
// × {两级, 三级} × {选项同步, 选项异步} × {全称, 简称}
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field } from './helpers/userscript-env.mjs';

const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };

function opt(value) { return '<option value="' + value + '">' + value + '</option>'; }
const PLACEHOLDER = '<option value="">请选择</option>';

test('原生三级下拉，选项同步', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>户口所在地</span>',
    '<select name="p">' + PLACEHOLDER + opt('浙江省') + opt('江苏省') + '</select>',
    '<select name="c">' + PLACEHOLDER + opt('杭州市') + opt('南京市') + '</select>',
    '<select name="d">' + PLACEHOLDER + opt('西湖区') + opt('玄武区') + '</select>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { hukou: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="p"]').value, '浙江省');
  assert.equal(field(dom, 'select[name="c"]').value, '杭州市');
  assert.equal(field(dom, 'select[name="d"]').value, '西湖区');
  assert.deepEqual(Array.from(report.manual), []);
});

test('原生三级下拉，省的选项选完市才加载（异步）', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>籍贯</span>',
    '<select name="p">' + PLACEHOLDER + opt('浙江省') + opt('江苏省') + '</select>',
    '<select name="c">' + PLACEHOLDER + '</select>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const provSel = dom.window.document.querySelector('select[name="p"]');
  const citySel = dom.window.document.querySelector('select[name="c"]');
  provSel.addEventListener('change', () => {
    dom.window.setTimeout(() => {
      ['杭州市', '南京市'].forEach((name) => {
        const o = dom.window.document.createElement('option');
        o.value = name; o.textContent = name;
        citySel.appendChild(o);
      });
    }, 250);
  });
  const report = await runFill(window, { hometown: '浙江省杭州市', extra: [] }, OPTIONS);
  assert.equal(provSel.value, '浙江省');
  assert.equal(citySel.value, '杭州市', '要等市的选项加载出来再选');
  assert.deepEqual(Array.from(report.manual), []);
});

test('资料是简称时也能对上全称选项', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>户口所在地</span>',
    '<select name="p">' + PLACEHOLDER + opt('浙江省') + opt('江苏省') + '</select>',
    '<select name="c">' + PLACEHOLDER + opt('杭州市') + opt('南京市') + '</select>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { hukou: '浙江杭州', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="p"]').value, '浙江省');
  assert.equal(field(dom, 'select[name="c"]').value, '杭州市');
  assert.deepEqual(Array.from(report.manual), []);
});

test('直辖市：市那一级也用市名', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row"><span>户口所在地</span>',
    '<select name="p">' + PLACEHOLDER + opt('北京市') + opt('上海市') + '</select>',
    '<select name="c">' + PLACEHOLDER + opt('北京市') + opt('上海市') + '</select>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { hukou: '北京市朝阳区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="p"]').value, '北京市');
  assert.equal(field(dom, 'select[name="c"]').value, '北京市');
  assert.ok(Array.from(report.manual).every((m) => m.indexOf('区 / 县') >= 0));
});

// bootstrap-select：原生 select 被藏起来，只留自己生成的按钮，候选靠关键词换
function installMirror(window, select, names) {
  const wrap = select.closest('.bootstrap-select');
  const toggle = wrap.querySelector('button.dropdown-toggle');
  let panel = null;
  toggle.addEventListener('click', () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = window.document.createElement('div');
    panel.className = 'dropdown-menu open';
    panel.innerHTML = '<div class="bs-searchbox"><input type="text"></div><ul class="dropdown-menu inner"></ul>';
    wrap.appendChild(panel);
    const box = panel.querySelector('input');
    const list = panel.querySelector('ul');
    const render = (keyword) => {
      list.innerHTML = '';
      names.filter((n) => !keyword || n.indexOf(keyword) >= 0).forEach((name) => {
        const li = window.document.createElement('li');
        const a = window.document.createElement('a');
        a.textContent = name;
        li.appendChild(a);
        list.appendChild(li);
        a.addEventListener('click', () => {
          const o = window.document.createElement('option');
          o.value = name; o.textContent = name;
          select.appendChild(o);
          select.value = name;
          const mirror = wrap.querySelector('.filter-option');
          if (mirror) mirror.textContent = name;
        });
      });
    };
    box.addEventListener('input', () => render(box.value));
    render('');
  });
}

test('bootstrap-select 镜像：原生控件不可见时也能选（两级）', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="row">',
    '<div class="btn-group bootstrap-select">',
    '<select name="p" msg="籍贯" data-live-search="true" class="selectpicker" style="display:none">' + PLACEHOLDER + '</select>',
    '<button type="button" class="dropdown-toggle"><span class="filter-option">请选择</span></button>',
    '</div>',
    '<div class="btn-group bootstrap-select">',
    '<select name="c" data-live-search="true" class="selectpicker" style="display:none">' + PLACEHOLDER + '</select>',
    '<button type="button" class="dropdown-toggle"><span class="filter-option">请选择</span></button>',
    '</div>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  installMirror(window, dom.window.document.querySelector('select[name="p"]'), ['浙江省', '江苏省']);
  installMirror(window, dom.window.document.querySelector('select[name="c"]'), ['杭州市', '南京市']);
  const report = await runFill(window, { hometown: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'select[name="p"]').value, '浙江省');
  assert.equal(field(dom, 'select[name="c"]').value, '杭州市');
  assert.ok(Array.from(report.manual).every((m) => m.indexOf('区 / 县') >= 0));
});

// div 做的下拉：没有任何表单控件，只有 role=combobox 的展示框与浮层
function installDivSelect(window, box, names) {
  let panel = null;
  const open = () => {
    if (panel) return;
    panel = window.document.createElement('div');
    panel.className = 'menu';
    names.forEach((name) => {
      const item = window.document.createElement('div');
      item.className = 'item';
      item.textContent = name;
      panel.appendChild(item);
      item.addEventListener('click', () => {
        box.textContent = name;
        const holder = box.closest('.field');
        const value = holder.querySelector('.value');
        if (value) value.textContent = name;
      });
    });
    box.parentElement.appendChild(panel);
  };
  box.addEventListener('click', open);
}

test('div 做的下拉（role=combobox）也能填', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="field"><span>高考生源地</span>',
    '<div class="value" role="combobox" msg="高考生源地">请选择</div>',
    '</div>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const box = dom.window.document.querySelector('[role="combobox"]');
  installDivSelect(window, box, ['浙江省', '江苏省', '广东省']);
  const report = await runFill(window, { gaokaoOrigin: '浙江省', extra: [] }, OPTIONS);
  assert.equal(box.textContent, '浙江省');
  assert.ok(Array.from(report.filled).some((f) => f.indexOf('高考生源地') >= 0));
});

// 单控件多列面板：一个只读框，点开之后是几列，一列一级
function installCascadePanel(window) {
  const root = window.document.querySelector('.field');
  const shown = root.querySelector('input[readonly]');
  const panel = root.querySelector('.panel');
  const cols = Array.from(panel.querySelectorAll('.col'));
  const levels = [
    ['浙江省', '江苏省', '广东省'],
    ['杭州市', '南京市', '广州市'],
    ['西湖区', '玄武区', '越秀区'],
  ];
  const picked = [];
  const fillCol = (index) => {
    const col = cols[index];
    col.innerHTML = '';
    levels[index].forEach((name) => {
      const li = window.document.createElement('li');
      li.textContent = name;
      col.appendChild(li);
      li.addEventListener('click', () => {
        picked[index] = name;
        if (index + 1 < cols.length) fillCol(index + 1);
        shown.value = picked.filter(Boolean).join('');
      });
    });
  };
  shown.addEventListener('click', () => {
    panel.style.display = 'block';
    fillCol(0);
  });
}

test('单控件多列面板：逐列点下去（三级）', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="field"><span>户口所在地</span>',
    '<input readonly msg="户口所在地" value="">',
    '<div class="panel" style="display:none"><ul class="col"></ul><ul class="col"></ul><ul class="col"></ul></div>',
    '</div></form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  installCascadePanel(window);
  const report = await runFill(window, { hukou: '浙江省杭州市西湖区', extra: [] }, OPTIONS);
  assert.equal(field(dom, 'input[readonly]').value, '浙江省杭州市西湖区');
  assert.ok(Array.from(report.filled).some((f) => f.indexOf('户口所在地') >= 0));
});
// 电信简历里那一栏的真实标记：第一级下拉没有 msg，id 带 firstLevl 前缀，
// 两个原生 select 都被 bootstrap-select 包起来
const TELECOM_ROW = [
  '<!doctype html><html><body><form>',
  '<div class="mdf-table-cell"><div class="ipt-item9"><div class="ipt-item-half">',
  '<div class="btn-group bootstrap-select show-tick form-control">',
  '<select id="firstLevl11_245_1" name="firstLevl11_245_1" data-live-search="true" class="selectpicker show-tick form-control">' + PLACEHOLDER + '</select>',
  '<button type="button" class="btn dropdown-toggle bs-placeholder" data-toggle="dropdown"><span class="filter-option pull-left">请选择</span></button>',
  '</div>',
  '<div class="btn-group bootstrap-select show-tick form-control">',
  '<select id="11_245_1" name="11_245_1" msg="籍贯" data-live-search="true" class="selectpicker show-tick form-control">' + PLACEHOLDER + '</select>',
  '<button type="button" class="btn dropdown-toggle bs-placeholder" data-toggle="dropdown"><span class="filter-option pull-left">请选择</span></button>',
  '</div>',
  '</div></div></div></form></body></html>',
].join('');

test('电信那栏的标记能被认成一组，第一级没有字段名也算', async () => {
  const { window } = await createPage(TELECOM_ROW);
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  const { detectCascade } = await import('../src/core/cascade.js');
  const { pickKey } = await import('../src/core/rules.js');
  const { labelText, attrText } = await import('../src/core/dom.js');
  const classify = (node) => pickKey({ label: labelText(node), attr: attrText(node), hint: '', allowHint: false });
  const first = window.document.querySelector('#firstLevl11_245_1');
  const group = detectCascade(first, classify);
  assert.ok(group, '两个下拉要被认成一组');
  assert.equal(group.key, 'hometown');
  assert.equal(group.nodes.length, 2);
  assert.deepEqual(group.roles, ['province', 'city'], '前一个是省，后一个是市');
  assert.equal(detectCascade(first, classify).position, 0);
});
