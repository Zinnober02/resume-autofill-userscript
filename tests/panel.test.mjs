// 网页面板测试：按钮、编辑视图、导出下载
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, shadowOf, buttonByText, storageWith } from './helpers/userscript-env.mjs';

const PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="row"><span>姓名</span><input name="fullName"></div>',
  '<div class="row"><span>手机号码</span><input name="mobile"></div>',
  '<div class="row"><span>电子邮箱</span><input name="email" type="email"></div>',
  '<div class="row"><span>毕业院校</span><input name="school"></div>',
  '<div class="row"><span>所学专业</span><input name="major"></div>',
  '<div class="row"><span>工作内容</span><textarea name="workDesc"></textarea></div>',
  '</form></body></html>',
].join('');

test('申请表页面上会出现填表按钮，点开是面板', async () => {
  const { window } = await createPage(PAGE);
  const shadow = shadowOf(window);
  const pill = shadow.querySelector('.pill');
  assert.ok(pill, '应该有右下角的填表按钮');
  assert.equal(pill.textContent, '填表');
  pill.click();
  const card = shadow.querySelector('.card');
  assert.ok(card, '点按钮后应该出现面板');
  assert.match(card.textContent, /一键填充本页表单/);
  assert.match(card.textContent, /资料只存在你自己的浏览器里/);
});

test('编辑资料视图列出全部字段，保存后写进存储', async () => {
  const { window, store } = await createPage(PAGE);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '编辑资料').click();
  const fields = shadow.querySelectorAll('.f');
  assert.equal(fields.length, 41);
  const labels = Array.from(shadow.querySelectorAll('.f label')).map((n) => n.textContent);
  for (const name of ['姓名', '手机号国家 / 地区', '手机号', '邮箱', '证件类型', '健康状况', '高考生源地', '意向岗位', '是否服从调剂', '英语水平', '与本人关系', '自我评价']) {
    assert.ok(labels.includes(name), '编辑视图缺少字段：' + name);
  }
  const titles = Array.from(shadow.querySelectorAll('h4')).map((n) => n.textContent);
  for (const name of ['基本信息', '求职意向', '教育经历', '工作 / 实习经历', '紧急联系人', '补充规则（认不出来的字段写这里）']) {
    assert.ok(titles.includes(name), '编辑视图缺少分组：' + name);
  }
  const nameInput = fields[0].querySelector('input');
  nameInput.value = '张三';
  nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  buttonByText(shadow, '保存并返回').click();
  const saved = store.get('ra_data_v1');
  assert.ok(saved, '保存后应该写入存储');
  assert.equal(saved.profiles[saved.current].name, '张三');
});

test('教育经历按卡片增删，保存后写进 educations 数组', async () => {
  const { window, store } = await createPage(PAGE);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '编辑资料').click();
  assert.equal(shadow.querySelectorAll('.block').length, 0);
  buttonByText(shadow, '+ 加一段').click();
  const blocks = shadow.querySelectorAll('.block');
  assert.equal(blocks.length, 1);
  assert.equal(shadow.querySelectorAll('.f').length, 41 + 9);
  const school = blocks[0].querySelector('input');
  school.value = '示例大学';
  school.dispatchEvent(new window.Event('input', { bubbles: true }));
  buttonByText(shadow, '保存并返回').click();
  const saved = store.get('ra_data_v1');
  assert.equal(saved.profiles[saved.current].educations.length, 1);
  assert.equal(saved.profiles[saved.current].educations[0].school, '示例大学');
});

test('日期用日期控件，省市区用三级联动', async () => {
  const { window } = await createPage(PAGE);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '编辑资料').click();
  const dates = shadow.querySelectorAll('input[type="date"]');
  assert.ok(dates.length >= 2, '出生日期与到岗时间应该是日期控件');
  const regions = shadow.querySelectorAll('.region');
  assert.equal(regions.length, 4, '籍贯、户口所在地、现居城市、高考生源地应该是三级联动');
  const selects = regions[0].querySelectorAll('select');
  assert.equal(selects.length, 2, '省与市是下拉');
  const area = regions[0].querySelector('input[placeholder="区 / 县"]');
  assert.ok(area, '区县是能直接填的输入框');
  assert.ok(area.getAttribute('list'), '区县输入框要挂上候选列表');
  assert.ok(selects[0].options.length > 30, '省下拉应该有全国省份');
  assert.equal(selects[1].options.length, 1, '没选省之前市是空的');
  selects[0].value = selects[0].options[1].value;
  selects[0].dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok(selects[1].options.length > 1, '选了省之后市应该有选项');
});

test('补充规则能加一条并随资料一起保存', async () => {
  const { window, store } = await createPage(PAGE);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '编辑资料').click();
  buttonByText(shadow, '+ 加一条').click();
  const row = shadow.querySelector('.extra');
  const inputs = row.querySelectorAll('input');
  inputs[0].value = '是否服从调剂';
  inputs[0].dispatchEvent(new window.Event('input', { bubbles: true }));
  inputs[1].value = '是';
  inputs[1].dispatchEvent(new window.Event('input', { bubbles: true }));
  buttonByText(shadow, '保存并返回').click();
  const saved = store.get('ra_data_v1');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.profiles[saved.current].extra)), [{ match: '是否服从调剂', value: '是' }]);
});

test('导出资料文件会生成 我的资料.json', async () => {
  const { window, store, blobs, downloads } = await createPage(PAGE);
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '编辑资料').click();
  const nameInput = shadow.querySelectorAll('.f')[0].querySelector('input');
  nameInput.value = '张三';
  nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  buttonByText(shadow, '保存并返回').click();
  buttonByText(shadow, '导出资料文件').click();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].download, '我的资料.json');
  const text = await blobs[0].text();
  const data = JSON.parse(text);
  assert.equal(data.v, 1);
  assert.equal(data.profiles[data.current].name, '张三');
  assert.ok(store.has('ra_data_v1'));
});
test('点一键填充后，面板里出现结果区', async () => {
  const { window } = await createPage(PAGE, undefined, {
    storage: storageWith({ name: '张三', phone: '13800000000', email: 'zhangsan@example.com' }),
  });
  const shadow = shadowOf(window);
  shadow.querySelector('.pill').click();
  buttonByText(shadow, '一键填充本页表单').click();
  await new Promise((r) => setTimeout(r, 3000));
  assert.match(shadow.textContent, /已填好/);
  assert.equal(window.document.querySelector('input[name="fullName"]').value, '张三');
});
