// 字段值换算：教育经历分段、日期格式、补充规则、字段中文名
import { norm } from './rules.js';

export const EDU_KEYS = {
  school: 1, college: 1, major: 1, degree: 1, degreeLevel: 1,
  eduStart: 1, eduEnd: 1, gpa: 1, rank: 1,
};

export const BACHELOR_MAP = {
  school: 'bachelorSchool',
  college: 'bachelorCollege',
  major: 'bachelorMajor',
  eduStart: 'bachelorStart',
  eduEnd: 'bachelorEnd',
  degreeLevel: 'bachelorDegreeLevel',
  gpa: 'bachelorGpa',
  rank: 'bachelorRank',
};

// 一段教育经历到底填哪一组：优先看这一行有没有写「本科 / 硕士」，
// 没写就按从上到下的顺序，第一段当最高学历，第二段当本科，第三段忽略。
export function eduSegment(rowText, rowIndex) {
  const t = norm(rowText);
  if (/高中|中学|初中|小学|中专|技校/.test(t)) return 'skip';
  const iB = t.search(/本科|学士|bachelor/);
  const iM = t.search(/硕士|研究生|博士|master|phd/);
  if (iB >= 0 && iM >= 0) return iB < iM ? 'bachelor' : 'master';
  if (iB >= 0) return 'bachelor';
  if (iM >= 0) return 'master';
  if (rowIndex === 1) return 'master';
  if (rowIndex === 2) return 'bachelor';
  return 'skip';
}

export function valueForField(key, profile, rowText, rowIndex) {
  if (key === 'age') {
    const by = parseInt(String(profile.birthday || '').slice(0, 4), 10);
    if (!by) return '';
    const bm = parseInt(String(profile.birthday || '').slice(5, 7), 10);
    const now = new Date();
    let age = now.getFullYear() - by;
    if (bm && now.getMonth() + 1 < bm) age -= 1;
    return String(age);
  }
  if (!EDU_KEYS[key]) return profile[key] == null ? '' : profile[key];
  const seg = eduSegment(rowText, rowIndex);
  if (seg === 'skip') return '';
  if (seg === 'bachelor') {
    if (key === 'degree') return '本科';
    const mapped = BACHELOR_MAP[key];
    return mapped ? (profile[mapped] == null ? '' : profile[mapped]) : '';
  }
  return profile[key] == null ? '' : profile[key];
}

// 用户自定义的补充规则：在资料里加 { match: '网页上的文字', value: '要填的内容' }
export function matchExtra(profile, label, attr, rowText) {
  const list = profile && profile.extra;
  if (!list || !list.length) return null;
  const hay = norm(label + ' ' + attr + ' ' + rowText);
  if (!hay) return null;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item || !item.match || !item.value) continue;
    const m = norm(item.match);
    if (m && hay.indexOf(m) >= 0) return 'extra:' + item.value;
  }
  return null;
}

// 日期输入框按控件要求的格式输出
export function formatValue(el, value) {
  const v = String(value);
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(v)) return v;
  const type = (el.type || '').toLowerCase();
  const full = v.length === 7 ? v + '-01' : v;
  if (type === 'month') return v.slice(0, 7);
  if (type === 'date') return full;
  const ph = el.getAttribute('placeholder') || '';
  if (ph.indexOf('/') >= 0) return full.replace(/-/g, '/');
  if (/年.*月/.test(ph)) return full.slice(0, 4) + '年' + full.slice(5, 7) + '月';
  return v;
}

export const FIELD_NAMES = {
  name: '姓名', englishName: '英文名', gender: '性别', birthday: '出生年月', age: '年龄',
  nation: '民族', politicalStatus: '政治面貌', maritalStatus: '婚姻状况', idCard: '身份证号',
  phone: '手机号', email: '邮箱', wechat: '微信', hometown: '籍贯', hukou: '户口所在地',
  currentCity: '现居城市', address: '地址', zipcode: '邮编',
  applyPosition: '意向岗位', expectCity: '意向城市', expectSalary: '期望薪资',
  availableDate: '到岗时间', source: '获知渠道', website: '个人网站', github: 'GitHub',
  school: '学校', college: '学院', major: '专业', degree: '学历', degreeLevel: '学位',
  eduStart: '入学时间', eduEnd: '毕业时间', gpa: 'GPA', rank: '排名', schoolCity: '学校所在地',
  bachelorSchool: '本科学校', bachelorCollege: '本科学院', bachelorMajor: '本科专业',
  bachelorStart: '本科入学', bachelorEnd: '本科毕业', bachelorDegreeLevel: '本科学位',
  bachelorGpa: '本科GPA', bachelorRank: '本科排名',
  company: '公司', department: '部门', title: '职位', workStart: '开始时间', workEnd: '结束时间',
  workCity: '工作城市', workDesc: '工作描述', projectDesc: '项目描述',
  selfEvaluation: '自我评价', skills: '专业技能',
  emergencyName: '紧急联系人', emergencyRelation: '与本人关系', emergencyPhone: '紧急联系人电话',
};
