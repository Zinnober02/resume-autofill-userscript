// 字段值换算：多段经历取值、日期格式、补充规则、字段中文名
import { norm } from './rules.js';

export const EDU_KEYS = {
  school: 1, college: 1, major: 1, degree: 1, degreeLevel: 1,
  eduStart: 1, eduEnd: 1, gpa: 1, rank: 1,
};

export const WORK_KEYS = {
  company: 1, department: 1, title: 1, workCity: 1, workStart: 1, workEnd: 1, workDesc: 1,
};

export const CERT_KEYS = { certName: 1, certLevel: 1, certDate: 1 };

export const PATENT_KEYS = { patentName: 1, patentType: 1, patentDate: 1, patentStage: 1, patentAuthorRank: 1 };

export const PAPER_KEYS = {
  paperName: 1, journalName: 1, journalLevel: 1, paperStatus: 1,
  paperDate: 1, paperAuthorRank: 1, impactFactor: 1,
};

export const AWARD_KEYS = {
  awardName: 1, awardCategory: 1, awardLevel: 1, awardGrade: 1, awardDate: 1, awardIssuer: 1,
};

export const FAMILY_KEYS = { familyName: 1, familyRelation: 1, familyNote: 1, familyInCompany: 1 };

export const ACTIVITY_KEYS = {
  activityName: 1, activityRole: 1, activityStart: 1, activityEnd: 1, activityDesc: 1,
};

export const PROJECT_KEYS = {
  projectName: 1, projectRole: 1, projectStart: 1, projectEnd: 1, projectDesc: 1,
};

// 一组字段对应资料里的哪个数组
export const KEY_GROUPS = {
  edu: EDU_KEYS,
  work: WORK_KEYS,
  cert: CERT_KEYS,
  patent: PATENT_KEYS,
  paper: PAPER_KEYS,
  award: AWARD_KEYS,
  family: FAMILY_KEYS,
  activity: ACTIVITY_KEYS,
  project: PROJECT_KEYS,
};

export const GROUP_ARRAYS = {
  edu: 'educations',
  work: 'works',
  cert: 'certificates',
  patent: 'patents',
  paper: 'papers',
  award: 'awards',
  family: 'family',
  activity: 'activities',
  project: 'projects',
};

export function groupOf(key) {
  const groups = Object.keys(KEY_GROUPS);
  for (let i = 0; i < groups.length; i += 1) {
    if (KEY_GROUPS[groups[i]][key]) return groups[i];
  }
  return '';
}

// 地址类字段：资料里存省市区整串，遇到省 / 市 / 区分开的控件时分段填
export const ADDRESS_KEYS = { hometown: 1, hukou: 1, currentCity: 1, gaokaoOrigin: 1 };

// 需要按日期格式填写的字段，用来识别年 / 月 / 日分开的控件组
export const DATE_KEYS = {
  birthday: 1, eduStart: 1, eduEnd: 1, workStart: 1, workEnd: 1, availableDate: 1,
  certDate: 1, patentDate: 1, paperDate: 1, awardDate: 1, activityStart: 1, activityEnd: 1,
  projectStart: 1, projectEnd: 1,
};

// 资料里的日期可能是 2003-09-01 或 2003-09-01 09:30，统一取出各部分
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

// index 是页面上第几段，从 1 开始
export function valueForField(key, profile, index) {
  if (key === 'age') {
    const by = parseInt(String(profile.birthday || '').slice(0, 4), 10);
    if (!by) return '';
    const bm = parseInt(String(profile.birthday || '').slice(5, 7), 10);
    const now = new Date();
    let age = now.getFullYear() - by;
    if (bm && now.getMonth() + 1 < bm) age -= 1;
    return String(age);
  }
  const group = groupOf(key);
  if (group) {
    const item = (profile[GROUP_ARRAYS[group]] || [])[index - 1];
    return item && item[key] != null ? item[key] : '';
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

// 控件只收年月的三种线索：placeholder 里的符号、网页上写的字段名、maxlength
function monthGranularity(el, label) {
  const ph = String(el.getAttribute('placeholder') || '');
  const flat = ph.toLowerCase();
  const dayInPlaceholder = /(^|[^a-z])d{1,2}([^a-z]|$)/.test(flat) || /[日号]/.test(ph);
  const monthInPlaceholder = /(^|[^a-z])m{1,2}([^a-z]|$)/.test(flat) || /月/.test(ph);
  if (dayInPlaceholder) return false;
  if (monthInPlaceholder) return true;
  if (Number(el.getAttribute('maxlength')) === 7) return true;
  const name = String(label || '');
  if (/[日号]/.test(name)) return false;
  if (/月/.test(name)) return true;
  return false;
}

// 日期输入框按控件要求的格式输出；返回空串表示这个控件表达不了资料里的日期
export function formatValue(el, value, label) {
  const date = splitDateTime(value);
  if (!date) return String(value);
  const type = (el.type || '').toLowerCase();
  const full = date.year + '-' + date.month + '-' + date.day;
  if (type === 'month') return date.year + '-' + date.month;
  if (type === 'date') return full;
  if (type === 'datetime-local') return full + 'T' + (date.time || '00:00');
  if (type === 'time') return date.time;
  const ph = el.getAttribute('placeholder') || '';
  if (monthGranularity(el, label)) {
    if (ph.indexOf('/') >= 0) return date.year + '/' + date.month;
    if (/年/.test(ph)) return date.year + '年' + date.month + '月';
    if (/[.．]/.test(ph)) return date.year + '.' + date.month;
    if (ph !== '') return date.year + '-' + date.month;
    return date.year + '-' + date.month;
  }
  if (/年/.test(ph) && /[日号]/.test(ph)) return date.year + '年' + date.month + '月' + date.day + '日';
  if (ph.indexOf('/') >= 0) return full.replace(/-/g, '/');
  if (/年.*月/.test(ph)) return date.year + '年' + date.month + '月';
  return String(value);
}

export const FIELD_NAMES = {
  name: '姓名', englishName: '英文名', gender: '性别', birthday: '出生日期', age: '年龄',
  nation: '民族', politicalStatus: '政治面貌', maritalStatus: '婚姻状况',
  idType: '证件类型', idCard: '身份证号',
  phone: '手机号', email: '邮箱', wechat: '微信', hometown: '籍贯',
  hukou: '户口所在地', hukouType: '户口类型', currentCity: '现居城市', address: '地址', zipcode: '邮编',
  health: '健康状况', gaokaoOrigin: '高考生源地', isFreshGraduate: '是否应届毕业生',
  applyPosition: '意向岗位', expectCity: '意向城市', expectSalary: '期望薪资',
  availableDate: '到岗时间', jobType: '期望工作性质', source: '获知渠道',
  website: '个人网站', github: 'GitHub', referralCode: '内推码', adjust: '是否服从调剂',
  englishLevel: '英语水平', otherLanguages: '其他外语水平', itSkills: 'IT 技能掌握程度', hobbies: '个人爱好',
  school: '学校', college: '学院', major: '专业', degree: '学历', degreeLevel: '学位',
  eduStart: '入学时间', eduEnd: '毕业时间', gpa: 'GPA', rank: '排名',
  company: '公司', department: '部门', title: '职位', workStart: '开始时间', workEnd: '结束时间',
  workCity: '工作城市', workDesc: '工作描述',
  certName: '证书名称', certLevel: '证书等级', certDate: '证书获得时间',
  patentName: '专利名称', patentType: '专利类型', patentDate: '专利发表日期',
  patentStage: '专利阶段', patentAuthorRank: '专利作者排序',
  paperName: '论文名称', journalName: '期刊或会议名称', journalLevel: '期刊或会议水平',
  paperStatus: '论文发表状态', paperDate: '论文接收或发表日期', paperAuthorRank: '论文作者排序',
  impactFactor: '影响因子',
  awardName: '奖励名称', awardCategory: '奖项类别', awardLevel: '奖励级别', awardGrade: '奖励等级',
  awardDate: '获奖时间', awardIssuer: '颁发单位',
  familyName: '家庭成员姓名', familyRelation: '家庭关系', familyNote: '家庭关系备注',
  familyInCompany: '是否在本单位工作',
  activityName: '活动名称', activityRole: '担任职务', activityStart: '活动开始时间',
  activityEnd: '活动结束时间', activityDesc: '活动描述',
  projectName: '项目名称', projectRole: '项目职务', projectStart: '项目开始时间',
  projectEnd: '项目结束时间',
  projectDesc: '项目描述', selfEvaluation: '自我评价', skills: '专业技能',
  emergencyName: '紧急联系人', emergencyRelation: '与本人关系', emergencyPhone: '紧急联系人电话',
};
