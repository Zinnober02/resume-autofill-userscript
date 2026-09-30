// 区块类型：一栏里都有哪些字段，决定「开始时间」这类中性名字属于哪一段经历
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { sectionBlockType, labelText, attrText, fieldHint } from '../src/core/dom.js';
import { pickKey } from '../src/core/rules.js';
import { createPage, runFill, field, storageWith } from './helpers/userscript-env.mjs';

function blockTypeOf(html, name) {
  const dom = new JSDOM(html, { url: 'https://x.test/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  const el = dom.window.document.querySelector('[name="' + name + '"]');
  return sectionBlockType(el);
}

const cell = (name, msg) => '<div class="cell"><input name="' + name + '" msg="' + msg + '"></div>';
const blockPage = (cells) => '<!doctype html><html><body><form><div class="mdf-table">' + cells.join('') + '</div></form></body></html>';

test('一栏里的字段决定这一栏是哪种经历', () => {
  assert.equal(blockTypeOf(blockPage([cell('a', '学历'), cell('b', '学位'), cell('c', '入学时间')]), 'c'), 'edu');
  assert.equal(blockTypeOf(blockPage([cell('a', '企业名称'), cell('b', '职位名称'), cell('c', '开始时间')]), 'c'), 'work');
  assert.equal(blockTypeOf(blockPage([cell('a', '专利类型'), cell('b', '专利名称'), cell('c', '发表日期')]), 'c'), 'patent');
  assert.equal(blockTypeOf(blockPage([cell('a', '期刊或会议名称'), cell('b', '影响因子'), cell('c', '接收/发表日期')]), 'c'), 'paper');
  assert.equal(blockTypeOf(blockPage([cell('a', '奖项类别'), cell('b', '奖励级别'), cell('c', '获奖时间')]), 'c'), 'award');
  assert.equal(blockTypeOf(blockPage([cell('a', '活动名称'), cell('b', '活动描述'), cell('c', '开始时间')]), 'c'), 'activity');
  assert.equal(blockTypeOf(blockPage([cell('a', '项目名称'), cell('b', '项目描述'), cell('c', '开始时间')]), 'c'), 'project');
  assert.equal(blockTypeOf(blockPage([cell('a', '证书名称'), cell('b', '证书等级'), cell('c', '获得时间')]), 'c'), 'cert');
  assert.equal(blockTypeOf(blockPage([cell('a', '关系'), cell('b', '家庭关系备注'), cell('c', '是否在集团工作')]), 'c'), 'family');
});

test('基本信息那一栏没有归属，判成空', () => {
  const html = blockPage([cell('a', '姓名'), cell('b', '移动电话'), cell('c', '电子邮箱')]);
  assert.equal(blockTypeOf(html, 'a'), '');
});

test('中性名字在区块类型确定后能认出来', () => {
  const dom = new JSDOM(blockPage([cell('a', '学历'), cell('b', '学位'), cell('c', '入学时间')]), { url: 'https://x.test/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  const el = dom.window.document.querySelector('[name="c"]');
  assert.equal(pickKey({ label: labelText(el), attr: attrText(el), hint: fieldHint(el), allowHint: false }), null);
  assert.equal(pickKey({ label: labelText(el), attr: attrText(el), block: sectionBlockType(el), hint: fieldHint(el), allowHint: false }), 'eduStart');
});

const EDU_PAGE = [
  '<!doctype html><html><body><form>',
  '<div class="mdf-table">',
  '<div class="cell"><input name="a" msg="学历"></div>',
  '<div class="cell"><input name="b" msg="学位"></div>',
  '<div class="cell"><input name="c" msg="入学时间"></div>',
  '<div class="cell"><input name="d" msg="毕业时间"></div>',
  '</div>',
  '</form></body></html>',
].join('');

test('教育经历那一栏的入学与毕业时间能填上', async () => {
  const profile = { educations: [{ degree: '硕士', degreeLevel: '硕士', eduStart: '2025-09-01', eduEnd: '2027-06-01' }] };
  const { dom, window } = await createPage(EDU_PAGE, undefined, { storage: storageWith(profile) });
  await runFill(window, profile, { onlyEmpty: true, autoConsent: false, highlight: false });
  assert.equal(field(dom, '[name="a"]').value, '硕士');
  assert.equal(field(dom, '[name="b"]').value, '硕士');
  assert.equal(field(dom, '[name="c"]').value, '2025-09-01');
  assert.equal(field(dom, '[name="d"]').value, '2027-06-01');
});
