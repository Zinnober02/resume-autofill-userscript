// 点「添加」才出现的区块：多段经历、自动填充新编辑框、自动补足段数
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field, shadowOf, buttonByText, storageWith } from './helpers/userscript-env.mjs';

const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };
const BASE = { name: '张三', phone: '13800000000', email: 'zhangsan@example.com', extra: [] };

const LONG_TIP = '请按从高到低的顺序填写，学校名称请填写毕业证上的全称，专业名称请填写完整的专业名称，'
  + '日期格式为年-月。若目前还在读，结束时间请填写预计毕业时间。每一段经历都要填写完整，'
  + '否则可能影响简历筛选结果。填写之前请先核对一遍个人信息，确认无误之后再提交。'
  + '如果表单里出现了这里没有提到的字段，可以在资料面板最底部的补充规则里加一条，'
  + '写明网页上的字段文字和要填进去的内容，保存之后再点一次一键填充即可。';

const EDU_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="edu-block"><h3>教育经历</h3><p>', LONG_TIP, '</p>',
  '<div class="edu-item"><span>学校名称</span><input name="s1"><span>专业名称</span><input name="m1"></div>',
  '<div class="edu-item"><span>学校名称</span><input name="s2"><span>专业名称</span><input name="m2"></div>',
  '</div>',
  '</form></body></html>',
].join('');

test('资料里有两段教育经历时，按顺序填到两段里', async () => {
  const { dom, window } = await createPage(EDU_PAGE);
  const profile = Object.assign({}, BASE, {
    educations: [
      { school: '示例大学', major: '软件工程', start: '2025-09', end: '2027-07' },
      { school: '示例学院', major: '计算机科学与技术', start: '2021-09', end: '2025-07' },
    ],
  });
  await runFill(window, profile, OPTIONS);
  assert.equal(field(dom, 'input[name="s1"]').value, '示例大学');
  assert.equal(field(dom, 'input[name="m1"]').value, '软件工程');
  assert.equal(field(dom, 'input[name="s2"]').value, '示例学院');
  assert.equal(field(dom, 'input[name="m2"]').value, '计算机科学与技术');
});

test('旧式扁平字段仍然可用：第一段取最高学历，第二段取本科', async () => {
  const { dom, window } = await createPage(EDU_PAGE);
  const profile = Object.assign({}, BASE, {
    school: '示例大学', major: '软件工程',
    bachelorSchool: '示例学院', bachelorMajor: '计算机科学与技术',
  });
  await runFill(window, profile, OPTIONS);
  assert.equal(field(dom, 'input[name="s1"]').value, '示例大学');
  assert.equal(field(dom, 'input[name="s2"]').value, '示例学院');
});

const LIST_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>姓名</span><input name="fullName"></div>',
  '<div class="row"><span>手机号码</span><input name="mobile"></div>',
  '<div class="row"><span>电子邮箱</span><input name="email" type="email"></div>',
  '<div class="row"><span>所学专业</span><input name="major"></div>',
  '<div id="list"></div>',
  '</form></body></html>',
].join('');

test('新出现的编辑框会被自动填上', async () => {
  const profile = Object.assign({}, BASE, { company: '示例科技', title: '后端开发实习生' });
  const { window } = await createPage(LIST_PAGE, undefined, { storage: storageWith(profile) });
  const list = window.document.getElementById('list');
  const item = window.document.createElement('div');
  item.innerHTML = '<span>公司名称</span><input name="c1"><span>职位</span><input name="t1">';
  list.appendChild(item);
  await new Promise((r) => setTimeout(r, 1600));
  assert.equal(window.document.querySelector('input[name="c1"]').value, '示例科技');
  assert.equal(window.document.querySelector('input[name="t1"]').value, '后端开发实习生');
});

const ADD_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>姓名</span><input name="fullName"></div>',
  '<div class="row"><span>手机号码</span><input name="mobile"></div>',
  '<div class="row"><span>电子邮箱</span><input name="email" type="email"></div>',
  '<div class="work-block"><h3>工作经历</h3><p>', LONG_TIP, '</p>',
  '<div id="workList">',
  '<div class="work-item"><span>公司名称</span><input name="c1"><span>职位</span><input name="t1"></div>',
  '</div>',
  '<button type="button" id="addWork">+ 添加一条工作经历</button>',
  '</div>',
  '</form></body></html>',
].join('');

function installAddButton(window) {
  let seq = 1;
  const btn = window.document.getElementById('addWork');
  btn.addEventListener('click', () => {
    seq += 1;
    const item = window.document.createElement('div');
    item.className = 'work-item';
    item.innerHTML = '<span>公司名称</span><input name="c' + seq + '"><span>职位</span><input name="t' + seq + '">';
    window.document.getElementById('workList').appendChild(item);
  });
}

test('打开开关后，按资料里的段数自动点「添加」补足并填好', async () => {
  const profile = Object.assign({}, BASE, {
    works: [
      { company: '甲公司', title: '实习生' },
      { company: '乙公司', title: '开发工程师' },
    ],
  });
  const { window } = await createPage(ADD_PAGE, undefined, { storage: storageWith(profile) });
  installAddButton(window);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  const opt = Array.from(shadow.querySelectorAll('label.status'))
    .find((n) => n.textContent.indexOf('自动点「添加」') >= 0);
  opt.querySelector('input').click();
  buttonByText(shadow, '一键填充本页表单').click();
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const second = window.document.querySelector('input[name="c2"]');
    if (second && second.value) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.equal(window.document.querySelector('input[name="c1"]').value, '甲公司');
  assert.equal(window.document.querySelector('input[name="t1"]').value, '实习生');
  assert.equal(window.document.querySelector('input[name="c2"]').value, '乙公司');
  assert.equal(window.document.querySelector('input[name="t2"]').value, '开发工程师');
});
