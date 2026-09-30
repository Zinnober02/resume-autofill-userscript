// 字段识别规则的单元测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickKey, norm, sectionType } from '../src/core/rules.js';

const key = (label, attr, hint) => pickKey({ label, attr, hint, allowHint: !!hint });

test('基本信息字段的常见叫法', () => {
  assert.equal(key('姓名'), 'name');
  assert.equal(key('真实姓名'), 'name');
  assert.equal(key('', 'fullName'), 'name');
  assert.equal(key('手机号码'), 'phone');
  assert.equal(key('', 'mobile'), 'phone');
  assert.equal(key('电子邮箱'), 'email');
  assert.equal(key('出生年月'), 'birthday');
  assert.equal(key('身份证号'), 'idCard');
  assert.equal(key('政治面貌'), 'politicalStatus');
  assert.equal(key('婚姻状况'), 'maritalStatus');
});

test('求职意向字段的常见叫法', () => {
  assert.equal(key('应聘职位'), 'applyPosition');
  assert.equal(key('期望城市'), 'expectCity');
  assert.equal(key('期望薪资'), 'expectSalary');
  assert.equal(key('最快到岗时间'), 'availableDate');
  assert.equal(key('获知渠道'), 'source');
  assert.equal(key('GitHub'), 'github');
});

test('教育字段的常见叫法', () => {
  assert.equal(key('毕业院校'), 'school');
  assert.equal(key('所学专业'), 'major');
  assert.equal(key('最高学历'), 'degree');
  assert.equal(key('学位'), 'degreeLevel');
  assert.equal(key('GPA'), 'gpa');
  assert.equal(key('专业排名'), 'rank');
});

test('工作字段的常见叫法', () => {
  assert.equal(key('公司名称'), 'company');
  assert.equal(key('部门'), 'department');
  assert.equal(key('职位'), 'title');
  assert.equal(key('工作内容'), 'workDesc');
  assert.equal(key('项目描述'), 'projectDesc');
});

test('容易混淆的字段不会认错', () => {
  assert.equal(key('公司名称'), 'company');
  assert.equal(key('紧急联系人'), 'emergencyName');
  assert.equal(key('紧急联系人电话'), 'emergencyPhone');
  assert.equal(key('籍贯'), 'hometown');
  assert.equal(key('户口所在地'), 'hukou');
  assert.equal(key('现居城市'), 'currentCity');
  assert.equal(key('专业排名'), 'rank');
  assert.equal(key('专业技能'), 'skills');
});

test('教育区块内的开始结束时间才算入学毕业时间', () => {
  assert.equal(key('开始时间', '', '教育经历 学校 专业'), 'eduStart');
  assert.equal(key('结束时间', '', '教育经历 学校 专业'), 'eduEnd');
  assert.equal(key('开始时间', '', '工作经历 公司 职位'), 'workStart');
  assert.equal(key('结束时间', '', '工作经历 公司 职位'), 'workEnd');
});

test('认不出来的字段返回 null', () => {
  assert.equal(key('推荐人'), null);
  assert.equal(key('请输入验证码'), null);
});

test('norm 统一全角、大小写与标点', () => {
  assert.equal(norm('Ｅ-mail 地址：'), 'email地址');
  assert.equal(norm('  姓名 '), '姓名');
  assert.equal(norm(null), '');
});

test('sectionType 区分教育区块与工作区块', () => {
  assert.equal(sectionType('教育经历'), 'edu');
  assert.equal(sectionType('工作经历'), 'work');
  assert.equal(sectionType('基本信息'), '');
});
