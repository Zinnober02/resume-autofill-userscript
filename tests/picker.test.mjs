// 可搜索下拉与弹层选择控件（学校、籍贯这类）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field } from './helpers/userscript-env.mjs';

const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };

test('关键词先进搜索框，候选是拿关键词换来的', async () => {
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
  const order = [];
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
      if (!box.value) return;
      order.push('keyword');
      // 站点拿关键词去后端换候选，要一点时间
      dom.window.setTimeout(() => {
        if (order.indexOf('candidate') >= 0) return;
        order.push('candidate');
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
      }, 300);
    });
  });
  const report = await runFill(window, { hometown: '浙江省', extra: [] }, OPTIONS);
  assert.deepEqual(order, ['keyword', 'candidate'], '关键词要先进搜索框，候选才会出来');
  assert.equal(select.value, '浙江省');
  assert.deepEqual(Array.from(report.manual), []);
});

// 学校 / 专业：只读展示框 + 候选弹层，标记照电信页面快照里 14_51_1 的结构裁剪
function schoolPage() {
  return [
    '<!doctype html><html><body><form>',
    '<div class="picker">',
    '<input readonly school-or-subject="1" name="school" msg="学校名称" value="">',
    '<input school-or-subject="2" class="input-query" value="">',
    '<div id="choose-school">',
    '<input class="search-school" type="text">',
    '<ul class="search-result-li"></ul>',
    '</div>',
    '</div>',
    '</form></body></html>',
  ].join('');
}

function installSchoolPicker(window) {
  const root = window.document.querySelector('.picker');
  const shown = root.querySelector('input[school-or-subject="1"]');
  const helper = root.querySelector('input[school-or-subject="2"]');
  const box = root.querySelector('.search-school');
  const list = root.querySelector('.search-result-li');
  let helperWritten = false;
  helper.addEventListener('input', () => { helperWritten = true; });
  box.addEventListener('input', () => {
    list.innerHTML = '';
    ['南京大学金陵学院', '南京大学'].forEach((name) => {
      const li = window.document.createElement('li');
      const a = window.document.createElement('a');
      a.textContent = name;
      li.appendChild(a);
      list.appendChild(li);
      a.addEventListener('click', () => {
        shown.value = name;
        helper.value = name;
      });
    });
  });
  return () => helperWritten;
}

test('学校字段：点开只读展示框，在弹层里点中候选', async () => {
  const { dom, window } = await createPage(schoolPage());
  const helperWritten = installSchoolPicker(window);
  const report = await runFill(window, { educations: [{ school: '南京大学' }], extra: [] }, OPTIONS);
  assert.equal(field(dom, 'input[school-or-subject="1"]').value, '南京大学');
  assert.deepEqual(Array.from(report.filled), ['学校']);
  assert.deepEqual(Array.from(report.manual), []);
  assert.equal(helperWritten(), false, '隐藏的辅助输入框不应该被脚本写值');
});

test('弹层里没有匹配项时记进需要手动处理', async () => {
  const { dom, window } = await createPage(schoolPage());
  installSchoolPicker(window);
  const report = await runFill(window, { educations: [{ school: '某某大学' }], extra: [] }, OPTIONS);
  assert.equal(field(dom, 'input[school-or-subject="1"]').value, '');
  assert.ok(Array.from(report.manual).some((m) => m.indexOf('弹出层') >= 0));
});
