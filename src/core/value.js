// 字段值换算：教育经历分段、日期格式、补充规则、字段中文名
import { norm } from './rules.js';

export const EDU_KEYS = {
  school: 1, college: 1, major: 1, degree: 1, degreeLevel: 1,
  eduStart: 1, eduEnd: 1, gpa: 1, rank: 1,
};

export const WORK_KEYS = {
  company: 1, department: 1, title: 1, workCity: 1, workStart: 1, workEnd: 1, workDesc: 1,
};

// 需要按日期格式填写的字段，用来识别年 / 月 / 日分开的控件组
export const DATE_KEYS = {
  birthday: 1, eduStart: 1, eduEnd: 1, workStart: 1, workEnd: 1, availableDate: 1,
  bachelorStart: 1, bachelorEnd: 1,
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

// 多段经历里每一项的字段名，与网页字段名的对应关系
export const EDU_ITEM_FIELDS = {
  school: 'school', college: 'college', major: 'major', degree: 'degree',
  degreeLevel: 'degreeLevel', eduStart: 'start', eduEnd: 'end', gpa: 'gpa', rank: 'rank',
};

export const WORK_ITEM_FIELDS = {
  company: 'company', department: 'department', title: 'title',
  workCity: 'city', workStart: 'start', workEnd: 'end', workDesc: 'desc',
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

// 资料里的日期可能是 2003-09、2003-09-01 或 2003-09-01 09:30，统一取出各部分
export function splitDateTime(value) {
  const s = String(value == null ? '' : value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const hour = m[4] == null ? '' : ('0' + m[4]).slice(-2) + ':' + m[5];
  return {
    year: m[1],
    month: ('0' + m[2]).slice(-2),
    day: m[3] == null ? '01' : ('0' + m[3]).slice(-2),
    hasDay: m[3] != null,
    time: hour,
  };
}

// 一段教育经历取哪一组资料：填了多段就按顺序取，只有旧式扁平字段时按最高学历 / 本科取
function educationValue(key, profile, rowText, rowIndex) {
  const list = profile && profile.educations;
  if (list && list.length) {
    const item = list[rowIndex - 1];
    if (!item) return '';
    const field = EDU_ITEM_FIELDS[key];
    return item[field] == null ? '' : item[field];
  }
  const seg = eduSegment(rowText, rowIndex);
  if (seg === 'skip') return '';
  if (seg === 'bachelor') {
    if (key === 'degree') return '本科';
    const mapped = BACHELOR_MAP[key];
    return mapped ? (profile[mapped] == null ? '' : profile[mapped]) : '';
  }
  return profile[key] == null ? '' : profile[key];
}

function workValue(key, profile, rowIndex) {
  const list = profile && profile.works;
  if (!list || !list.length) return null;
  const item = list[rowIndex - 1];
  if (!item) return '';
  const field = WORK_ITEM_FIELDS[key];
  return item[field] == null ? '' : item[field];
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
  if (EDU_KEYS[key]) return educationValue(key, profile, rowText, rowIndex);
  if (WORK_KEYS[key]) {
    const work = workValue(key, profile, rowIndex);
    if (work !== null) return work;
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

// 日期输入框按控件要求的格式输出；返回空串表示这个控件表达不了资料里的日期
export function formatValue(el, value) {
  const date = splitDateTime(value);
  if (!date) return String(value);
  const type = (el.type || '').toLowerCase();
  const full = date.year + '-' + date.month + '-' + date.day;
  if (type === 'month') return date.year + '-' + date.month;
  if (type === 'date') return full;
  if (type === 'datetime-local') return full + 'T' + (date.time || '00:00');
  if (type === 'time') return date.time;
  const ph = el.getAttribute('placeholder') || '';
  if (/年/.test(ph) && /[日号]/.test(ph)) return date.year + '年' + date.month + '月' + date.day + '日';
  if (ph.indexOf('/') >= 0) return full.replace(/-/g, '/');
  if (/年.*月/.test(ph)) return date.year + '年' + date.month + '月';
  return String(value);
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
