// 资料字段模板：脚本本身不含任何个人信息
// 教育经历、工作经历、证书、专利、论文、奖励、家庭关系都放在数组里，页面上第几段就取第几项
export const SEED_PROFILES = {
  '默认': {
    name: '',
    englishName: '',
    gender: '',
    birthday: '',
    nation: '',
    politicalStatus: '',
    maritalStatus: '',
    idType: '',
    idCard: '',
    phoneCountry: '中国大陆',
    phone: '',
    email: '',
    wechat: '',
    hometown: '',
    hukou: '',
    hukouType: '',
    currentCity: '',
    address: '',
    zipcode: '',
    health: '',
    gaokaoOrigin: '',
    isFreshGraduate: '',
    applyPosition: '',
    expectCity: '',
    expectSalary: '',
    availableDate: '',
    jobType: '',
    source: '',
    website: '',
    github: '',
    referralCode: '',
    adjust: '',
    englishLevel: '',
    otherLanguages: '',
    itSkills: '',
    hobbies: '',
    selfEvaluation: '',
    skills: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    educations: [],
    works: [],
    certificates: [],
    patents: [],
    papers: [],
    awards: [],
    family: [],
    activities: [],
    projects: [],
    extra: [],
  },
};

export const EDU_ITEM_FORM = [
  ['school', '学校', 'text'],
  ['college', '学院', 'text'],
  ['major', '专业', 'text'],
  ['researchArea', '研究方向', 'text'],
  ['majorCourses', '主修课程', 'text'],
  ['majorDesc', '专业描述', 'textarea'],
  ['degree', '学历', 'select', ['', '硕士', '博士', '本科', '大专']],
  ['degreeLevel', '学位', 'select', ['', '学士', '硕士', '博士']],
  ['eduStart', '入学时间', 'date'],
  ['eduEnd', '毕业时间', 'date'],
  ['gpa', 'GPA/绩点', 'text'],
  ['rank', '排名', 'text'],
];

export const WORK_ITEM_FORM = [
  ['company', '公司', 'text'],
  ['department', '部门', 'text'],
  ['title', '职位', 'text'],
  ['workCity', '工作城市', 'text'],
  ['workStart', '开始时间', 'date'],
  ['workEnd', '结束时间', 'date'],
  ['workDesc', '工作内容描述', 'textarea'],
];

export const CERT_ITEM_FORM = [
  ['certName', '证书名称', 'text'],
  ['certLevel', '等级', 'text'],
  ['certDate', '获得时间', 'date'],
];

export const PATENT_ITEM_FORM = [
  ['patentName', '专利名称', 'text'],
  ['patentType', '专利类型', 'select', ['', '发明专利', '实用新型专利', '外观设计专利']],
  ['patentDate', '发表日期', 'date'],
  ['patentStage', '当前阶段', 'select', ['', '申请阶段', '受理阶段', '初步审查阶段', '公布阶段', '实质审查阶段', '授权阶段']],
  ['patentAuthorRank', '作者排序', 'select', ['', '第一作者', '前三作者', '其他作者']],
];

export const PAPER_ITEM_FORM = [
  ['paperName', '论文名称', 'text'],
  ['journalName', '期刊或会议名称', 'text'],
  ['journalLevel', '期刊或会议水平', 'select', ['', 'SCI', 'SCI-E', 'EI', 'IEEE', 'ISTP', '中文核心期刊', '其他']],
  ['paperStatus', '发表状态', 'select', ['', '已发表', '已接收', '投稿中', '其它']],
  ['paperDate', '接收或发表日期', 'date'],
  ['paperAuthorRank', '作者排序', 'select', ['', '第一作者', '前三作者', '其他作者']],
  ['impactFactor', '影响因子', 'text'],
];

export const AWARD_ITEM_FORM = [
  ['awardName', '奖励名称', 'text'],
  ['awardCategory', '奖项类别', 'select', ['', '奖学金', '竞赛类', '其它类']],
  ['awardLevel', '奖励级别', 'select', ['', '国际级', '国家级', '省部级', '地市级', '院校级', '其他']],
  ['awardGrade', '奖励等级', 'select', ['', '一等', '二等', '三等', '其它']],
  ['awardDate', '获奖时间', 'date'],
  ['awardIssuer', '颁发单位', 'text'],
];

export const ACTIVITY_ITEM_FORM = [
  ['activityName', '活动名称', 'text'],
  ['activityRole', '担任职务', 'text'],
  ['activityStart', '开始时间', 'date'],
  ['activityEnd', '结束时间', 'date'],
  ['activityDesc', '活动描述', 'textarea'],
];

export const PROJECT_ITEM_FORM = [
  ['projectName', '项目名称', 'text'],
  ['projectRole', '项目职务', 'text'],
  ['projectStart', '开始时间', 'date'],
  ['projectEnd', '结束时间', 'date'],
  ['projectDesc', '项目描述', 'textarea'],
];

export const FAMILY_ITEM_FORM = [
  ['familyName', '姓名', 'text'],
  ['familyRelation', '关系', 'select', ['', '父子', '父女', '母子', '母女', '兄弟', '兄妹', '姐妹', '姐弟', '夫妻', '其它']],
  ['familyNote', '备注', 'text'],
  ['familyInCompany', '是否在本单位工作', 'select', ['', '是', '否']],
];
