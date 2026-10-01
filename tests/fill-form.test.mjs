// 端到端填充测试：在 jsdom 里加载打包产物，用脚本自己的消息协议跑一遍
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, runFill, field } from './helpers/userscript-env.mjs';

const PROFILE = {
  name: '张三',
  englishName: 'Zhang San',
  gender: '男',
  birthday: '2003-09-01',
  phone: '13800000000',
  email: 'zhangsan@example.com',
  applyPosition: 'AI应用工程师',
  expectCity: '杭州',
  educations: [{ school: '示例大学', college: '计算机学院', major: '软件工程', degree: '硕士', gpa: '3.8' }],
  works: [{ company: '示例科技', title: '后端开发实习生' }],
  extra: [{ match: '期望岗位', value: 'AI应用工程师' }],
};

const PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>姓名</span><input name="fullName"></div>',
  '<div class="row"><span>手机号码</span><input name="mobile"></div>',
  '<div class="row"><span>电子邮箱</span><input name="email" type="email"></div>',
  '<div class="row"><span>出生日期</span><input name="birthday" type="date"></div>',
  '<div class="row"><span>最高学历</span><select name="degree">',
  '<option value="">请选择</option><option value="bachelor">本科</option><option value="master">硕士</option>',
  '</select></div>',
  '<div class="row"><span>性别</span>',
  '<label><input type="radio" name="gender" value="男">男</label>',
  '<label><input type="radio" name="gender" value="女">女</label>',
  '</div>',
  '<div class="row"><span>期望岗位</span><input name="expect"></div>',
  '<div class="row"><span>推荐人</span><input name="referee"></div>',
  '</form></body></html>',
].join('');

const OPTIONS = { onlyEmpty: true, autoConsent: false, highlight: false };

test('把资料填进常见表单控件', async () => {
  const { dom, window } = await createPage(PAGE);
  const report = await runFill(window, PROFILE, OPTIONS);

  assert.equal(field(dom, 'input[name="fullName"]').value, '张三');
  assert.equal(field(dom, 'input[name="mobile"]').value, '13800000000');
  assert.equal(field(dom, 'input[name="email"]').value, 'zhangsan@example.com');
  assert.equal(field(dom, 'input[name="birthday"]').value, '2003-09-01');
  assert.equal(field(dom, 'select[name="degree"]').value, 'master');
  assert.equal(field(dom, 'input[name="expect"]').value, 'AI应用工程师');
  assert.equal(field(dom, 'input[name="gender"][value="男"]').checked, true);
  assert.equal(field(dom, 'input[name="gender"][value="女"]').checked, false);
  assert.equal(report.count, 7);
});

test('认不出来的字段会列进报告', async () => {
  const { window } = await createPage(PAGE);
  const report = await runFill(window, PROFILE, OPTIONS);
  assert.deepEqual(Array.from(report.unknown), ['推荐人']);
});

test('只填空白字段时不动已经填好的内容', async () => {
  const html = PAGE.replace('<input name="fullName">', '<input name="fullName" value="李四">');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, PROFILE, OPTIONS);
  assert.equal(field(dom, 'input[name="fullName"]').value, '李四');
  assert.equal(field(dom, 'input[name="mobile"]').value, '13800000000');
  assert.equal(report.filled.includes('姓名'), false);
});

test('关掉「只填空白字段」就会覆盖已有内容', async () => {
  const html = PAGE.replace('<input name="fullName">', '<input name="fullName" value="李四">');
  const { dom, window } = await createPage(html);
  await runFill(window, PROFILE, { ...OPTIONS, onlyEmpty: false });
  assert.equal(field(dom, 'input[name="fullName"]').value, '张三');
});

test('补充规则能填上脚本不认识的字段', async () => {
  const html = PAGE.replace(
    '<div class="row"><span>推荐人</span><input name="referee"></div>',
    '<div class="row"><span>意向事业部</span><input name="bu"></div>',
  );
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { ...PROFILE, extra: [{ match: '意向事业部', value: '云计算事业部' }] }, OPTIONS);
  assert.equal(field(dom, 'input[name="bu"]').value, '云计算事业部');
  assert.equal(report.unknown.length, 0);
});

test('教育经历分两段时按顺序取两段资料', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<div class="edu-block"><h3>教育经历</h3><p>',
    '请按从高到低的顺序填写教育经历，学校名称请填写毕业证上的全称，专业名称请填写完整的专业名称，'
      + '日期格式为年-月。若目前还在读，结束时间请填写预计毕业时间。每一段经历都要填写完整，'
      + '否则可能影响简历筛选结果。填写之前请先核对一遍个人信息，确认无误之后再提交。'
      + '如果表单里出现了这里没有提到的字段，可以在资料面板最底部的补充规则里加一条，'
      + '写明网页上的字段文字和要填进去的内容，保存之后再点一次一键填充即可。',
    '</p>',
    '<div class="edu-item"><span>学校名称</span><input name="s1"><span>专业名称</span><input name="m1"></div>',
    '<div class="edu-item"><span>学校名称</span><input name="s2"><span>专业名称</span><input name="m2"></div>',
    '</div>',
    '</form></body></html>',
  ].join('');
  const profile = Object.assign({}, PROFILE, {
    educations: [
      { school: '示例大学', major: '软件工程' },
      { school: '示例学院', major: '计算机科学与技术' },
    ],
  });
  const { dom, window } = await createPage(html);
  await runFill(window, profile, OPTIONS);
  assert.equal(field(dom, 'input[name="s1"]').value, '示例大学');
  assert.equal(field(dom, 'input[name="m1"]').value, '软件工程');
  assert.equal(field(dom, 'input[name="s2"]').value, '示例学院');
  assert.equal(field(dom, 'input[name="m2"]').value, '计算机科学与技术');
});
test('提示文字写在 value 里的表单：标签在 dt 里，字段一样能填上', async () => {
  const html = [
    '<!doctype html><html><body><form>',
    '<dl class="dl1"><dt>姓名<font class="red">*</font></dt><dd><input type="text" id="name" value="请输入姓名" class="inputxt inputName"></dd></dl>',
    '<dl class="dl1"><dt>手机号码<font class="red">*</font></dt><dd><input type="text" id="mobile" value="请输入手机号" class="inputxt"></dd></dl>',
    '<dl class="dl2"><dt>电子邮箱</dt><dd><input type="text" id="mail" value="请输入邮箱" class="inputxt"></dd></dl>',
    '</form></body></html>',
  ].join('');
  const { dom, window } = await createPage(html);
  const report = await runFill(window, { name: '朱时锋', phone: '17703847052', email: 'a@b.com', extra: [] }, OPTIONS);
  assert.equal(field(dom, '#name').value, '朱时锋');
  assert.equal(field(dom, '#mobile').value, '17703847052');
  assert.equal(field(dom, '#mail').value, 'a@b.com');
  assert.deepEqual(Array.from(report.manual), []);
});
