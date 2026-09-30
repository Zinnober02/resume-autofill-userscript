// 字段识别规则：把网页上的标签文字映射成资料字段名
export const EDU_RE = /教育|学校|院校|学院|大学|学历|学位|就读|毕业|专业|硕士|本科|博士|university|school|education|academic/;
export const WORK_RE = /工作|实习|公司|单位|职位|任职|部门|雇主|company|employer|work|experience|intern/;
export const CERT_RE = /证书|资格证|执业资格|认证/;
export const PATENT_RE = /专利|发明专利|实用新型|外观设计/;
export const PAPER_RE = /论文|期刊|学术成果|文献/;
export const AWARD_RE = /奖励|奖项|荣誉|获奖|奖学金|竞赛/;
export const FAMILY_RE = /家庭|亲属|家属/;
export const ACTIVITY_RE = /活动|社团|社会实践/;
export const PROJECT_RE = /项目|课题/;

// 区块类型按关键词判断：同名或近名的字段（开始时间、姓名、关系）要靠它区分
export const SECTION_RES = [
  ['patent', PATENT_RE],
  ['paper', PAPER_RE],
  ['award', AWARD_RE],
  ['family', FAMILY_RE],
  ['cert', CERT_RE],
  ['activity', ACTIVITY_RE],
  ['project', PROJECT_RE],
  ['edu', EDU_RE],
  ['work', WORK_RE],
];

export function sectionType(text) {
  for (let i = 0; i < SECTION_RES.length; i += 1) {
    if (SECTION_RES[i][1].test(text)) return SECTION_RES[i][0];
  }
  return '';
}

// 把全角转半角、去掉空格标点，只留小写字母、数字、汉字。
// 这样「E-mail 地址：」和「email地址」会变成同一个串，识别更宽容。
export const norm = (s) => String(s == null ? '' : s)
  .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');

// 字段识别规则，从上往下依次匹配，先命中者生效 —— 特征强的规则必须写在前面。
//   re  : 命中关键词（在小写、无空格、无标点的文本上匹配）
//   neg : 出现这些词就否决，避免把「公司名称」当成姓名
//   ctx : 只在指定的区块内才生效，可以写多个区块
export const RULES = [
  // 带区块限定的规则放在前面：这些字段名（职务、开始时间、姓名、关系）在别处有别的含义，
  // 先让专用规则有机会命中，通用的「职位」「姓名」规则排在后面
  { key: 'activityEnd', re: /结束时间|结束日期|终止时间/, ctx: ['activity'] },
  { key: 'activityStart', re: /开始时间|开始日期|起始时间/, ctx: ['activity'] },
  { key: 'activityRole', re: /^职务$|担任职务|担任角色/, ctx: ['activity'] },
  { key: 'activityName', re: /活动名称|社团名称|社会实践名称/, ctx: ['activity'] },
  { key: 'activityDesc', re: /活动描述|活动内容|活动简介/, ctx: ['activity'] },

  { key: 'projectEnd', re: /结束时间|结束日期|终止时间/, ctx: ['project'] },
  { key: 'projectStart', re: /开始时间|开始日期|起始时间/, ctx: ['project'] },
  { key: 'projectRole', re: /项目职务|项目角色|担任角色/, ctx: ['project'] },
  { key: 'projectName', re: /项目名称|课题名称|项目标题/, ctx: ['project'] },

  { key: 'idType', re: /证件类型|证件类别|身份类型|证件种类/ },
  { key: 'idCard', re: /身份证|证件号码|证件号|身份号码|idcardno|idcardnumber|identityno|identitynumber|residentid/ },
  { key: 'englishName', re: /英文名|英文姓名|拼音姓名|拼音名|englishname|nameinenglish|nameinpinyin|pinyin|forename/ },

  { key: 'emergencyPhone', re: /(紧急|亲属|监护人).*(电话|手机|号码|联系方式)|(电话|手机|号码).*紧急|emergency(phone|tel|contact|number)/ },
  { key: 'emergencyRelation', re: /与本人关系|亲属关系|紧急联系人关系|relationship/ },
  { key: 'emergencyName', re: /紧急联系人|紧急情况联系人|监护人/ },

  { key: 'familyInCompany', re: /是否在.{0,8}(工作|任职)|在本单位工作|是否在.{0,8}集团/, ctx: ['family'] },
  { key: 'familyNote', re: /备注|说明/, ctx: ['family'] },
  { key: 'familyRelation', re: /^关系$|与本人关系|亲属关系|家庭成员关系|家庭关系/, ctx: ['family'] },
  { key: 'familyName', re: /家庭成员姓名|家属姓名|亲属姓名|^姓名$/, ctx: ['family'] },

  { key: 'certLevel', re: /证书等级|证书级别|资格等级/, ctx: ['cert'] },
  { key: 'certDate', re: /证书.{0,4}(时间|日期)|获得时间|取得时间/, ctx: ['cert'] },
  { key: 'certName', re: /证书名称|资格证书|专业资格证书|证书/, ctx: ['cert'] },

  { key: 'patentType', re: /专利类型|专利种类/, ctx: ['patent'] },
  { key: 'patentStage', re: /申请阶段|受理阶段|审查阶段|公布阶段|授权阶段|当前阶段|专利阶段|发表阶段/, ctx: ['patent'] },
  { key: 'patentDate', re: /发表日期|申请日期|公开日期|授权日期/, ctx: ['patent'] },
  { key: 'patentAuthorRank', re: /作者排序|作者排名|第几作者/, ctx: ['patent', 'paper'] },
  { key: 'patentName', re: /专利名称|专利号|专利标题|发明名称/, ctx: ['patent'] },

  { key: 'journalLevel', re: /期刊.{0,4}(水平|级别|等级)|会议.{0,4}(水平|级别)|收录类型|检索类型/, ctx: ['paper'] },
  { key: 'paperStatus', re: /发表状态|论文状态|已发表|已接收|投稿中/, ctx: ['paper'] },
  { key: 'impactFactor', re: /影响因子/, ctx: ['paper'] },
  { key: 'paperDate', re: /接收.{0,4}(日期|时间)|发表.{0,4}(日期|时间)/, ctx: ['paper'] },
  { key: 'journalName', re: /期刊|会议名称|发表刊物|刊物名称/, ctx: ['paper'] },
  { key: 'paperName', re: /论文名称|论文题目|论文标题/, ctx: ['paper'] },

  { key: 'awardCategory', re: /奖项类别|奖励类别|奖项类型|奖励类型/, ctx: ['award'] },
  { key: 'awardLevel', re: /奖励级别|奖项级别/, ctx: ['award'] },
  { key: 'awardGrade', re: /奖励等级|奖项等级/, ctx: ['award'] },
  { key: 'awardDate', re: /获奖时间|获奖日期|奖励时间|获奖年月/, ctx: ['award'] },
  { key: 'awardIssuer', re: /颁发单位|颁奖单位|授予单位|颁发机构/, ctx: ['award'] },
  { key: 'awardName', re: /奖励名称|奖项名称|获奖名称/, ctx: ['award'] },

  { key: 'birthday', re: /出生日期|出生年月|出生时间|生日|birth|dob|dateofbirth/, neg: /出生地|籍贯|省市|地区|国家/ },
  { key: 'age', re: /年龄|^age$/, neg: /年龄段|年龄要求/ },
  { key: 'gender', re: /性别|^gender$|^sex$/, neg: /性别要求|性别限制|性别偏好/ },
  { key: 'nation', re: /民族|ethnic/, neg: /国籍|国家/ },
  { key: 'politicalStatus', re: /政治面貌|党派|partyaffiliation|politicalstatus/ },
  { key: 'maritalStatus', re: /婚姻|婚否|marital|marriage/ },
  { key: 'health', re: /健康状况|健康情况|身体状况|健康状态/ },
  { key: 'gaokaoOrigin', re: /高考生源地|生源地|高考所在地|高考省份/ },
  { key: 'isFreshGraduate', re: /是否应届|应届毕业生|应届生/ },
  { key: 'phone', re: /手机|电话|联系方式|联系电话|mobile|phone|^tel$|telephone|cellphone|contactnumber/, neg: /紧急|亲属|监护|推荐人|公司|企业|座机|家庭电话|区号|国家码|验证码/ },
  { key: 'email', re: /邮箱|电子邮件|邮件地址|email|电子信箱/ },

  { key: 'expectCity', re: /期望城市|期望工作地|期望工作城市|期望地点|期望地区|意向城市|意向地区|意向工作地|工作地点|期望上班地点|desiredlocation|preferredcity|preferredlocation|worklocation|preferredwork/, neg: /现居|目前|籍贯|户籍|户口|出生|大学/ },
  { key: 'adjust', re: /服从调剂|接受调剂|岗位调剂|是否调剂|接受调岗/ },
  { key: 'applyPosition', re: /应聘职位|应聘岗位|申请职位|申请岗位|意向职位|意向岗位|期望职位|期望岗位|期望工作|目标职位|目标岗位|求职意向|岗位名称|positionapplied|desiredposition|desiredjob|appliedposition/, neg: /城市|地点|地区|地址/ },
  { key: 'expectSalary', re: /期望薪资|期望薪酬|期望月薪|期望年薪|薪资要求|薪酬期望|期望工资|expectedsalary|salaryexpectation|desiredsalary/ },
  { key: 'jobType', re: /工作性质|工作类型|求职类型|期望工作性质/ },
  { key: 'availableDate', re: /到岗|入职时间|最快入职|可入职|可到岗|availablefrom|availabledate|startdate|noticeperiod/ },
  { key: 'source', re: /获知渠道|了解渠道|了解.{0,6}渠道|招聘信息来源|信息来源|如何得知|从哪里知道|从哪里了解到|howdidyouhear|howdidyouknow|recruitmentsource|sourcechannel/ },
  { key: 'referralCode', re: /内推码|内推|推荐码/ },
  { key: 'github', re: /github|gitlab|gitee|码云|开源项目|开源仓库/ },
  { key: 'website', re: /个人网站|个人主页|个人博客|作品集|portfolio|personalsite|personalwebsite|homepage|^blog$|博客/, neg: /github|gitee/ },

  { key: 'zipcode', re: /邮编|邮政编码|postalcode|zipcode/ },
  { key: 'hukouType', re: /户口类型|户口性质|户籍性质|户口类别/ },
  { key: 'hukou', re: /户口所在地|户籍所在地|户口地址|户籍地址|户口所在|户籍所在/, neg: /性质|类型|农业|城镇/ },
  { key: 'hometown', re: /籍贯|出生地|家乡|老家|nativeplace|hometown/ },
  { key: 'address', re: /通讯地址|通信地址|联系地址|现住址|现居地址|居住地址|家庭住址|详细地址|街道地址|收件地址|address|street/, neg: /邮箱|邮件|email|网址|url|户口|户籍|籍贯|学校地址|公司地址/ },
  { key: 'currentCity', re: /现居城市|现居住地|现居地|目前所在城市|所在城市|所在地区|目前所在地|currentcity|currentlocation|cityofresidence|现居/, neg: /期望|意向|学校|院校|就读/ },

  { key: 'school', re: /毕业院校|毕业学校|就读院校|就读学校|学校名称|院校名称|学校全称|院校全称|^学校$|^院校$|university|schoolname|institution|almamater/, neg: /高中|中学|初中|小学|学校地址|学校所在地|学校性质|学校类型|学校邮箱|学校电话|学院|院系/ },
  { key: 'major', re: /所学专业|专业名称|^专业$|专业|major|fieldofstudy|discipline/, neg: /专业方向|专业类别|专业排名|转专业|专业技能|专业资格/ },
  { key: 'college', re: /学院|院系|系别|faculty|college|schoolof/, neg: /继续教育|成人教育/ },
  { key: 'schooling', re: /学制|修业年限/ },
  { key: 'educationType', re: /受教育类型|培养方式|学习形式|教育形式|培养类型/ },
  { key: 'degree', re: /学历|最高学历|educationlevel|educationbackground|academicdegree|degreelevel/, neg: /学位|学校|院校|学历认证/ },
  { key: 'degreeLevel', re: /学位|degreeawarded|所获学位/, neg: /学位类型/ },
  { key: 'gpa', re: /gpa|绩点|平均分|平均绩点|成绩点/ },
  { key: 'rank', re: /年级排名|班级排名|专业排名|排名比例|排名情况|^排名$|rank/, neg: /排名第一/ },
  { key: 'eduEnd', re: /毕业时间|毕业日期|^毕业$|毕业|结束时间|结束日期|离校时间|graduation|enddate|^to$/, ctx: 'edu' },
  { key: 'eduStart', re: /入学时间|入学日期|^入学$|入学|起始时间|开始时间|开始日期|就读时间|startdate|^from$|^fromdate$/, ctx: 'edu' },

  { key: 'company', re: /公司名称|公司全称|企业名称|单位名称|工作单位|^公司$|雇主|company|employer|organization|corporation/, neg: /学校|院校|公司地址|公司规模|公司性质|公司网站|子公司|母公司|公司电话|公司邮箱|公司简介/ },
  { key: 'department', re: /部门|department|division|businessunit/, neg: /学院|院系|系别|部门负责人/ },
  { key: 'title', re: /职位|职务|岗位|jobtitle|position|^title$/, neg: /意向|期望|应聘|申请|目标|职位类别|岗位类别|职位性质/ },
  { key: 'workDesc', re: /工作内容|工作描述|工作职责|职责描述|岗位职责|主要工作|工作业绩|实习内容|工作成果|工作说明|responsibilit|jobdescription|duties/ },
  { key: 'projectDesc', re: /项目描述|项目简介|项目内容|项目职责|项目经历描述|项目经验描述|projectdescription|projectexperience/ },
  { key: 'workEnd', re: /离职时间|离职日期|^离职$|离职|结束时间|结束日期|转正时间|enddate/, ctx: 'work' },
  { key: 'workStart', re: /入职时间|入职日期|^入职$|入职|起始时间|开始时间|开始日期|startdate/, ctx: 'work' },

  { key: 'englishLevel', re: /英语水平|英语等级|英语能力|英语成绩|外语水平|英语四六级|四级|六级|cet/, neg: /其他外语|第二外语/ },
  { key: 'otherLanguages', re: /其他外语|第二外语|其他语种/ },
  { key: 'itSkills', re: /it技能|计算机水平|计算机等级|技能掌握程度|办公软件/ },
  { key: 'hobbies', re: /爱好|兴趣特长|业余爱好/ },
  { key: 'selfEvaluation', re: /自我评价|自我介绍|个人评价|个人简介|评价内容|selfevaluation|selfintroduction|aboutme|summary/ },
  { key: 'skills', re: /专业技能|技能特长|掌握技能|skills/ },

  { key: 'name', re: /申请人姓名|候选人姓名|真实姓名|中文姓名|姓名全称|^姓名$|^名字$|姓名|fullname|candidatename|yourname|^name$|applicantname/, neg: /公司|企业|学校|院校|项目|用户名|昵称|英文|拼音|护照|推荐人|紧急|父母|银行|学院|专业|联系人|名称/ },
];

function ctxMatches(ruleCtx, ctx) {
  if (Array.isArray(ruleCtx)) return ruleCtx.indexOf(ctx) >= 0;
  return ruleCtx === ctx;
}

// 一个字段名可能同时匹配多条规则（「开始时间」在教育、工作、活动里都成立）。
// 这里把所有命中的 key 都返回，交给调用方判断归属是否唯一
export function matchKeys(t) {
  const label = norm(t.label || '');
  const attr = norm(t.attr || '');
  const passes = [label, attr, label + '|' + attr];
  const out = [];
  for (let i = 0; i < passes.length; i += 1) {
    const src = passes[i];
    if (!src) continue;
    for (let j = 0; j < RULES.length; j += 1) {
      const r = RULES[j];
      if (!r.re.test(src)) continue;
      if (r.neg && r.neg.test(src)) continue;
      if (out.indexOf(r.key) < 0) out.push(r.key);
    }
    if (out.length) break;
  }
  return out;
}

// 从三段文字里挑字段名：① 旁边写的标签 ② 输入框的 name/id/placeholder ③ 所在区块的文字
//   block     : 明确的区块类型，比从文字里猜更可靠
//   ignoreCtx : 忽略区块限制，用于判断一段区块里都有哪些字段
export function pickKey(t) {
  const label = norm(t.label || '');
  const attr = norm(t.attr || '');
  const ctx = t.block || sectionType(norm(t.hint || ''));
  const loose = !!t.ignoreCtx;
  const passes = [label, attr, label + '|' + attr];
  for (let i = 0; i < passes.length; i += 1) {
    const src = passes[i];
    if (!src) continue;
    for (let j = 0; j < RULES.length; j += 1) {
      const r = RULES[j];
      if (!loose && r.ctx && !ctxMatches(r.ctx, ctx)) continue;
      if (!r.re.test(src)) continue;
      if (r.neg && r.neg.test(src)) continue;
      return r.key;
    }
  }
  if (t.allowHint && t.hint) {
    const h = norm(t.hint);
    for (let j = 0; j < RULES.length; j += 1) {
      const r = RULES[j];
      if (!loose && r.ctx && !ctxMatches(r.ctx, ctx)) continue;
      if (!r.re.test(h)) continue;
      if (r.neg && r.neg.test(h)) continue;
      return r.key;
    }
  }
  return null;
}
