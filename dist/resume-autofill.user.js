// ==UserScript==
// @name         简历自动填充助手
// @name:en      Resume Autofill Helper
// @namespace    local.resume.autofill
// @version      1.12.0
// @description  一键把个人资料填入企业招聘官网 / 在线申请表；支持多套方案、随时修改
// @description:en  Fill job application forms with your saved profile in one click.
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @exclude      *://*.alipay.com/*
// @exclude      *://*.icbc.com.cn/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @homepageURL  https://github.com/Zinnober02/resume-autofill-userscript
// @supportURL   https://github.com/Zinnober02/resume-autofill-userscript/issues
// @downloadURL  https://raw.githubusercontent.com/Zinnober02/resume-autofill-userscript/main/dist/resume-autofill.user.js
// @updateURL    https://raw.githubusercontent.com/Zinnober02/resume-autofill-userscript/main/dist/resume-autofill.user.js
// @license      MIT
// ==/UserScript==

"use strict";
(() => {
  // src/core/env.js
  var IS_TOP = (function() {
    try {
      return window.top === window.self;
    } catch (e) {
      return false;
    }
  })();
  var UI_ID = "resume-autofill-root";

  // src/core/rules.js
  var EDU_RE = /教育|学校|院校|学院|大学|学历|学位|就读|毕业|专业|硕士|本科|博士|university|school|education|academic/;
  var WORK_RE = /工作|实习|公司|单位|职位|任职|部门|雇主|company|employer|work|experience|intern/;
  var CERT_RE = /证书|资格证|执业资格|认证/;
  var PATENT_RE = /专利|发明专利|实用新型|外观设计/;
  var PAPER_RE = /论文|期刊|学术成果|文献/;
  var AWARD_RE = /奖励|奖项|荣誉|获奖|奖学金|竞赛/;
  var FAMILY_RE = /家庭|亲属|家属/;
  var ACTIVITY_RE = /活动|社团|社会实践/;
  var PROJECT_RE = /项目|课题/;
  var SECTION_RES = [
    ["patent", PATENT_RE],
    ["paper", PAPER_RE],
    ["award", AWARD_RE],
    ["family", FAMILY_RE],
    ["cert", CERT_RE],
    ["activity", ACTIVITY_RE],
    ["project", PROJECT_RE],
    ["edu", EDU_RE],
    ["work", WORK_RE]
  ];
  function sectionType(text) {
    for (let i = 0; i < SECTION_RES.length; i += 1) {
      if (SECTION_RES[i][1].test(text)) return SECTION_RES[i][0];
    }
    return "";
  }
  var norm = (s) => String(s == null ? "" : s).replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  var RULES = [
    // 带区块限定的规则放在前面：这些字段名（职务、开始时间、姓名、关系）在别处有别的含义，
    // 先让专用规则有机会命中，通用的「职位」「姓名」规则排在后面
    { key: "activityEnd", re: /结束时间|结束日期|终止时间/, ctx: ["activity"] },
    { key: "activityStart", re: /开始时间|开始日期|起始时间/, ctx: ["activity"] },
    { key: "activityRole", re: /^职务$|担任职务|担任角色/, ctx: ["activity"] },
    { key: "activityName", re: /活动名称|社团名称|社会实践名称/, ctx: ["activity"] },
    { key: "activityDesc", re: /活动描述|活动内容|活动简介/, ctx: ["activity"] },
    { key: "projectEnd", re: /结束时间|结束日期|终止时间/, ctx: ["project"] },
    { key: "projectStart", re: /开始时间|开始日期|起始时间/, ctx: ["project"] },
    { key: "projectRole", re: /项目职务|项目角色|担任角色/, ctx: ["project"] },
    { key: "projectName", re: /项目名称|课题名称|项目标题/, ctx: ["project"] },
    { key: "idType", re: /证件类型|证件类别|身份类型|证件种类/ },
    { key: "idCard", re: /身份证|证件号码|证件号|身份号码|idcardno|idcardnumber|identityno|identitynumber|residentid/ },
    { key: "englishName", re: /英文名|英文姓名|拼音姓名|拼音名|englishname|nameinenglish|nameinpinyin|pinyin|forename/ },
    { key: "emergencyPhone", re: /(紧急|亲属|监护人).*(电话|手机|号码|联系方式)|(电话|手机|号码).*紧急|emergency(phone|tel|contact|number)/ },
    { key: "emergencyRelation", re: /与本人关系|亲属关系|紧急联系人关系|relationship/ },
    { key: "emergencyName", re: /紧急联系人|紧急情况联系人|监护人/ },
    { key: "familyInCompany", re: /是否在.{0,8}(工作|任职)|在本单位工作|是否在.{0,8}集团/, ctx: ["family"] },
    { key: "familyNote", re: /备注|说明/, ctx: ["family"] },
    { key: "familyRelation", re: /^关系$|与本人关系|亲属关系|家庭成员关系|家庭关系/, ctx: ["family"] },
    { key: "familyName", re: /家庭成员姓名|家属姓名|亲属姓名|成员姓名|监护人姓名|紧急联系人姓名/, ctx: ["family"] },
    { key: "certLevel", re: /证书等级|证书级别|资格等级/, ctx: ["cert"] },
    { key: "certDate", re: /证书.{0,4}(时间|日期)|获得时间|取得时间/, ctx: ["cert"] },
    { key: "certName", re: /证书名称|资格证书|专业资格证书|证书/, ctx: ["cert"] },
    { key: "patentType", re: /专利类型|专利种类/, ctx: ["patent"] },
    { key: "patentStage", re: /申请阶段|受理阶段|审查阶段|公布阶段|授权阶段|当前阶段|专利阶段|发表阶段/, ctx: ["patent"] },
    { key: "patentDate", re: /发表日期|申请日期|公开日期|授权日期/, ctx: ["patent"] },
    { key: "patentAuthorRank", re: /作者排序|作者排名|第几作者/, ctx: ["patent", "paper"] },
    { key: "patentName", re: /专利名称|专利号|专利标题|发明名称/, ctx: ["patent"] },
    { key: "journalLevel", re: /期刊.{0,4}(水平|级别|等级)|会议.{0,4}(水平|级别)|收录类型|检索类型/, ctx: ["paper"] },
    { key: "paperStatus", re: /发表状态|论文状态|已发表|已接收|投稿中/, ctx: ["paper"] },
    { key: "impactFactor", re: /影响因子/, ctx: ["paper"] },
    { key: "paperDate", re: /接收.{0,4}(日期|时间)|发表.{0,4}(日期|时间)/, ctx: ["paper"] },
    { key: "journalName", re: /期刊|会议名称|发表刊物|刊物名称/, ctx: ["paper"] },
    { key: "paperName", re: /论文名称|论文题目|论文标题/, ctx: ["paper"] },
    { key: "awardCategory", re: /奖项类别|奖励类别|奖项类型|奖励类型/, ctx: ["award"] },
    { key: "awardLevel", re: /奖励级别|奖项级别/, ctx: ["award"] },
    { key: "awardGrade", re: /奖励等级|奖项等级/, ctx: ["award"] },
    { key: "awardDate", re: /获奖时间|获奖日期|奖励时间|获奖年月/, ctx: ["award"] },
    { key: "awardIssuer", re: /颁发单位|颁奖单位|授予单位|颁发机构/, ctx: ["award"] },
    { key: "awardName", re: /奖励名称|奖项名称|获奖名称/, ctx: ["award"] },
    { key: "birthday", re: /出生日期|出生年月|出生时间|生日|birth|dob|dateofbirth/, neg: /出生地|籍贯|省市|地区|国家/ },
    { key: "age", re: /年龄|^age$/, neg: /年龄段|年龄要求/ },
    { key: "gender", re: /性别|^gender$|^sex$/, neg: /性别要求|性别限制|性别偏好/ },
    { key: "nation", re: /民族|ethnic/, neg: /国籍|国家/ },
    { key: "politicalStatus", re: /政治面貌|党派|partyaffiliation|politicalstatus/ },
    { key: "maritalStatus", re: /婚姻|婚否|marital|marriage/ },
    { key: "health", re: /健康状况|健康情况|身体状况|健康状态/ },
    { key: "gaokaoOrigin", re: /高考生源地|生源地|高考所在地|高考省份/ },
    { key: "isFreshGraduate", re: /是否应届|应届毕业生|应届生/ },
    { key: "phone", re: /手机|电话|联系方式|联系电话|mobile|phone|^tel$|telephone|cellphone|contactnumber/, neg: /紧急|亲属|监护|推荐人|公司|企业|座机|家庭电话|区号|国家码|验证码/ },
    { key: "email", re: /邮箱|电子邮件|邮件地址|email|电子信箱/ },
    { key: "expectCity", re: /期望城市|期望工作地|期望工作城市|期望地点|期望地区|意向城市|意向地区|意向工作地|工作地点|期望上班地点|desiredlocation|preferredcity|preferredlocation|worklocation|preferredwork/, neg: /现居|目前|籍贯|户籍|户口|出生|大学/ },
    { key: "adjust", re: /服从调剂|接受调剂|岗位调剂|是否调剂|接受调岗/ },
    { key: "applyPosition", re: /应聘职位|应聘岗位|申请职位|申请岗位|意向职位|意向岗位|期望职位|期望岗位|期望工作|目标职位|目标岗位|求职意向|岗位名称|positionapplied|desiredposition|desiredjob|appliedposition/, neg: /城市|地点|地区|地址/ },
    { key: "expectSalary", re: /期望薪资|期望薪酬|期望月薪|期望年薪|薪资要求|薪酬期望|期望工资|expectedsalary|salaryexpectation|desiredsalary/ },
    { key: "jobType", re: /工作性质|工作类型|求职类型|期望工作性质/ },
    { key: "availableDate", re: /到岗|入职时间|最快入职|可入职|可到岗|availablefrom|availabledate|startdate|noticeperiod/ },
    { key: "source", re: /获知渠道|了解渠道|了解.{0,6}渠道|招聘信息来源|信息来源|如何得知|从哪里知道|从哪里了解到|howdidyouhear|howdidyouknow|recruitmentsource|sourcechannel/ },
    { key: "referralCode", re: /内推码|内推|推荐码/ },
    { key: "github", re: /github|gitlab|gitee|码云|开源项目|开源仓库/ },
    { key: "website", re: /个人网站|个人主页|个人博客|作品集|portfolio|personalsite|personalwebsite|homepage|^blog$|博客/, neg: /github|gitee/ },
    { key: "zipcode", re: /邮编|邮政编码|postalcode|zipcode/ },
    { key: "hukouType", re: /户口类型|户口性质|户籍性质|户口类别/ },
    { key: "hukou", re: /户口所在地|户籍所在地|户口地址|户籍地址|户口所在|户籍所在/, neg: /性质|类型|农业|城镇/ },
    { key: "hometown", re: /籍贯|出生地|家乡|老家|nativeplace|hometown/ },
    { key: "address", re: /通讯地址|通信地址|联系地址|现住址|现居地址|居住地址|家庭住址|详细地址|街道地址|收件地址|address|street/, neg: /邮箱|邮件|email|网址|url|户口|户籍|籍贯|学校地址|公司地址/ },
    { key: "currentCity", re: /现居城市|现居住地|现居地|目前所在城市|所在城市|所在地区|目前所在地|currentcity|currentlocation|cityofresidence|现居/, neg: /期望|意向|学校|院校|就读/ },
    { key: "school", re: /毕业院校|毕业学校|就读院校|就读学校|学校名称|院校名称|学校全称|院校全称|^学校$|^院校$|university|schoolname|institution|almamater/, neg: /高中|中学|初中|小学|学校地址|学校所在地|学校性质|学校类型|学校邮箱|学校电话|学院|院系/ },
    { key: "majorCourses", re: /专业课程|主修课程|主要课程|课程名称|courses/, neg: /课程成绩|成绩/ },
    { key: "majorDesc", re: /专业描述|专业简介|专业介绍|专业说明/, neg: null },
    { key: "researchArea", re: /研究方向|研究领域|研究课题|researcharea|researchdirection/, neg: null },
    { key: "major", re: /所学专业|专业名称|^专业$|专业|major|fieldofstudy|discipline/, neg: /专业方向|专业类别|专业排名|转专业|专业技能|专业资格|专业课程|专业描述|专业简介|专业介绍|专业说明/ },
    { key: "college", re: /学院|院系|系别|faculty|college|schoolof/, neg: /继续教育|成人教育/ },
    { key: "schooling", re: /学制|修业年限/ },
    { key: "educationType", re: /受教育类型|培养方式|学习形式|教育形式|培养类型/ },
    { key: "degree", re: /学历|最高学历|educationlevel|educationbackground|academicdegree|degreelevel/, neg: /学位|学校|院校|学历认证/ },
    { key: "degreeLevel", re: /学位|degreeawarded|所获学位/, neg: /学位类型/ },
    { key: "gpa", re: /gpa|绩点|平均分|平均绩点|成绩点/ },
    { key: "rank", re: /年级排名|班级排名|专业排名|排名比例|排名情况|^排名$|rank/, neg: /排名第一/ },
    { key: "eduEnd", re: /毕业时间|毕业日期|^毕业$|毕业|结束时间|结束日期|离校时间|graduation|enddate|^to$/, ctx: "edu" },
    { key: "eduStart", re: /入学时间|入学日期|^入学$|入学|起始时间|开始时间|开始日期|就读时间|startdate|^from$|^fromdate$/, ctx: "edu" },
    { key: "company", re: /公司名称|公司全称|企业名称|单位名称|工作单位|^公司$|雇主|company|employer|organization|corporation/, neg: /学校|院校|公司地址|公司规模|公司性质|公司网站|子公司|母公司|公司电话|公司邮箱|公司简介/ },
    { key: "department", re: /部门|department|division|businessunit/, neg: /学院|院系|系别|部门负责人/ },
    { key: "title", re: /职位|职务|岗位|jobtitle|position|^title$/, neg: /意向|期望|应聘|申请|目标|职位类别|岗位类别|职位性质/ },
    { key: "workDesc", re: /工作内容|工作描述|工作职责|职责描述|岗位职责|主要工作|工作业绩|实习内容|工作成果|工作说明|responsibilit|jobdescription|duties/ },
    { key: "projectDesc", re: /项目描述|项目简介|项目内容|项目职责|项目经历描述|项目经验描述|projectdescription|projectexperience/ },
    { key: "workEnd", re: /离职时间|离职日期|^离职$|离职|结束时间|结束日期|转正时间|enddate/, ctx: "work" },
    { key: "workStart", re: /入职时间|入职日期|^入职$|入职|起始时间|开始时间|开始日期|startdate/, ctx: "work" },
    { key: "englishLevel", re: /英语水平|英语等级|英语能力|英语成绩|外语水平|英语四六级|四级|六级|cet/, neg: /其他外语|第二外语/ },
    { key: "otherLanguages", re: /其他外语|第二外语|其他语种/ },
    { key: "itSkills", re: /it技能|计算机水平|计算机等级|技能掌握程度|办公软件/ },
    { key: "hobbies", re: /爱好|兴趣特长|业余爱好/ },
    { key: "selfEvaluation", re: /自我评价|自我介绍|个人评价|个人简介|评价内容|selfevaluation|selfintroduction|aboutme|summary/ },
    { key: "skills", re: /专业技能|技能特长|掌握技能|skills/ },
    { key: "name", re: /申请人姓名|候选人姓名|真实姓名|中文姓名|姓名全称|^姓名$|^名字$|姓名|fullname|candidatename|yourname|^name$|applicantname/, neg: /公司|企业|学校|院校|项目|用户名|昵称|英文|拼音|护照|推荐人|紧急|父母|银行|学院|专业|联系人|名称/ }
  ];
  function ctxMatches(ruleCtx, ctx) {
    if (Array.isArray(ruleCtx)) return ruleCtx.indexOf(ctx) >= 0;
    return ruleCtx === ctx;
  }
  function matchKeys(t) {
    const label = norm(t.label || "");
    const attr = norm(t.attr || "");
    const passes = [label, attr, label + "|" + attr];
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
  function pickKey(t) {
    const label = norm(t.label || "");
    const attr = norm(t.attr || "");
    const ctx = t.block || sectionType(norm(t.hint || ""));
    const loose = !!t.ignoreCtx;
    const passes = [label, attr, label + "|" + attr];
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

  // src/core/value.js
  var EDU_KEYS = {
    school: 1,
    college: 1,
    major: 1,
    researchArea: 1,
    majorCourses: 1,
    majorDesc: 1,
    degree: 1,
    degreeLevel: 1,
    eduStart: 1,
    eduEnd: 1,
    gpa: 1,
    rank: 1
  };
  var WORK_KEYS = {
    company: 1,
    department: 1,
    title: 1,
    workCity: 1,
    workStart: 1,
    workEnd: 1,
    workDesc: 1
  };
  var CERT_KEYS = { certName: 1, certLevel: 1, certDate: 1 };
  var PATENT_KEYS = { patentName: 1, patentType: 1, patentDate: 1, patentStage: 1, patentAuthorRank: 1 };
  var PAPER_KEYS = {
    paperName: 1,
    journalName: 1,
    journalLevel: 1,
    paperStatus: 1,
    paperDate: 1,
    paperAuthorRank: 1,
    impactFactor: 1
  };
  var AWARD_KEYS = {
    awardName: 1,
    awardCategory: 1,
    awardLevel: 1,
    awardGrade: 1,
    awardDate: 1,
    awardIssuer: 1
  };
  var FAMILY_KEYS = { familyName: 1, familyRelation: 1, familyNote: 1, familyInCompany: 1 };
  var ACTIVITY_KEYS = {
    activityName: 1,
    activityRole: 1,
    activityStart: 1,
    activityEnd: 1,
    activityDesc: 1
  };
  var PROJECT_KEYS = {
    projectName: 1,
    projectRole: 1,
    projectStart: 1,
    projectEnd: 1,
    projectDesc: 1
  };
  var KEY_GROUPS = {
    edu: EDU_KEYS,
    work: WORK_KEYS,
    cert: CERT_KEYS,
    patent: PATENT_KEYS,
    paper: PAPER_KEYS,
    award: AWARD_KEYS,
    family: FAMILY_KEYS,
    activity: ACTIVITY_KEYS,
    project: PROJECT_KEYS
  };
  var GROUP_ARRAYS = {
    edu: "educations",
    work: "works",
    cert: "certificates",
    patent: "patents",
    paper: "papers",
    award: "awards",
    family: "family",
    activity: "activities",
    project: "projects"
  };
  function groupOf(key) {
    const groups = Object.keys(KEY_GROUPS);
    for (let i = 0; i < groups.length; i += 1) {
      if (KEY_GROUPS[groups[i]][key]) return groups[i];
    }
    return "";
  }
  var ADDRESS_KEYS = { hometown: 1, hukou: 1, currentCity: 1, gaokaoOrigin: 1 };
  var DATE_KEYS = {
    birthday: 1,
    eduStart: 1,
    eduEnd: 1,
    workStart: 1,
    workEnd: 1,
    availableDate: 1,
    certDate: 1,
    patentDate: 1,
    paperDate: 1,
    awardDate: 1,
    activityStart: 1,
    activityEnd: 1,
    projectStart: 1,
    projectEnd: 1
  };
  function splitDateTime(value) {
    const s = String(value == null ? "" : value).trim();
    const m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const hour = m[4] == null ? "" : ("0" + m[4]).slice(-2) + ":" + m[5];
    return {
      year: m[1],
      month: ("0" + m[2]).slice(-2),
      day: m[3] == null ? "01" : ("0" + m[3]).slice(-2),
      hasDay: m[3] != null,
      time: hour
    };
  }
  function valueForField(key, profile, index) {
    if (key === "age") {
      const by = parseInt(String(profile.birthday || "").slice(0, 4), 10);
      if (!by) return "";
      const bm = parseInt(String(profile.birthday || "").slice(5, 7), 10);
      const now = /* @__PURE__ */ new Date();
      let age = now.getFullYear() - by;
      if (bm && now.getMonth() + 1 < bm) age -= 1;
      return String(age);
    }
    const group = groupOf(key);
    if (group) {
      const item = (profile[GROUP_ARRAYS[group]] || [])[index - 1];
      return item && item[key] != null ? item[key] : "";
    }
    return profile[key] == null ? "" : profile[key];
  }
  function matchExtra(profile, label, attr, rowText) {
    const list = profile && profile.extra;
    if (!list || !list.length) return null;
    const hay = norm(label + " " + attr + " " + rowText);
    if (!hay) return null;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || !item.match || !item.value) continue;
      const m = norm(item.match);
      if (m && hay.indexOf(m) >= 0) return "extra:" + item.value;
    }
    return null;
  }
  function monthGranularity(el2, label) {
    const ph = String(el2.getAttribute("placeholder") || "");
    const flat = ph.toLowerCase();
    const dayInPlaceholder = /(^|[^a-z])d{1,2}([^a-z]|$)/.test(flat) || /[日号]/.test(ph);
    const monthInPlaceholder = /(^|[^a-z])m{1,2}([^a-z]|$)/.test(flat) || /月/.test(ph);
    if (dayInPlaceholder) return false;
    if (monthInPlaceholder) return true;
    if (Number(el2.getAttribute("maxlength")) === 7) return true;
    const name = String(label || "");
    if (/[日号]/.test(name)) return false;
    if (/月/.test(name)) return true;
    return false;
  }
  function formatValue(el2, value, label) {
    const date = splitDateTime(value);
    if (!date) return String(value);
    const type = (el2.type || "").toLowerCase();
    const full = date.year + "-" + date.month + "-" + date.day;
    if (type === "month") return date.year + "-" + date.month;
    if (type === "date") return full;
    if (type === "datetime-local") return full + "T" + (date.time || "00:00");
    if (type === "time") return date.time;
    const ph = el2.getAttribute("placeholder") || "";
    if (monthGranularity(el2, label)) {
      if (ph.indexOf("/") >= 0) return date.year + "/" + date.month;
      if (/年/.test(ph)) return date.year + "年" + date.month + "月";
      if (/[.．]/.test(ph)) return date.year + "." + date.month;
      if (ph !== "") return date.year + "-" + date.month;
      return date.year + "-" + date.month;
    }
    if (/年/.test(ph) && /[日号]/.test(ph)) return date.year + "年" + date.month + "月" + date.day + "日";
    if (ph.indexOf("/") >= 0) return full.replace(/-/g, "/");
    if (/年.*月/.test(ph)) return date.year + "年" + date.month + "月";
    return String(value);
  }
  var FIELD_NAMES = {
    name: "姓名",
    englishName: "英文名",
    gender: "性别",
    birthday: "出生日期",
    age: "年龄",
    nation: "民族",
    politicalStatus: "政治面貌",
    maritalStatus: "婚姻状况",
    idType: "证件类型",
    idCard: "身份证号",
    phoneCountry: "手机号国家 / 地区",
    phone: "手机号",
    email: "邮箱",
    wechat: "微信",
    hometown: "籍贯",
    hukou: "户口所在地",
    hukouType: "户口类型",
    currentCity: "现居城市",
    address: "地址",
    zipcode: "邮编",
    health: "健康状况",
    gaokaoOrigin: "高考生源地",
    isFreshGraduate: "是否应届毕业生",
    applyPosition: "意向岗位",
    expectCity: "意向城市",
    expectSalary: "期望薪资",
    availableDate: "到岗时间",
    jobType: "期望工作性质",
    source: "获知渠道",
    website: "个人网站",
    github: "GitHub",
    referralCode: "内推码",
    adjust: "是否服从调剂",
    englishLevel: "英语水平",
    otherLanguages: "其他外语水平",
    itSkills: "IT 技能掌握程度",
    hobbies: "个人爱好",
    school: "学校",
    college: "学院",
    major: "专业",
    degree: "学历",
    degreeLevel: "学位",
    researchArea: "研究方向",
    majorCourses: "主修课程",
    majorDesc: "专业描述",
    schooling: "学制",
    educationType: "培养方式",
    eduStart: "入学时间",
    eduEnd: "毕业时间",
    gpa: "GPA",
    rank: "排名",
    company: "公司",
    department: "部门",
    title: "职位",
    workStart: "开始时间",
    workEnd: "结束时间",
    workCity: "工作城市",
    workDesc: "工作描述",
    certName: "证书名称",
    certLevel: "证书等级",
    certDate: "证书获得时间",
    patentName: "专利名称",
    patentType: "专利类型",
    patentDate: "专利发表日期",
    patentStage: "专利阶段",
    patentAuthorRank: "专利作者排序",
    paperName: "论文名称",
    journalName: "期刊或会议名称",
    journalLevel: "期刊或会议水平",
    paperStatus: "论文发表状态",
    paperDate: "论文接收或发表日期",
    paperAuthorRank: "论文作者排序",
    impactFactor: "影响因子",
    awardName: "奖励名称",
    awardCategory: "奖项类别",
    awardLevel: "奖励级别",
    awardGrade: "奖励等级",
    awardDate: "获奖时间",
    awardIssuer: "颁发单位",
    familyName: "家庭成员姓名",
    familyRelation: "家庭关系",
    familyNote: "家庭关系备注",
    familyInCompany: "是否在本单位工作",
    activityName: "活动名称",
    activityRole: "担任职务",
    activityStart: "活动开始时间",
    activityEnd: "活动结束时间",
    activityDesc: "活动描述",
    projectName: "项目名称",
    projectRole: "项目职务",
    projectStart: "项目开始时间",
    projectEnd: "项目结束时间",
    projectDesc: "项目描述",
    selfEvaluation: "自我评价",
    skills: "专业技能",
    emergencyName: "紧急联系人",
    emergencyRelation: "与本人关系",
    emergencyPhone: "紧急联系人电话"
  };

  // src/core/dom.js
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function deepQueryAll(selector, root, out) {
    const res = out || [];
    const node = root || document;
    let list;
    try {
      list = node.querySelectorAll(selector);
    } catch (e) {
      list = [];
    }
    for (let i = 0; i < list.length; i += 1) res.push(list[i]);
    let all;
    try {
      all = node.querySelectorAll("*");
    } catch (e) {
      all = [];
    }
    for (let i = 0; i < all.length; i += 1) {
      const sr = all[i].shadowRoot;
      if (sr) deepQueryAll(selector, sr, res);
    }
    return res;
  }
  function ownRoot(el2) {
    try {
      return el2.getRootNode();
    } catch (e) {
      return document;
    }
  }
  function isOurUI(el2) {
    const r = ownRoot(el2);
    return !!(r && r.host && r.host.id === UI_ID);
  }
  function visibleText(node, limit) {
    let s = "";
    const cap = limit || 200;
    const walk = (n) => {
      if (s.length >= cap || !n) return;
      if (n.nodeType === 3) {
        s += n.nodeValue;
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SELECT" || tag === "OPTION" || tag === "SVG" || tag === "TEXTAREA") return;
      const st = n.getAttribute && n.getAttribute("style");
      if (st && /display\s*:\s*none/i.test(st)) return;
      for (let i = 0; i < n.childNodes.length; i += 1) {
        if (s.length >= cap) break;
        walk(n.childNodes[i]);
      }
    };
    walk(node);
    return s;
  }
  function cssEscape(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    return String(v).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function labelText(el2) {
    if (!el2.getAttribute) return "";
    const parts = [];
    const push = (v) => {
      const t = String(v == null ? "" : v).trim();
      if (t && parts.indexOf(t) < 0 && parts.length < 4) parts.push(t);
    };
    push(attrLabel(el2));
    const lb = el2.getAttribute("aria-labelledby");
    if (lb) {
      lb.split(/\s+/).forEach((id) => {
        const t = document.getElementById(id);
        if (t) push(visibleText(t, 80));
      });
    }
    if (el2.id) {
      try {
        const lab = document.querySelector('label[for="' + cssEscape(el2.id) + '"]');
        if (lab) push(visibleText(lab, 80));
      } catch (e) {
      }
    }
    const wrap = el2.closest && el2.closest("label");
    if (wrap) push(visibleText(wrap, 80));
    if (!parts.length) {
      const likeLabel = (n) => {
        if (!n || !n.tagName) return "";
        const tag = n.tagName;
        const okTag = tag === "LABEL" || tag === "TD" || tag === "TH" || tag === "DT" || tag === "DD" || tag === "LI" || tag === "FIGCAPTION" || tag === "LEGEND" || tag === "SPAN" || tag === "DIV" || tag === "P" || tag === "B" || tag === "STRONG" || tag === "EM";
        if (!okTag) return "";
        if (n.querySelector && n.querySelector("input, select, textarea")) return "";
        return visibleText(n, 30).trim().slice(0, 30);
      };
      let node = el2.previousElementSibling;
      for (let i = 0; node && i < 4 && !parts.length; i += 1) {
        push(meaningfulLabel(likeLabel(node)));
        node = node.previousElementSibling;
      }
      let up = el2.parentElement ? el2.parentElement.previousElementSibling : null;
      for (let i = 0; up && i < 4 && !parts.length; i += 1) {
        push(meaningfulLabel(likeLabel(up)));
        up = up.previousElementSibling;
      }
      if (!parts.length) {
        const cell = el2.closest && el2.closest("td, th");
        const table = cell && cell.closest("table");
        if (cell && table) {
          const row = cell.parentElement;
          let headRow = table.querySelector("thead tr");
          if (!headRow) {
            const firstRow = table.querySelector("tr");
            if (firstRow && firstRow !== row) {
              const cells = Array.prototype.slice.call(firstRow.children);
              if (cells.length && cells.every((c) => c.tagName === "TH")) headRow = firstRow;
            }
          }
          if (row && headRow && headRow !== row) {
            const index = Array.prototype.indexOf.call(row.children, cell);
            const headCell = headRow.children[index];
            if (headCell) push(meaningfulLabel(visibleText(headCell, 30)));
          }
        }
      }
      if (!parts.length && el2.parentElement) {
        let text = "";
        const kids = el2.parentElement.childNodes;
        for (let i = 0; i < kids.length; i += 1) {
          const node2 = kids[i];
          if (node2 === el2) break;
          if (node2.nodeType === 3) {
            text += " " + node2.nodeValue;
            continue;
          }
          if (node2.nodeType !== 1) continue;
          const isField = node2.tagName === "INPUT" || node2.tagName === "SELECT" || node2.tagName === "TEXTAREA";
          if (isField || node2.querySelector && node2.querySelector("input, select, textarea")) break;
          text += " " + visibleText(node2, 30);
        }
        push(meaningfulLabel(text.trim()));
      }
    }
    push(meaningfulLabel(el2.getAttribute("title")));
    push(meaningfulLabel(el2.getAttribute("placeholder")));
    return parts.join(" ").trim();
  }
  function attrText(el2) {
    const keys = ["name", "id", "placeholder", "data-name", "data-field", "data-label", "autocomplete"];
    const parts = [];
    keys.forEach((k) => {
      const v = el2.getAttribute && el2.getAttribute(k);
      if (v && v.length < 120) parts.push(v);
    });
    return parts.join(" ");
  }
  var LABEL_ATTRS = ["aria-label", "msg", "data-label", "data-name", "data-title", "label"];
  var ANCESTOR_LABEL_ATTRS = ["msg", "data-label", "data-name"];
  function meaningfulLabel(text) {
    const t = String(text == null ? "" : text).trim();
    if (!t) return "";
    const flat = norm(t);
    if (!flat || flat.length > 24) return "";
    if (/^(请选择|请输入|请填写|请选择或输入|请选择或填写|选择|输入|select|choose|enter|input)+$/.test(flat)) return "";
    return t;
  }
  function jsonLabel(node) {
    const raw = node.getAttribute && node.getAttribute("data");
    if (!raw || raw.charAt(0) !== "{") return "";
    try {
      const obj = JSON.parse(raw);
      return obj && obj.name ? String(obj.name) : "";
    } catch (e) {
      return "";
    }
  }
  function attrLabel(el2) {
    for (let i = 0; i < LABEL_ATTRS.length; i += 1) {
      const v = meaningfulLabel(el2.getAttribute(LABEL_ATTRS[i]));
      if (v) return v;
    }
    const own = meaningfulLabel(jsonLabel(el2));
    if (own) return own;
    let node = el2.parentElement;
    for (let depth = 0; depth < 3 && node; depth += 1) {
      for (let i = 0; i < ANCESTOR_LABEL_ATTRS.length; i += 1) {
        const v = meaningfulLabel(node.getAttribute && node.getAttribute(ANCESTOR_LABEL_ATTRS[i]));
        if (v) return v;
      }
      const json = meaningfulLabel(jsonLabel(node));
      if (json) return json;
      node = node.parentElement;
    }
    return "";
  }
  function rowContainer(el2) {
    let cur = el2;
    let best = el2.parentElement || el2;
    for (let i = 0; i < 6 && cur; i += 1) {
      cur = cur.parentElement;
      if (!cur) break;
      if (cur.tagName === "BODY" || cur.tagName === "FORM") break;
      if ((cur.textContent || "").length > 160) break;
      best = cur;
    }
    return best;
  }
  var FIELD_SELECTOR = "input, textarea, select";
  function sectionContainer(el2) {
    let cur = el2;
    for (let i = 0; i < 10 && cur; i += 1) {
      cur = cur.parentElement;
      if (!cur || cur.tagName === "BODY" || cur.tagName === "HTML") break;
      if (cur.querySelectorAll(FIELD_SELECTOR).length >= 2) return cur;
    }
    return null;
  }
  var blockTypeCache = /* @__PURE__ */ new WeakMap();
  function countVotes(scope) {
    const votes = {};
    const list = scope.querySelectorAll(FIELD_SELECTOR);
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      const keys = matchKeys({ label: labelText(node), attr: attrText(node) });
      const groups = [];
      for (let j = 0; j < keys.length; j += 1) {
        const group = groupOf(keys[j]);
        if (group && groups.indexOf(group) < 0) groups.push(group);
      }
      if (groups.length === 1) votes[groups[0]] = (votes[groups[0]] || 0) + 1;
    }
    return votes;
  }
  function bestVote(votes, min) {
    let best = "";
    let bestCount = 0;
    Object.keys(votes).forEach((group) => {
      if (votes[group] > bestCount) {
        bestCount = votes[group];
        best = group;
      }
    });
    return bestCount >= min ? best : "";
  }
  function sectionBlockType(el2) {
    const scope = sectionContainer(el2);
    if (!scope) return "";
    if (blockTypeCache.has(scope)) return blockTypeCache.get(scope);
    const byVote = bestVote(countVotes(scope), 2);
    const result = byVote || sectionType(norm(visibleText(scope, 600)));
    blockTypeCache.set(scope, result);
    return result;
  }
  function textSection(el2) {
    let cur = el2;
    for (let i = 0; i < 8 && cur; i += 1) {
      cur = cur.parentElement;
      if (!cur || cur.tagName === "BODY") break;
      const t = cur.textContent || "";
      if (t.length <= 800 && sectionType(t)) return cur;
    }
    return null;
  }
  function fieldHint(el2) {
    const sec = sectionContainer(el2) || textSection(el2);
    if (!sec) return "";
    return visibleText(sec, 400) + " " + visibleText(rowContainer(el2), 160);
  }
  function visible(el2) {
    if (!el2.isConnected) return false;
    const r = el2.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el2);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    let node = el2.parentElement;
    while (node && node.nodeType === 1) {
      if (node.style && node.style.display === "none") return false;
      node = node.parentElement;
    }
    return true;
  }

  // src/core/profile-schema.js
  var SEED_PROFILES = {
    "默认": {
      name: "",
      englishName: "",
      gender: "",
      birthday: "",
      nation: "",
      politicalStatus: "",
      maritalStatus: "",
      idType: "",
      idCard: "",
      phoneCountry: "中国大陆",
      phone: "",
      email: "",
      wechat: "",
      hometown: "",
      hukou: "",
      hukouType: "",
      currentCity: "",
      address: "",
      zipcode: "",
      health: "",
      gaokaoOrigin: "",
      isFreshGraduate: "",
      applyPosition: "",
      expectCity: "",
      expectSalary: "",
      availableDate: "",
      jobType: "",
      source: "",
      website: "",
      github: "",
      referralCode: "",
      adjust: "",
      englishLevel: "",
      otherLanguages: "",
      itSkills: "",
      hobbies: "",
      selfEvaluation: "",
      skills: "",
      emergencyName: "",
      emergencyRelation: "",
      emergencyPhone: "",
      educations: [],
      works: [],
      certificates: [],
      patents: [],
      papers: [],
      awards: [],
      family: [],
      activities: [],
      projects: [],
      extra: []
    }
  };
  var EDU_ITEM_FORM = [
    ["school", "学校", "text"],
    ["college", "学院", "text"],
    ["major", "专业", "text"],
    ["researchArea", "研究方向", "text"],
    ["majorCourses", "主修课程", "text"],
    ["majorDesc", "专业描述", "textarea"],
    ["degree", "学历", "select", ["", "硕士", "博士", "本科", "大专"]],
    ["degreeLevel", "学位", "select", ["", "学士", "硕士", "博士"]],
    ["eduStart", "入学时间", "date"],
    ["eduEnd", "毕业时间", "date"],
    ["gpa", "GPA/绩点", "text"],
    ["rank", "排名", "text"]
  ];
  var WORK_ITEM_FORM = [
    ["company", "公司", "text"],
    ["department", "部门", "text"],
    ["title", "职位", "text"],
    ["workCity", "工作城市", "text"],
    ["workStart", "开始时间", "date"],
    ["workEnd", "结束时间", "date"],
    ["workDesc", "工作内容描述", "textarea"]
  ];
  var CERT_ITEM_FORM = [
    ["certName", "证书名称", "text"],
    ["certLevel", "等级", "text"],
    ["certDate", "获得时间", "date"]
  ];
  var PATENT_ITEM_FORM = [
    ["patentName", "专利名称", "text"],
    ["patentType", "专利类型", "select", ["", "发明专利", "实用新型专利", "外观设计专利"]],
    ["patentDate", "发表日期", "date"],
    ["patentStage", "当前阶段", "select", ["", "申请阶段", "受理阶段", "初步审查阶段", "公布阶段", "实质审查阶段", "授权阶段"]],
    ["patentAuthorRank", "作者排序", "select", ["", "第一作者", "前三作者", "其他作者"]]
  ];
  var PAPER_ITEM_FORM = [
    ["paperName", "论文名称", "text"],
    ["journalName", "期刊或会议名称", "text"],
    ["journalLevel", "期刊或会议水平", "select", ["", "SCI", "SCI-E", "EI", "IEEE", "ISTP", "中文核心期刊", "其他"]],
    ["paperStatus", "发表状态", "select", ["", "已发表", "已接收", "投稿中", "其它"]],
    ["paperDate", "接收或发表日期", "date"],
    ["paperAuthorRank", "作者排序", "select", ["", "第一作者", "前三作者", "其他作者"]],
    ["impactFactor", "影响因子", "text"]
  ];
  var AWARD_ITEM_FORM = [
    ["awardName", "奖励名称", "text"],
    ["awardCategory", "奖项类别", "select", ["", "奖学金", "竞赛类", "其它类"]],
    ["awardLevel", "奖励级别", "select", ["", "国际级", "国家级", "省部级", "地市级", "院校级", "其他"]],
    ["awardGrade", "奖励等级", "select", ["", "一等", "二等", "三等", "其它"]],
    ["awardDate", "获奖时间", "date"],
    ["awardIssuer", "颁发单位", "text"]
  ];
  var ACTIVITY_ITEM_FORM = [
    ["activityName", "活动名称", "text"],
    ["activityRole", "担任职务", "text"],
    ["activityStart", "开始时间", "date"],
    ["activityEnd", "结束时间", "date"],
    ["activityDesc", "活动描述", "textarea"]
  ];
  var PROJECT_ITEM_FORM = [
    ["projectName", "项目名称", "text"],
    ["projectRole", "项目职务", "text"],
    ["projectStart", "开始时间", "date"],
    ["projectEnd", "结束时间", "date"],
    ["projectDesc", "项目描述", "textarea"]
  ];
  var FAMILY_ITEM_FORM = [
    ["familyName", "姓名", "text"],
    ["familyRelation", "关系", "select", ["", "父子", "父女", "母子", "母女", "兄弟", "兄妹", "姐妹", "姐弟", "夫妻", "其它"]],
    ["familyNote", "备注", "text"],
    ["familyInCompany", "是否在本单位工作", "select", ["", "是", "否"]]
  ];

  // src/core/storage.js
  var STORE_KEY = "ra_data_v1";
  function seedData() {
    const profiles = {};
    const names = Object.keys(SEED_PROFILES);
    names.forEach((n) => {
      profiles[n] = JSON.parse(JSON.stringify(SEED_PROFILES[n]));
    });
    return { v: 1, current: names[0], profiles };
  }
  function assertData(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("不是 json 对象");
    if (!d.profiles || typeof d.profiles !== "object" || !Object.keys(d.profiles).length) throw new Error("没有 profiles");
    Object.keys(d.profiles).forEach((name) => {
      const p = d.profiles[name];
      if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("方案「" + name + "」不是对象");
      if (!Array.isArray(p.educations)) throw new Error("方案「" + name + "」缺 educations 数组");
      if (!Array.isArray(p.works)) throw new Error("方案「" + name + "」缺 works 数组");
      if (!Array.isArray(p.extra)) throw new Error("方案「" + name + "」缺 extra 数组");
    });
    if (!d.current || !d.profiles[d.current]) d.current = Object.keys(d.profiles)[0];
    return d;
  }
  function loadData() {
    let d = null;
    try {
      d = GM_getValue(STORE_KEY, null);
    } catch (e) {
      d = null;
    }
    if (typeof d === "string") d = JSON.parse(d);
    if (!d) return seedData();
    return assertData(d);
  }
  function saveData(d) {
    try {
      GM_setValue(STORE_KEY, d);
    } catch (e) {
    }
  }

  // src/core/form-control.js
  var FIELD_EVENTS = ["input", "keyup", "change", "blur"];
  function fireEvents(el2) {
    FIELD_EVENTS.forEach((type) => {
      try {
        el2.dispatchEvent(new Event(type, { bubbles: true }));
      } catch (e) {
      }
    });
  }
  function setVal(el2, value) {
    let proto = HTMLInputElement.prototype;
    if (el2 instanceof HTMLTextAreaElement) proto = HTMLTextAreaElement.prototype;
    else if (el2 instanceof HTMLSelectElement) proto = HTMLSelectElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el2, value);
    else el2.value = value;
    fireEvents(el2);
  }
  function bestOptionIndex(select, want, preferEnrolled) {
    const w = norm(want);
    if (!w) return -1;
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < select.options.length; i += 1) {
      const o = select.options[i];
      const t = norm(o.text || o.value || "");
      if (!t) continue;
      let s = 0;
      if (t === w) s = 100;
      else if (t.indexOf(w) === 0 || w.indexOf(t) === 0) s = 80;
      else if (t.indexOf(w) >= 0) s = 60;
      else if (w.indexOf(t) >= 0) s = 40;
      if (!s) continue;
      if (preferEnrolled && /在读|应届/.test(t)) s += 15;
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  }
  function isCustomSelect(el2) {
    const cls = String(el2.className || "") + " " + String(el2.parentElement && el2.parentElement.className || "");
    return /ant-select|el-select|ivu-select|van-select|n-select|arco-select|select2|v-select|chosen/i.test(cls);
  }
  async function fillCustomSelect(el2, value) {
    try {
      el2.click();
      await sleep(260);
      const opts = deepQueryAll('[role="option"], .ant-select-item-option, .el-select-dropdown__item, .ivu-select-item, .select2-results__option, .arco-select-option');
      const w = norm(value);
      let target = null;
      let bestScore = 0;
      for (let i = 0; i < opts.length; i += 1) {
        const o = opts[i];
        if (!visible(o)) continue;
        const t = norm(o.textContent);
        if (!t) continue;
        let s = 0;
        if (t === w) s = 100;
        else if (t.indexOf(w) >= 0) s = 60;
        else if (w.indexOf(t) >= 0) s = 40;
        if (s > bestScore) {
          bestScore = s;
          target = o;
        }
      }
      if (target) {
        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        target.click();
        await sleep(120);
        return true;
      }
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      return false;
    } catch (e) {
      return false;
    }
  }

  // src/core/regions.js
  var REGIONS = {
    "86": { "110000": "北京市", "120000": "天津市", "130000": "河北省", "140000": "山西省", "150000": "内蒙古自治区", "210000": "辽宁省", "220000": "吉林省", "230000": "黑龙江省", "310000": "上海市", "320000": "江苏省", "330000": "浙江省", "340000": "安徽省", "350000": "福建省", "360000": "江西省", "370000": "山东省", "410000": "河南省", "420000": "湖北省", "430000": "湖南省", "440000": "广东省", "450000": "广西壮族自治区", "460000": "海南省", "500000": "重庆市", "510000": "四川省", "520000": "贵州省", "530000": "云南省", "540000": "西藏自治区", "610000": "陕西省", "620000": "甘肃省", "630000": "青海省", "640000": "宁夏回族自治区", "650000": "新疆维吾尔自治区", "710000": "台湾省", "910000": "港澳" },
    "110000": { "110100": "市辖区" },
    "110100": { "110101": "东城区", "110102": "西城区", "110105": "朝阳区", "110106": "丰台区", "110107": "石景山区", "110108": "海淀区", "110109": "门头沟区", "110111": "房山区", "110112": "通州区", "110113": "顺义区", "110114": "昌平区", "110115": "大兴区", "110116": "怀柔区", "110117": "平谷区", "110118": "密云区", "110119": "延庆区" },
    "120000": { "120100": "市辖区" },
    "120100": { "120101": "和平区", "120102": "河东区", "120103": "河西区", "120104": "南开区", "120105": "河北区", "120106": "红桥区", "120110": "东丽区", "120111": "西青区", "120112": "津南区", "120113": "北辰区", "120114": "武清区", "120115": "宝坻区", "120116": "滨海新区", "120117": "宁河区", "120118": "静海区", "120119": "蓟州区" },
    "130000": { "130100": "石家庄市", "130200": "唐山市", "130300": "秦皇岛市", "130400": "邯郸市", "130500": "邢台市", "130600": "保定市", "130700": "张家口市", "130800": "承德市", "130900": "沧州市", "131000": "廊坊市", "131100": "衡水市", "139001": "定州市", "139002": "辛集市" },
    "130100": { "130102": "长安区", "130104": "桥西区", "130105": "新华区", "130107": "井陉矿区", "130108": "裕华区", "130109": "藁城区", "130110": "鹿泉区", "130111": "栾城区", "130121": "井陉县", "130123": "正定县", "130125": "行唐县", "130126": "灵寿县", "130127": "高邑县", "130128": "深泽县", "130129": "赞皇县", "130130": "无极县", "130131": "平山县", "130132": "元氏县", "130133": "赵县", "130183": "晋州市", "130184": "新乐市" },
    "130200": { "130202": "路南区", "130203": "路北区", "130204": "古冶区", "130205": "开平区", "130207": "丰南区", "130208": "丰润区", "130209": "曹妃甸区", "130223": "滦县", "130224": "滦南县", "130225": "乐亭县", "130227": "迁西县", "130229": "玉田县", "130281": "遵化市", "130283": "迁安市" },
    "130300": { "130302": "海港区", "130303": "山海关区", "130304": "北戴河区", "130306": "抚宁区", "130321": "青龙满族自治县", "130322": "昌黎县", "130324": "卢龙县" },
    "130400": { "130402": "邯山区", "130403": "丛台区", "130404": "复兴区", "130406": "峰峰矿区", "130421": "邯郸县", "130423": "临漳县", "130424": "成安县", "130425": "大名县", "130426": "涉县", "130427": "磁县", "130428": "肥乡县", "130429": "永年县", "130430": "邱县", "130431": "鸡泽县", "130432": "广平县", "130433": "馆陶县", "130434": "魏县", "130435": "曲周县", "130481": "武安市" },
    "130500": { "130502": "桥东区", "130503": "桥西区", "130521": "邢台县", "130522": "临城县", "130523": "内丘县", "130524": "柏乡县", "130525": "隆尧县", "130526": "任县", "130527": "南和县", "130528": "宁晋县", "130529": "巨鹿县", "130530": "新河县", "130531": "广宗县", "130532": "平乡县", "130533": "威县", "130534": "清河县", "130535": "临西县", "130581": "南宫市", "130582": "沙河市" },
    "130600": { "130602": "竞秀区", "130606": "莲池区", "130607": "满城区", "130608": "清苑区", "130609": "徐水区", "130623": "涞水县", "130624": "阜平县", "130626": "定兴县", "130627": "唐县", "130628": "高阳县", "130629": "容城县", "130630": "涞源县", "130631": "望都县", "130632": "安新县", "130633": "易县", "130634": "曲阳县", "130635": "蠡县", "130636": "顺平县", "130637": "博野县", "130638": "雄县", "130681": "涿州市", "130683": "安国市", "130684": "高碑店市" },
    "130700": { "130702": "桥东区", "130703": "桥西区", "130705": "宣化区", "130706": "下花园区", "130708": "万全区", "130709": "崇礼区", "130722": "张北县", "130723": "康保县", "130724": "沽源县", "130725": "尚义县", "130726": "蔚县", "130727": "阳原县", "130728": "怀安县", "130730": "怀来县", "130731": "涿鹿县", "130732": "赤城县" },
    "130800": { "130802": "双桥区", "130803": "双滦区", "130804": "鹰手营子矿区", "130821": "承德县", "130822": "兴隆县", "130823": "平泉县", "130824": "滦平县", "130825": "隆化县", "130826": "丰宁满族自治县", "130827": "宽城满族自治县", "130828": "围场满族蒙古族自治县" },
    "130900": { "130902": "新华区", "130903": "运河区", "130921": "沧县", "130922": "青县", "130923": "东光县", "130924": "海兴县", "130925": "盐山县", "130926": "肃宁县", "130927": "南皮县", "130928": "吴桥县", "130929": "献县", "130930": "孟村回族自治县", "130981": "泊头市", "130982": "任丘市", "130983": "黄骅市", "130984": "河间市" },
    "131000": { "131002": "安次区", "131003": "广阳区", "131022": "固安县", "131023": "永清县", "131024": "香河县", "131025": "大城县", "131026": "文安县", "131028": "大厂回族自治县", "131081": "霸州市", "131082": "三河市" },
    "131100": { "131102": "桃城区", "131103": "冀州区", "131121": "枣强县", "131122": "武邑县", "131123": "武强县", "131124": "饶阳县", "131125": "安平县", "131126": "故城县", "131127": "景县", "131128": "阜城县", "131182": "深州市" },
    "139001": { "1390011": "留早镇", "13900111": "邢邑镇", "139001001": "南城区街道", "139001002": "北城区街道", "139001003": "西城区街道", "139001004": "长安路街道", "139001101": "清风店镇", "139001102": "庞村镇", "139001103": "砖路镇", "139001104": "明月店镇", "139001105": "叮咛店镇", "139001106": "东亭镇", "139001107": "大辛庄镇", "139001108": "东旺镇", "139001109": "高蓬镇", "139001111": "李亲顾镇", "139001112": "子位镇", "139001113": "开元镇", "139001115": "周村镇", "139001116": "息冢镇", "139001203": "东留春乡", "139001204": "号头庄回族乡", "139001205": "杨家庄乡", "139001206": "大鹿庄乡", "139001208": "西城乡" },
    "139002": { "1390021": "辛集镇", "1390022": "天宫营乡", "1390025": "辛集经济开发区", "139002101": "旧城镇", "139002102": "张古庄镇", "139002103": "位伯镇", "139002104": "新垒头镇", "139002105": "新城镇", "139002106": "南智邱镇", "139002107": "王口镇", "139002201": "前营乡", "139002202": "马庄乡", "139002203": "和睦井乡", "139002204": "田家庄乡", "139002205": "中里厢乡", "139002206": "小辛庄乡" },
    "140000": { "140100": "太原市", "140200": "大同市", "140300": "阳泉市", "140400": "长治市", "140500": "晋城市", "140600": "朔州市", "140700": "晋中市", "140800": "运城市", "140900": "忻州市", "141000": "临汾市", "141100": "吕梁市" },
    "140100": { "140105": "小店区", "140106": "迎泽区", "140107": "杏花岭区", "140108": "尖草坪区", "140109": "万柏林区", "140110": "晋源区", "140121": "清徐县", "140122": "阳曲县", "140123": "娄烦县", "140181": "古交市" },
    "140200": { "140202": "城区", "140203": "矿区", "140211": "南郊区", "140212": "新荣区", "140221": "阳高县", "140222": "天镇县", "140223": "广灵县", "140224": "灵丘县", "140225": "浑源县", "140226": "左云县", "140227": "大同县" },
    "140300": { "140302": "城区", "140303": "矿区", "140311": "郊区", "140321": "平定县", "140322": "盂县" },
    "140400": { "140402": "城区", "140411": "郊区", "140421": "长治县", "140423": "襄垣县", "140424": "屯留县", "140425": "平顺县", "140426": "黎城县", "140427": "壶关县", "140428": "长子县", "140429": "武乡县", "140430": "沁县", "140431": "沁源县", "140481": "潞城市" },
    "140500": { "140502": "城区", "140521": "沁水县", "140522": "阳城县", "140524": "陵川县", "140525": "泽州县", "140581": "高平市" },
    "140600": { "140602": "朔城区", "140603": "平鲁区", "140621": "山阴县", "140622": "应县", "140623": "右玉县", "140624": "怀仁县" },
    "140700": { "140702": "榆次区", "140721": "榆社县", "140722": "左权县", "140723": "和顺县", "140724": "昔阳县", "140725": "寿阳县", "140726": "太谷县", "140727": "祁县", "140728": "平遥县", "140729": "灵石县", "140781": "介休市" },
    "140800": { "140802": "盐湖区", "140821": "临猗县", "140822": "万荣县", "140823": "闻喜县", "140824": "稷山县", "140825": "新绛县", "140826": "绛县", "140827": "垣曲县", "140828": "夏县", "140829": "平陆县", "140830": "芮城县", "140881": "永济市", "140882": "河津市" },
    "140900": { "140902": "忻府区", "140921": "定襄县", "140922": "五台县", "140923": "代县", "140924": "繁峙县", "140925": "宁武县", "140926": "静乐县", "140927": "神池县", "140928": "五寨县", "140929": "岢岚县", "140930": "河曲县", "140931": "保德县", "140932": "偏关县", "140981": "原平市" },
    "141000": { "141002": "尧都区", "141021": "曲沃县", "141022": "翼城县", "141023": "襄汾县", "141024": "洪洞县", "141025": "古县", "141026": "安泽县", "141027": "浮山县", "141028": "吉县", "141029": "乡宁县", "141030": "大宁县", "141031": "隰县", "141032": "永和县", "141033": "蒲县", "141034": "汾西县", "141081": "侯马市", "141082": "霍州市" },
    "141100": { "141102": "离石区", "141121": "文水县", "141122": "交城县", "141123": "兴县", "141124": "临县", "141125": "柳林县", "141126": "石楼县", "141127": "岚县", "141128": "方山县", "141129": "中阳县", "141130": "交口县", "141181": "孝义市", "141182": "汾阳市" },
    "150000": { "150100": "呼和浩特市", "150200": "包头市", "150300": "乌海市", "150400": "赤峰市", "150500": "通辽市", "150600": "鄂尔多斯市", "150700": "呼伦贝尔市", "150800": "巴彦淖尔市", "150900": "乌兰察布市", "152200": "兴安盟", "152500": "锡林郭勒盟", "152900": "阿拉善盟" },
    "150100": { "150102": "新城区", "150103": "回民区", "150104": "玉泉区", "150105": "赛罕区", "150121": "土默特左旗", "150122": "托克托县", "150123": "和林格尔县", "150124": "清水河县", "150125": "武川县" },
    "150200": { "150202": "东河区", "150203": "昆都仑区", "150204": "青山区", "150205": "石拐区", "150206": "白云鄂博矿区", "150207": "九原区", "150221": "土默特右旗", "150222": "固阳县", "150223": "达尔罕茂明安联合旗" },
    "150300": { "150302": "海勃湾区", "150303": "海南区", "150304": "乌达区" },
    "150400": { "150402": "红山区", "150403": "元宝山区", "150404": "松山区", "150421": "阿鲁科尔沁旗", "150422": "巴林左旗", "150423": "巴林右旗", "150424": "林西县", "150425": "克什克腾旗", "150426": "翁牛特旗", "150428": "喀喇沁旗", "150429": "宁城县", "150430": "敖汉旗" },
    "150500": { "150502": "科尔沁区", "150521": "科尔沁左翼中旗", "150522": "科尔沁左翼后旗", "150523": "开鲁县", "150524": "库伦旗", "150525": "奈曼旗", "150526": "扎鲁特旗", "150581": "霍林郭勒市" },
    "150600": { "150602": "东胜区", "150603": "康巴什区", "150621": "达拉特旗", "150622": "准格尔旗", "150623": "鄂托克前旗", "150624": "鄂托克旗", "150625": "杭锦旗", "150626": "乌审旗", "150627": "伊金霍洛旗" },
    "150700": { "150702": "海拉尔区", "150703": "扎赉诺尔区", "150721": "阿荣旗", "150722": "莫力达瓦达斡尔族自治旗", "150723": "鄂伦春自治旗", "150724": "鄂温克族自治旗", "150725": "陈巴尔虎旗", "150726": "新巴尔虎左旗", "150727": "新巴尔虎右旗", "150781": "满洲里市", "150782": "牙克石市", "150783": "扎兰屯市", "150784": "额尔古纳市", "150785": "根河市" },
    "150800": { "150802": "临河区", "150821": "五原县", "150822": "磴口县", "150823": "乌拉特前旗", "150824": "乌拉特中旗", "150825": "乌拉特后旗", "150826": "杭锦后旗" },
    "150900": { "150902": "集宁区", "150921": "卓资县", "150922": "化德县", "150923": "商都县", "150924": "兴和县", "150925": "凉城县", "150926": "察哈尔右翼前旗", "150927": "察哈尔右翼中旗", "150928": "察哈尔右翼后旗", "150929": "四子王旗", "150981": "丰镇市" },
    "152200": { "152201": "乌兰浩特市", "152202": "阿尔山市", "152221": "科尔沁右翼前旗", "152222": "科尔沁右翼中旗", "152223": "扎赉特旗", "152224": "突泉县" },
    "152500": { "152501": "二连浩特市", "152502": "锡林浩特市", "152522": "阿巴嘎旗", "152523": "苏尼特左旗", "152524": "苏尼特右旗", "152525": "东乌珠穆沁旗", "152526": "西乌珠穆沁旗", "152527": "太仆寺旗", "152528": "镶黄旗", "152529": "正镶白旗", "152530": "正蓝旗", "152531": "多伦县" },
    "152900": { "152921": "阿拉善左旗", "152922": "阿拉善右旗", "152923": "额济纳旗" },
    "210000": { "210100": "沈阳市", "210200": "大连市", "210300": "鞍山市", "210400": "抚顺市", "210500": "本溪市", "210600": "丹东市", "210700": "锦州市", "210800": "营口市", "210900": "阜新市", "211000": "辽阳市", "211100": "盘锦市", "211200": "铁岭市", "211300": "朝阳市", "211400": "葫芦岛市" },
    "210100": { "210102": "和平区", "210103": "沈河区", "210104": "大东区", "210105": "皇姑区", "210106": "铁西区", "210111": "苏家屯区", "210112": "浑南区", "210113": "沈北新区", "210114": "于洪区", "210115": "辽中区", "210123": "康平县", "210124": "法库县", "210181": "新民市" },
    "210200": { "210202": "中山区", "210203": "西岗区", "210204": "沙河口区", "210211": "甘井子区", "210212": "旅顺口区", "210213": "金州区", "210214": "普兰店区", "210224": "长海县", "210281": "瓦房店市", "210283": "庄河市" },
    "210300": { "210302": "铁东区", "210303": "铁西区", "210304": "立山区", "210311": "千山区", "210321": "台安县", "210323": "岫岩满族自治县", "210381": "海城市" },
    "210400": { "210402": "新抚区", "210403": "东洲区", "210404": "望花区", "210411": "顺城区", "210421": "抚顺县", "210422": "新宾满族自治县", "210423": "清原满族自治县" },
    "210500": { "210502": "平山区", "210503": "溪湖区", "210504": "明山区", "210505": "南芬区", "210521": "本溪满族自治县", "210522": "桓仁满族自治县" },
    "210600": { "210602": "元宝区", "210603": "振兴区", "210604": "振安区", "210624": "宽甸满族自治县", "210681": "东港市", "210682": "凤城市" },
    "210700": { "210702": "古塔区", "210703": "凌河区", "210711": "太和区", "210726": "黑山县", "210727": "义县", "210781": "凌海市", "210782": "北镇市" },
    "210800": { "210802": "站前区", "210803": "西市区", "210804": "鲅鱼圈区", "210811": "老边区", "210881": "盖州市", "210882": "大石桥市" },
    "210900": { "210902": "海州区", "210903": "新邱区", "210904": "太平区", "210905": "清河门区", "210911": "细河区", "210921": "阜新蒙古族自治县", "210922": "彰武县" },
    "211000": { "211002": "白塔区", "211003": "文圣区", "211004": "宏伟区", "211005": "弓长岭区", "211011": "太子河区", "211021": "辽阳县", "211081": "灯塔市" },
    "211100": { "211102": "双台子区", "211103": "兴隆台区", "211104": "大洼区", "211122": "盘山县" },
    "211200": { "211202": "银州区", "211204": "清河区", "211221": "铁岭县", "211223": "西丰县", "211224": "昌图县", "211281": "调兵山市", "211282": "开原市" },
    "211300": { "211302": "双塔区", "211303": "龙城区", "211321": "朝阳县", "211322": "建平县", "211324": "喀喇沁左翼蒙古族自治县", "211381": "北票市", "211382": "凌源市" },
    "211400": { "211402": "连山区", "211403": "龙港区", "211404": "南票区", "211421": "绥中县", "211422": "建昌县", "211481": "兴城市" },
    "220000": { "220100": "长春市", "220200": "吉林市", "220300": "四平市", "220400": "辽源市", "220500": "通化市", "220600": "白山市", "220700": "松原市", "220800": "白城市", "222400": "延边朝鲜族自治州" },
    "220100": { "220102": "南关区", "220103": "宽城区", "220104": "朝阳区", "220105": "二道区", "220106": "绿园区", "220112": "双阳区", "220113": "九台区", "220122": "农安县", "220182": "榆树市", "220183": "德惠市" },
    "220200": { "220202": "昌邑区", "220203": "龙潭区", "220204": "船营区", "220211": "丰满区", "220221": "永吉县", "220281": "蛟河市", "220282": "桦甸市", "220283": "舒兰市", "220284": "磐石市" },
    "220300": { "220302": "铁西区", "220303": "铁东区", "220322": "梨树县", "220323": "伊通满族自治县", "220381": "公主岭市", "220382": "双辽市" },
    "220400": { "220402": "龙山区", "220403": "西安区", "220421": "东丰县", "220422": "东辽县" },
    "220500": { "220502": "东昌区", "220503": "二道江区", "220521": "通化县", "220523": "辉南县", "220524": "柳河县", "220581": "梅河口市", "220582": "集安市" },
    "220600": { "220602": "浑江区", "220605": "江源区", "220621": "抚松县", "220622": "靖宇县", "220623": "长白朝鲜族自治县", "220681": "临江市" },
    "220700": { "220702": "宁江区", "220721": "前郭尔罗斯蒙古族自治县", "220722": "长岭县", "220723": "乾安县", "220781": "扶余市" },
    "220800": { "220802": "洮北区", "220821": "镇赉县", "220822": "通榆县", "220881": "洮南市", "220882": "大安市" },
    "222400": { "222401": "延吉市", "222402": "图们市", "222403": "敦化市", "222404": "珲春市", "222405": "龙井市", "222406": "和龙市", "222424": "汪清县", "222426": "安图县" },
    "230000": { "230100": "哈尔滨市", "230200": "齐齐哈尔市", "230300": "鸡西市", "230400": "鹤岗市", "230500": "双鸭山市", "230600": "大庆市", "230700": "伊春市", "230800": "佳木斯市", "230900": "七台河市", "231000": "牡丹江市", "231100": "黑河市", "231200": "绥化市", "232700": "大兴安岭地区" },
    "230100": { "230102": "道里区", "230103": "南岗区", "230104": "道外区", "230108": "平房区", "230109": "松北区", "230110": "香坊区", "230111": "呼兰区", "230112": "阿城区", "230113": "双城区", "230123": "依兰县", "230124": "方正县", "230125": "宾县", "230126": "巴彦县", "230127": "木兰县", "230128": "通河县", "230129": "延寿县", "230183": "尚志市", "230184": "五常市" },
    "230200": { "230202": "龙沙区", "230203": "建华区", "230204": "铁锋区", "230205": "昂昂溪区", "230206": "富拉尔基区", "230207": "碾子山区", "230208": "梅里斯达斡尔族区", "230221": "龙江县", "230223": "依安县", "230224": "泰来县", "230225": "甘南县", "230227": "富裕县", "230229": "克山县", "230230": "克东县", "230231": "拜泉县", "230281": "讷河市" },
    "230300": { "230302": "鸡冠区", "230303": "恒山区", "230304": "滴道区", "230305": "梨树区", "230306": "城子河区", "230307": "麻山区", "230321": "鸡东县", "230381": "虎林市", "230382": "密山市" },
    "230400": { "230402": "向阳区", "230403": "工农区", "230404": "南山区", "230405": "兴安区", "230406": "东山区", "230407": "兴山区", "230421": "萝北县", "230422": "绥滨县" },
    "230500": { "230502": "尖山区", "230503": "岭东区", "230505": "四方台区", "230506": "宝山区", "230521": "集贤县", "230522": "友谊县", "230523": "宝清县", "230524": "饶河县" },
    "230600": { "230602": "萨尔图区", "230603": "龙凤区", "230604": "让胡路区", "230605": "红岗区", "230606": "大同区", "230621": "肇州县", "230622": "肇源县", "230623": "林甸县", "230624": "杜尔伯特蒙古族自治县" },
    "230700": { "230702": "伊春区", "230703": "南岔区", "230704": "友好区", "230705": "西林区", "230706": "翠峦区", "230707": "新青区", "230708": "美溪区", "230709": "金山屯区", "230710": "五营区", "230711": "乌马河区", "230712": "汤旺河区", "230713": "带岭区", "230714": "乌伊岭区", "230715": "红星区", "230716": "上甘岭区", "230722": "嘉荫县", "230781": "铁力市" },
    "230800": { "230803": "向阳区", "230804": "前进区", "230805": "东风区", "230811": "郊区", "230822": "桦南县", "230826": "桦川县", "230828": "汤原县", "230881": "同江市", "230882": "富锦市", "230883": "抚远市" },
    "230900": { "230902": "新兴区", "230903": "桃山区", "230904": "茄子河区", "230921": "勃利县" },
    "231000": { "231002": "东安区", "231003": "阳明区", "231004": "爱民区", "231005": "西安区", "231025": "林口县", "231081": "绥芬河市", "231083": "海林市", "231084": "宁安市", "231085": "穆棱市", "231086": "东宁市" },
    "231100": { "231102": "爱辉区", "231121": "嫩江县", "231123": "逊克县", "231124": "孙吴县", "231181": "北安市", "231182": "五大连池市" },
    "231200": { "231202": "北林区", "231221": "望奎县", "231222": "兰西县", "231223": "青冈县", "231224": "庆安县", "231225": "明水县", "231226": "绥棱县", "231281": "安达市", "231282": "肇东市", "231283": "海伦市" },
    "232700": { "232721": "呼玛县", "232722": "塔河县", "232723": "漠河县" },
    "310000": { "310100": "市辖区" },
    "310100": { "310101": "黄浦区", "310104": "徐汇区", "310105": "长宁区", "310106": "静安区", "310107": "普陀区", "310109": "虹口区", "310110": "杨浦区", "310112": "闵行区", "310113": "宝山区", "310114": "嘉定区", "310115": "浦东新区", "310116": "金山区", "310117": "松江区", "310118": "青浦区", "310120": "奉贤区", "310151": "崇明区" },
    "320000": { "320100": "南京市", "320200": "无锡市", "320300": "徐州市", "320400": "常州市", "320500": "苏州市", "320600": "南通市", "320700": "连云港市", "320800": "淮安市", "320900": "盐城市", "321000": "扬州市", "321100": "镇江市", "321200": "泰州市", "321300": "宿迁市" },
    "320100": { "320102": "玄武区", "320104": "秦淮区", "320105": "建邺区", "320106": "鼓楼区", "320111": "浦口区", "320113": "栖霞区", "320114": "雨花台区", "320115": "江宁区", "320116": "六合区", "320117": "溧水区", "320118": "高淳区" },
    "320200": { "320205": "锡山区", "320206": "惠山区", "320211": "滨湖区", "320213": "梁溪区", "320214": "新吴区", "320281": "江阴市", "320282": "宜兴市" },
    "320300": { "320302": "鼓楼区", "320303": "云龙区", "320305": "贾汪区", "320311": "泉山区", "320312": "铜山区", "320321": "丰县", "320322": "沛县", "320324": "睢宁县", "320381": "新沂市", "320382": "邳州市" },
    "320400": { "320402": "天宁区", "320404": "钟楼区", "320411": "新北区", "320412": "武进区", "320413": "金坛区", "320481": "溧阳市" },
    "320500": { "320505": "虎丘区", "320506": "吴中区", "320507": "相城区", "320508": "姑苏区", "320509": "吴江区", "320581": "常熟市", "320582": "张家港市", "320583": "昆山市", "320585": "太仓市" },
    "320600": { "320602": "崇川区", "320611": "港闸区", "320612": "通州区", "320621": "海安县", "320623": "如东县", "320681": "启东市", "320682": "如皋市", "320684": "海门市" },
    "320700": { "320703": "连云区", "320706": "海州区", "320707": "赣榆区", "320722": "东海县", "320723": "灌云县", "320724": "灌南县" },
    "320800": { "320803": "淮安区", "320804": "淮阴区", "320812": "清江浦区", "320813": "洪泽区", "320826": "涟水县", "320830": "盱眙县", "320831": "金湖县" },
    "320900": { "320902": "亭湖区", "320903": "盐都区", "320904": "大丰区", "320921": "响水县", "320922": "滨海县", "320923": "阜宁县", "320924": "射阳县", "320925": "建湖县", "320981": "东台市" },
    "321000": { "321002": "广陵区", "321003": "邗江区", "321012": "江都区", "321023": "宝应县", "321081": "仪征市", "321084": "高邮市" },
    "321100": { "321102": "京口区", "321111": "润州区", "321112": "丹徒区", "321181": "丹阳市", "321182": "扬中市", "321183": "句容市" },
    "321200": { "321202": "海陵区", "321203": "高港区", "321204": "姜堰区", "321281": "兴化市", "321282": "靖江市", "321283": "泰兴市" },
    "321300": { "321302": "宿城区", "321311": "宿豫区", "321322": "沭阳县", "321323": "泗阳县", "321324": "泗洪县" },
    "330000": { "330100": "杭州市", "330200": "宁波市", "330300": "温州市", "330400": "嘉兴市", "330500": "湖州市", "330600": "绍兴市", "330700": "金华市", "330800": "衢州市", "330900": "舟山市", "331000": "台州市", "331100": "丽水市" },
    "330100": { "330102": "上城区", "330103": "下城区", "330104": "江干区", "330105": "拱墅区", "330106": "西湖区", "330108": "滨江区", "330109": "萧山区", "330110": "余杭区", "330111": "富阳区", "330122": "桐庐县", "330127": "淳安县", "330182": "建德市", "330185": "临安市" },
    "330200": { "330203": "海曙区", "330204": "江东区", "330205": "江北区", "330206": "北仑区", "330211": "镇海区", "330212": "鄞州区", "330225": "象山县", "330226": "宁海县", "330281": "余姚市", "330282": "慈溪市", "330283": "奉化市" },
    "330300": { "330302": "鹿城区", "330303": "龙湾区", "330304": "瓯海区", "330305": "洞头区", "330324": "永嘉县", "330326": "平阳县", "330327": "苍南县", "330328": "文成县", "330329": "泰顺县", "330381": "瑞安市", "330382": "乐清市" },
    "330400": { "330402": "南湖区", "330411": "秀洲区", "330421": "嘉善县", "330424": "海盐县", "330481": "海宁市", "330482": "平湖市", "330483": "桐乡市" },
    "330500": { "330502": "吴兴区", "330503": "南浔区", "330521": "德清县", "330522": "长兴县", "330523": "安吉县" },
    "330600": { "330602": "越城区", "330603": "柯桥区", "330604": "上虞区", "330624": "新昌县", "330681": "诸暨市", "330683": "嵊州市" },
    "330700": { "330702": "婺城区", "330703": "金东区", "330723": "武义县", "330726": "浦江县", "330727": "磐安县", "330781": "兰溪市", "330782": "义乌市", "330783": "东阳市", "330784": "永康市" },
    "330800": { "330802": "柯城区", "330803": "衢江区", "330822": "常山县", "330824": "开化县", "330825": "龙游县", "330881": "江山市" },
    "330900": { "330902": "定海区", "330903": "普陀区", "330921": "岱山县", "330922": "嵊泗县" },
    "331000": { "331002": "椒江区", "331003": "黄岩区", "331004": "路桥区", "331021": "玉环县", "331022": "三门县", "331023": "天台县", "331024": "仙居县", "331081": "温岭市", "331082": "临海市" },
    "331100": { "331102": "莲都区", "331121": "青田县", "331122": "缙云县", "331123": "遂昌县", "331124": "松阳县", "331125": "云和县", "331126": "庆元县", "331127": "景宁畲族自治县", "331181": "龙泉市" },
    "340000": { "340100": "合肥市", "340200": "芜湖市", "340300": "蚌埠市", "340400": "淮南市", "340500": "马鞍山市", "340600": "淮北市", "340700": "铜陵市", "340800": "安庆市", "341000": "黄山市", "341100": "滁州市", "341200": "阜阳市", "341300": "宿州市", "341500": "六安市", "341600": "亳州市", "341700": "池州市", "341800": "宣城市" },
    "340100": { "340102": "瑶海区", "340103": "庐阳区", "340104": "蜀山区", "340111": "包河区", "340121": "长丰县", "340122": "肥东县", "340123": "肥西县", "340124": "庐江县", "340181": "巢湖市" },
    "340200": { "340202": "镜湖区", "340203": "弋江区", "340207": "鸠江区", "340208": "三山区", "340221": "芜湖县", "340222": "繁昌县", "340223": "南陵县", "340225": "无为县" },
    "340300": { "340302": "龙子湖区", "340303": "蚌山区", "340304": "禹会区", "340311": "淮上区", "340321": "怀远县", "340322": "五河县", "340323": "固镇县" },
    "340400": { "340402": "大通区", "340403": "田家庵区", "340404": "谢家集区", "340405": "八公山区", "340406": "潘集区", "340421": "凤台县", "340422": "寿县" },
    "340500": { "340503": "花山区", "340504": "雨山区", "340506": "博望区", "340521": "当涂县", "340522": "含山县", "340523": "和县" },
    "340600": { "340602": "杜集区", "340603": "相山区", "340604": "烈山区", "340621": "濉溪县" },
    "340700": { "340705": "铜官区", "340706": "义安区", "340711": "郊区", "340722": "枞阳县" },
    "340800": { "340802": "迎江区", "340803": "大观区", "340811": "宜秀区", "340822": "怀宁县", "340824": "潜山县", "340825": "太湖县", "340826": "宿松县", "340827": "望江县", "340828": "岳西县", "340881": "桐城市" },
    "341000": { "341002": "屯溪区", "341003": "黄山区", "341004": "徽州区", "341021": "歙县", "341022": "休宁县", "341023": "黟县", "341024": "祁门县" },
    "341100": { "341102": "琅琊区", "341103": "南谯区", "341122": "来安县", "341124": "全椒县", "341125": "定远县", "341126": "凤阳县", "341181": "天长市", "341182": "明光市" },
    "341200": { "341202": "颍州区", "341203": "颍东区", "341204": "颍泉区", "341221": "临泉县", "341222": "太和县", "341225": "阜南县", "341226": "颍上县", "341282": "界首市" },
    "341300": { "341302": "埇桥区", "341321": "砀山县", "341322": "萧县", "341323": "灵璧县", "341324": "泗县" },
    "341500": { "341502": "金安区", "341503": "裕安区", "341504": "叶集区", "341522": "霍邱县", "341523": "舒城县", "341524": "金寨县", "341525": "霍山县" },
    "341600": { "341602": "谯城区", "341621": "涡阳县", "341622": "蒙城县", "341623": "利辛县" },
    "341700": { "341702": "贵池区", "341721": "东至县", "341722": "石台县", "341723": "青阳县" },
    "341800": { "341802": "宣州区", "341821": "郎溪县", "341822": "广德县", "341823": "泾县", "341824": "绩溪县", "341825": "旌德县", "341881": "宁国市" },
    "350000": { "350100": "福州市", "350200": "厦门市", "350300": "莆田市", "350400": "三明市", "350500": "泉州市", "350600": "漳州市", "350700": "南平市", "350800": "龙岩市", "350900": "宁德市" },
    "350100": { "350102": "鼓楼区", "350103": "台江区", "350104": "仓山区", "350105": "马尾区", "350111": "晋安区", "350121": "闽侯县", "350122": "连江县", "350123": "罗源县", "350124": "闽清县", "350125": "永泰县", "350128": "平潭县", "350181": "福清市", "350182": "长乐市" },
    "350200": { "350203": "思明区", "350205": "海沧区", "350206": "湖里区", "350211": "集美区", "350212": "同安区", "350213": "翔安区" },
    "350300": { "350302": "城厢区", "350303": "涵江区", "350304": "荔城区", "350305": "秀屿区", "350322": "仙游县" },
    "350400": { "350402": "梅列区", "350403": "三元区", "350421": "明溪县", "350423": "清流县", "350424": "宁化县", "350425": "大田县", "350426": "尤溪县", "350427": "沙县", "350428": "将乐县", "350429": "泰宁县", "350430": "建宁县", "350481": "永安市" },
    "350500": { "350502": "鲤城区", "350503": "丰泽区", "350504": "洛江区", "350505": "泉港区", "350521": "惠安县", "350524": "安溪县", "350525": "永春县", "350526": "德化县", "350527": "金门县", "350581": "石狮市", "350582": "晋江市", "350583": "南安市" },
    "350600": { "350602": "芗城区", "350603": "龙文区", "350622": "云霄县", "350623": "漳浦县", "350624": "诏安县", "350625": "长泰县", "350626": "东山县", "350627": "南靖县", "350628": "平和县", "350629": "华安县", "350681": "龙海市" },
    "350700": { "350702": "延平区", "350703": "建阳区", "350721": "顺昌县", "350722": "浦城县", "350723": "光泽县", "350724": "松溪县", "350725": "政和县", "350781": "邵武市", "350782": "武夷山市", "350783": "建瓯市" },
    "350800": { "350802": "新罗区", "350803": "永定区", "350821": "长汀县", "350823": "上杭县", "350824": "武平县", "350825": "连城县", "350881": "漳平市" },
    "350900": { "350902": "蕉城区", "350921": "霞浦县", "350922": "古田县", "350923": "屏南县", "350924": "寿宁县", "350925": "周宁县", "350926": "柘荣县", "350981": "福安市", "350982": "福鼎市" },
    "360000": { "360100": "南昌市", "360200": "景德镇市", "360300": "萍乡市", "360400": "九江市", "360500": "新余市", "360600": "鹰潭市", "360700": "赣州市", "360800": "吉安市", "360900": "宜春市", "361000": "抚州市", "361100": "上饶市" },
    "360100": { "360102": "东湖区", "360103": "西湖区", "360104": "青云谱区", "360105": "湾里区", "360111": "青山湖区", "360112": "新建区", "360121": "南昌县", "360123": "安义县", "360124": "进贤县" },
    "360200": { "360202": "昌江区", "360203": "珠山区", "360222": "浮梁县", "360281": "乐平市" },
    "360300": { "360302": "安源区", "360313": "湘东区", "360321": "莲花县", "360322": "上栗县", "360323": "芦溪县" },
    "360400": { "360402": "濂溪区", "360403": "浔阳区", "360421": "九江县", "360423": "武宁县", "360424": "修水县", "360425": "永修县", "360426": "德安县", "360428": "都昌县", "360429": "湖口县", "360430": "彭泽县", "360481": "瑞昌市", "360482": "共青城市", "360483": "庐山市" },
    "360500": { "360502": "渝水区", "360521": "分宜县" },
    "360600": { "360602": "月湖区", "360622": "余江县", "360681": "贵溪市" },
    "360700": { "360702": "章贡区", "360703": "南康区", "360721": "赣县", "360722": "信丰县", "360723": "大余县", "360724": "上犹县", "360725": "崇义县", "360726": "安远县", "360727": "龙南县", "360728": "定南县", "360729": "全南县", "360730": "宁都县", "360731": "于都县", "360732": "兴国县", "360733": "会昌县", "360734": "寻乌县", "360735": "石城县", "360781": "瑞金市" },
    "360800": { "360802": "吉州区", "360803": "青原区", "360821": "吉安县", "360822": "吉水县", "360823": "峡江县", "360824": "新干县", "360825": "永丰县", "360826": "泰和县", "360827": "遂川县", "360828": "万安县", "360829": "安福县", "360830": "永新县", "360881": "井冈山市" },
    "360900": { "360902": "袁州区", "360921": "奉新县", "360922": "万载县", "360923": "上高县", "360924": "宜丰县", "360925": "靖安县", "360926": "铜鼓县", "360981": "丰城市", "360982": "樟树市", "360983": "高安市" },
    "361000": { "361002": "临川区", "361021": "南城县", "361022": "黎川县", "361023": "南丰县", "361024": "崇仁县", "361025": "乐安县", "361026": "宜黄县", "361027": "金溪县", "361028": "资溪县", "361029": "东乡县", "361030": "广昌县" },
    "361100": { "361102": "信州区", "361103": "广丰区", "361121": "上饶县", "361123": "玉山县", "361124": "铅山县", "361125": "横峰县", "361126": "弋阳县", "361127": "余干县", "361128": "鄱阳县", "361129": "万年县", "361130": "婺源县", "361181": "德兴市" },
    "370000": { "370100": "济南市", "370200": "青岛市", "370300": "淄博市", "370400": "枣庄市", "370500": "东营市", "370600": "烟台市", "370700": "潍坊市", "370800": "济宁市", "370900": "泰安市", "371000": "威海市", "371100": "日照市", "371200": "莱芜市", "371300": "临沂市", "371400": "德州市", "371500": "聊城市", "371600": "滨州市", "371700": "菏泽市" },
    "370100": { "370102": "历下区", "370103": "市中区", "370104": "槐荫区", "370105": "天桥区", "370112": "历城区", "370113": "长清区", "370124": "平阴县", "370125": "济阳县", "370126": "商河县", "370181": "章丘市" },
    "370200": { "370202": "市南区", "370203": "市北区", "370211": "黄岛区", "370212": "崂山区", "370213": "李沧区", "370214": "城阳区", "370281": "胶州市", "370282": "即墨市", "370283": "平度市", "370285": "莱西市" },
    "370300": { "370302": "淄川区", "370303": "张店区", "370304": "博山区", "370305": "临淄区", "370306": "周村区", "370321": "桓台县", "370322": "高青县", "370323": "沂源县" },
    "370400": { "370402": "市中区", "370403": "薛城区", "370404": "峄城区", "370405": "台儿庄区", "370406": "山亭区", "370481": "滕州市" },
    "370500": { "370502": "东营区", "370503": "河口区", "370505": "垦利区", "370522": "利津县", "370523": "广饶县" },
    "370600": { "370602": "芝罘区", "370611": "福山区", "370612": "牟平区", "370613": "莱山区", "370634": "长岛县", "370681": "龙口市", "370682": "莱阳市", "370683": "莱州市", "370684": "蓬莱市", "370685": "招远市", "370686": "栖霞市", "370687": "海阳市" },
    "370700": { "370702": "潍城区", "370703": "寒亭区", "370704": "坊子区", "370705": "奎文区", "370724": "临朐县", "370725": "昌乐县", "370781": "青州市", "370782": "诸城市", "370783": "寿光市", "370784": "安丘市", "370785": "高密市", "370786": "昌邑市" },
    "370800": { "370811": "任城区", "370812": "兖州区", "370826": "微山县", "370827": "鱼台县", "370828": "金乡县", "370829": "嘉祥县", "370830": "汶上县", "370831": "泗水县", "370832": "梁山县", "370881": "曲阜市", "370883": "邹城市" },
    "370900": { "370902": "泰山区", "370911": "岱岳区", "370921": "宁阳县", "370923": "东平县", "370982": "新泰市", "370983": "肥城市" },
    "371000": { "371002": "环翠区", "371003": "文登区", "371082": "荣成市", "371083": "乳山市" },
    "371100": { "371102": "东港区", "371103": "岚山区", "371121": "五莲县", "371122": "莒县" },
    "371200": { "371202": "莱城区", "371203": "钢城区" },
    "371300": { "371302": "兰山区", "371311": "罗庄区", "371312": "河东区", "371321": "沂南县", "371322": "郯城县", "371323": "沂水县", "371324": "兰陵县", "371325": "费县", "371326": "平邑县", "371327": "莒南县", "371328": "蒙阴县", "371329": "临沭县" },
    "371400": { "371402": "德城区", "371403": "陵城区", "371422": "宁津县", "371423": "庆云县", "371424": "临邑县", "371425": "齐河县", "371426": "平原县", "371427": "夏津县", "371428": "武城县", "371481": "乐陵市", "371482": "禹城市" },
    "371500": { "371502": "东昌府区", "371521": "阳谷县", "371522": "莘县", "371523": "茌平县", "371524": "东阿县", "371525": "冠县", "371526": "高唐县", "371581": "临清市" },
    "371600": { "371602": "滨城区", "371603": "沾化区", "371621": "惠民县", "371622": "阳信县", "371623": "无棣县", "371625": "博兴县", "371626": "邹平县" },
    "371700": { "371702": "牡丹区", "371703": "定陶区", "371721": "曹县", "371722": "单县", "371723": "成武县", "371724": "巨野县", "371725": "郓城县", "371726": "鄄城县", "371728": "东明县" },
    "410000": { "410100": "郑州市", "410200": "开封市", "410300": "洛阳市", "410400": "平顶山市", "410500": "安阳市", "410600": "鹤壁市", "410700": "新乡市", "410800": "焦作市", "410900": "濮阳市", "411000": "许昌市", "411100": "漯河市", "411200": "三门峡市", "411300": "南阳市", "411400": "商丘市", "411500": "信阳市", "411600": "周口市", "411700": "驻马店市", "419001": "济源市" },
    "410100": { "410102": "中原区", "410103": "二七区", "410104": "管城回族区", "410105": "金水区", "410106": "上街区", "410108": "惠济区", "410122": "中牟县", "410181": "巩义市", "410182": "荥阳市", "410183": "新密市", "410184": "新郑市", "410185": "登封市" },
    "410200": { "410202": "龙亭区", "410203": "顺河回族区", "410204": "鼓楼区", "410205": "禹王台区", "410211": "金明区", "410212": "祥符区", "410221": "杞县", "410222": "通许县", "410223": "尉氏县", "410225": "兰考县" },
    "410300": { "410302": "老城区", "410303": "西工区", "410304": "瀍河回族区", "410305": "涧西区", "410306": "吉利区", "410311": "洛龙区", "410322": "孟津县", "410323": "新安县", "410324": "栾川县", "410325": "嵩县", "410326": "汝阳县", "410327": "宜阳县", "410328": "洛宁县", "410329": "伊川县", "410381": "偃师市" },
    "410400": { "410402": "新华区", "410403": "卫东区", "410404": "石龙区", "410411": "湛河区", "410421": "宝丰县", "410422": "叶县", "410423": "鲁山县", "410425": "郏县", "410481": "舞钢市", "410482": "汝州市" },
    "410500": { "410502": "文峰区", "410503": "北关区", "410505": "殷都区", "410506": "龙安区", "410522": "安阳县", "410523": "汤阴县", "410526": "滑县", "410527": "内黄县", "410581": "林州市" },
    "410600": { "410602": "鹤山区", "410603": "山城区", "410611": "淇滨区", "410621": "浚县", "410622": "淇县" },
    "410700": { "410702": "红旗区", "410703": "卫滨区", "410704": "凤泉区", "410711": "牧野区", "410721": "新乡县", "410724": "获嘉县", "410725": "原阳县", "410726": "延津县", "410727": "封丘县", "410728": "长垣县", "410781": "卫辉市", "410782": "辉县市" },
    "410800": { "410802": "解放区", "410803": "中站区", "410804": "马村区", "410811": "山阳区", "410821": "修武县", "410822": "博爱县", "410823": "武陟县", "410825": "温县", "410882": "沁阳市", "410883": "孟州市" },
    "410900": { "410902": "华龙区", "410922": "清丰县", "410923": "南乐县", "410926": "范县", "410927": "台前县", "410928": "濮阳县" },
    "411000": { "411002": "魏都区", "411023": "许昌县", "411024": "鄢陵县", "411025": "襄城县", "411081": "禹州市", "411082": "长葛市" },
    "411100": { "411102": "源汇区", "411103": "郾城区", "411104": "召陵区", "411121": "舞阳县", "411122": "临颍县" },
    "411200": { "411202": "湖滨区", "411203": "陕州区", "411221": "渑池县", "411224": "卢氏县", "411281": "义马市", "411282": "灵宝市" },
    "411300": { "411302": "宛城区", "411303": "卧龙区", "411321": "南召县", "411322": "方城县", "411323": "西峡县", "411324": "镇平县", "411325": "内乡县", "411326": "淅川县", "411327": "社旗县", "411328": "唐河县", "411329": "新野县", "411330": "桐柏县", "411381": "邓州市" },
    "411400": { "411402": "梁园区", "411403": "睢阳区", "411421": "民权县", "411422": "睢县", "411423": "宁陵县", "411424": "柘城县", "411425": "虞城县", "411426": "夏邑县", "411481": "永城市" },
    "411500": { "411502": "浉河区", "411503": "平桥区", "411521": "罗山县", "411522": "光山县", "411523": "新县", "411524": "商城县", "411525": "固始县", "411526": "潢川县", "411527": "淮滨县", "411528": "息县" },
    "411600": { "411602": "川汇区", "411621": "扶沟县", "411622": "西华县", "411623": "商水县", "411624": "沈丘县", "411625": "郸城县", "411626": "淮阳县", "411627": "太康县", "411628": "鹿邑县", "411681": "项城市" },
    "411700": { "411702": "驿城区", "411721": "西平县", "411722": "上蔡县", "411723": "平舆县", "411724": "正阳县", "411725": "确山县", "411726": "泌阳县", "411727": "汝南县", "411728": "遂平县", "411729": "新蔡县" },
    "419001": { "4190011": "济源市克井镇", "41900111": "济源市下冶镇", "419001001": "济源市沁园街道", "419001002": "济源市济水街道", "419001003": "济源市北海街道", "419001004": "济源市天坛街道", "419001005": "济源市玉泉街道", "419001101": "济源市五龙口镇", "419001102": "济源市轵城镇", "419001103": "济源市承留镇", "419001104": "济源市邵原镇", "419001105": "济源市坡头镇", "419001106": "济源市梨林镇", "419001107": "济源市大峪镇", "419001108": "济源市思礼镇", "419001109": "济源市王屋镇" },
    "420000": { "420100": "武汉市", "420200": "黄石市", "420300": "十堰市", "420500": "宜昌市", "420600": "襄阳市", "420700": "鄂州市", "420800": "荆门市", "420900": "孝感市", "421000": "荆州市", "421100": "黄冈市", "421200": "咸宁市", "421300": "随州市", "422800": "恩施土家族苗族自治州", "429004": "仙桃市", "429005": "潜江市", "429006": "天门市", "429021": "神农架林区" },
    "420100": { "420102": "江岸区", "420103": "江汉区", "420104": "硚口区", "420105": "汉阳区", "420106": "武昌区", "420107": "青山区", "420111": "洪山区", "420112": "东西湖区", "420113": "汉南区", "420114": "蔡甸区", "420115": "江夏区", "420116": "黄陂区", "420117": "新洲区" },
    "420200": { "420202": "黄石港区", "420203": "西塞山区", "420204": "下陆区", "420205": "铁山区", "420222": "阳新县", "420281": "大冶市" },
    "420300": { "420302": "茅箭区", "420303": "张湾区", "420304": "郧阳区", "420322": "郧西县", "420323": "竹山县", "420324": "竹溪县", "420325": "房县", "420381": "丹江口市" },
    "420500": { "420502": "西陵区", "420503": "伍家岗区", "420504": "点军区", "420505": "猇亭区", "420506": "夷陵区", "420525": "远安县", "420526": "兴山县", "420527": "秭归县", "420528": "长阳土家族自治县", "420529": "五峰土家族自治县", "420581": "宜都市", "420582": "当阳市", "420583": "枝江市" },
    "420600": { "420602": "襄城区", "420606": "樊城区", "420607": "襄州区", "420624": "南漳县", "420625": "谷城县", "420626": "保康县", "420682": "老河口市", "420683": "枣阳市", "420684": "宜城市" },
    "420700": { "420702": "梁子湖区", "420703": "华容区", "420704": "鄂城区" },
    "420800": { "420802": "东宝区", "420804": "掇刀区", "420821": "京山县", "420822": "沙洋县", "420881": "钟祥市" },
    "420900": { "420902": "孝南区", "420921": "孝昌县", "420922": "大悟县", "420923": "云梦县", "420981": "应城市", "420982": "安陆市", "420984": "汉川市" },
    "421000": { "421002": "沙市区", "421003": "荆州区", "421022": "公安县", "421023": "监利县", "421024": "江陵县", "421081": "石首市", "421083": "洪湖市", "421087": "松滋市" },
    "421100": { "421102": "黄州区", "421121": "团风县", "421122": "红安县", "421123": "罗田县", "421124": "英山县", "421125": "浠水县", "421126": "蕲春县", "421127": "黄梅县", "421181": "麻城市", "421182": "武穴市" },
    "421200": { "421202": "咸安区", "421221": "嘉鱼县", "421222": "通城县", "421223": "崇阳县", "421224": "通山县", "421281": "赤壁市" },
    "421300": { "421303": "曾都区", "421321": "随县", "421381": "广水市" },
    "422800": { "422801": "恩施市", "422802": "利川市", "422822": "建始县", "422823": "巴东县", "422825": "宣恩县", "422826": "咸丰县", "422827": "来凤县", "422828": "鹤峰县" },
    "429004": { "4290041": "郑场镇", "4290044": "工业园区", "42900411": "张沟镇", "429004001": "沙嘴街道", "429004002": "干河街道", "429004003": "龙华山", "429004101": "毛嘴镇", "429004102": "豆河镇", "429004103": "三伏潭镇", "429004104": "胡场镇", "429004105": "长倘口镇", "429004106": "西流河镇", "429004107": "沙湖镇", "429004108": "杨林尾镇", "429004109": "彭场镇", "429004111": "郭河镇", "429004112": "沔城回族镇", "429004113": "通海口镇", "429004114": "陈场镇", "429004401": "九合垸原种场", "429004402": "沙湖原种场", "429004404": "五湖渔场", "429004405": "赵西垸林场", "429004407": "畜禽良种场", "429004408": "排湖风景区" },
    "429005": { "4290051": "竹根滩镇", "4290054": "江汉石油管理局", "42900545": "周矶管理区", "429005001": "园林", "429005002": "杨市", "429005003": "周矶", "429005004": "广华", "429005005": "泰丰", "429005006": "高场", "429005101": "渔洋镇", "429005102": "王场镇", "429005103": "高石碑镇", "429005104": "熊口镇", "429005105": "老新镇", "429005106": "浩口镇", "429005107": "积玉口镇", "429005108": "张金镇", "429005109": "龙湾镇", "429005401": "潜江经济开发区", "429005451": "后湖管理区", "429005452": "熊口管理区", "429005453": "总口管理区", "429005454": "白鹭湖管理区", "429005455": "运粮湖管理区", "429005457": "浩口原种场" },
    "429006": { "4290061": "多宝镇", "42900611": "麻洋镇", "42900612": "石河镇", "42900645": "蒋湖农场", "429006001": "竟陵街道", "429006002": "侨乡街道开发区", "429006003": "杨林街道", "429006101": "拖市镇", "429006102": "张港镇", "429006103": "蒋场镇", "429006104": "汪场镇", "429006105": "渔薪镇", "429006106": "黄潭镇", "429006107": "岳口镇", "429006108": "横林镇", "429006109": "彭市镇", "429006111": "多祥镇", "429006112": "干驿镇", "429006113": "马湾镇", "429006114": "卢市镇", "429006115": "小板镇", "429006116": "九真镇", "429006118": "皂市镇", "429006119": "胡市镇", "429006121": "佛子山镇", "429006201": "净潭乡", "429006451": "白茅湖农场", "429006452": "沉湖管委会" },
    "429021": { "4290211": "松柏镇", "4290212": "宋洛乡", "429021101": "阳日镇", "429021102": "木鱼镇", "429021103": "红坪镇", "429021104": "新华镇", "429021105": "九湖镇", "429021202": "下谷坪土家族乡" },
    "430000": { "430100": "长沙市", "430200": "株洲市", "430300": "湘潭市", "430400": "衡阳市", "430500": "邵阳市", "430600": "岳阳市", "430700": "常德市", "430800": "张家界市", "430900": "益阳市", "431000": "郴州市", "431100": "永州市", "431200": "怀化市", "431300": "娄底市", "433100": "湘西土家族苗族自治州" },
    "430100": { "430102": "芙蓉区", "430103": "天心区", "430104": "岳麓区", "430105": "开福区", "430111": "雨花区", "430112": "望城区", "430121": "长沙县", "430124": "宁乡县", "430181": "浏阳市" },
    "430200": { "430202": "荷塘区", "430203": "芦淞区", "430204": "石峰区", "430211": "天元区", "430221": "株洲县", "430223": "攸县", "430224": "茶陵县", "430225": "炎陵县", "430281": "醴陵市" },
    "430300": { "430302": "雨湖区", "430304": "岳塘区", "430321": "湘潭县", "430381": "湘乡市", "430382": "韶山市" },
    "430400": { "430405": "珠晖区", "430406": "雁峰区", "430407": "石鼓区", "430408": "蒸湘区", "430412": "南岳区", "430421": "衡阳县", "430422": "衡南县", "430423": "衡山县", "430424": "衡东县", "430426": "祁东县", "430481": "耒阳市", "430482": "常宁市" },
    "430500": { "430502": "双清区", "430503": "大祥区", "430511": "北塔区", "430521": "邵东县", "430522": "新邵县", "430523": "邵阳县", "430524": "隆回县", "430525": "洞口县", "430527": "绥宁县", "430528": "新宁县", "430529": "城步苗族自治县", "430581": "武冈市" },
    "430600": { "430602": "岳阳楼区", "430603": "云溪区", "430611": "君山区", "430621": "岳阳县", "430623": "华容县", "430624": "湘阴县", "430626": "平江县", "430681": "汨罗市", "430682": "临湘市" },
    "430700": { "430702": "武陵区", "430703": "鼎城区", "430721": "安乡县", "430722": "汉寿县", "430723": "澧县", "430724": "临澧县", "430725": "桃源县", "430726": "石门县", "430781": "津市市" },
    "430800": { "430802": "永定区", "430811": "武陵源区", "430821": "慈利县", "430822": "桑植县" },
    "430900": { "430902": "资阳区", "430903": "赫山区", "430921": "南县", "430922": "桃江县", "430923": "安化县", "430981": "沅江市" },
    "431000": { "431002": "北湖区", "431003": "苏仙区", "431021": "桂阳县", "431022": "宜章县", "431023": "永兴县", "431024": "嘉禾县", "431025": "临武县", "431026": "汝城县", "431027": "桂东县", "431028": "安仁县", "431081": "资兴市" },
    "431100": { "431102": "零陵区", "431103": "冷水滩区", "431121": "祁阳县", "431122": "东安县", "431123": "双牌县", "431124": "道县", "431125": "江永县", "431126": "宁远县", "431127": "蓝山县", "431128": "新田县", "431129": "江华瑶族自治县" },
    "431200": { "431202": "鹤城区", "431221": "中方县", "431222": "沅陵县", "431223": "辰溪县", "431224": "溆浦县", "431225": "会同县", "431226": "麻阳苗族自治县", "431227": "新晃侗族自治县", "431228": "芷江侗族自治县", "431229": "靖州苗族侗族自治县", "431230": "通道侗族自治县", "431281": "洪江市" },
    "431300": { "431302": "娄星区", "431321": "双峰县", "431322": "新化县", "431381": "冷水江市", "431382": "涟源市" },
    "433100": { "433101": "吉首市", "433122": "泸溪县", "433123": "凤凰县", "433124": "花垣县", "433125": "保靖县", "433126": "古丈县", "433127": "永顺县", "433130": "龙山县" },
    "440000": { "440100": "广州市", "440200": "韶关市", "440300": "深圳市", "440400": "珠海市", "440500": "汕头市", "440600": "佛山市", "440700": "江门市", "440800": "湛江市", "440900": "茂名市", "441200": "肇庆市", "441300": "惠州市", "441400": "梅州市", "441500": "汕尾市", "441600": "河源市", "441700": "阳江市", "441800": "清远市", "441900": "东莞市", "442000": "中山市", "445100": "潮州市", "445200": "揭阳市", "445300": "云浮市" },
    "440100": { "440103": "荔湾区", "440104": "越秀区", "440105": "海珠区", "440106": "天河区", "440111": "白云区", "440112": "黄埔区", "440113": "番禺区", "440114": "花都区", "440115": "南沙区", "440117": "从化区", "440118": "增城区" },
    "440200": { "440203": "武江区", "440204": "浈江区", "440205": "曲江区", "440222": "始兴县", "440224": "仁化县", "440229": "翁源县", "440232": "乳源瑶族自治县", "440233": "新丰县", "440281": "乐昌市", "440282": "南雄市" },
    "440300": { "440303": "罗湖区", "440304": "福田区", "440305": "南山区", "440306": "宝安区", "440307": "龙岗区", "440308": "盐田区" },
    "440400": { "440402": "香洲区", "440403": "斗门区", "440404": "金湾区" },
    "440500": { "440507": "龙湖区", "440511": "金平区", "440512": "濠江区", "440513": "潮阳区", "440514": "潮南区", "440515": "澄海区", "440523": "南澳县" },
    "440600": { "440604": "禅城区", "440605": "南海区", "440606": "顺德区", "440607": "三水区", "440608": "高明区" },
    "440700": { "440703": "蓬江区", "440704": "江海区", "440705": "新会区", "440781": "台山市", "440783": "开平市", "440784": "鹤山市", "440785": "恩平市" },
    "440800": { "440802": "赤坎区", "440803": "霞山区", "440804": "坡头区", "440811": "麻章区", "440823": "遂溪县", "440825": "徐闻县", "440881": "廉江市", "440882": "雷州市", "440883": "吴川市" },
    "440900": { "440902": "茂南区", "440904": "电白区", "440981": "高州市", "440982": "化州市", "440983": "信宜市" },
    "441200": { "441202": "端州区", "441203": "鼎湖区", "441204": "高要区", "441223": "广宁县", "441224": "怀集县", "441225": "封开县", "441226": "德庆县", "441284": "四会市" },
    "441300": { "441302": "惠城区", "441303": "惠阳区", "441322": "博罗县", "441323": "惠东县", "441324": "龙门县" },
    "441400": { "441402": "梅江区", "441403": "梅县区", "441422": "大埔县", "441423": "丰顺县", "441424": "五华县", "441426": "平远县", "441427": "蕉岭县", "441481": "兴宁市" },
    "441500": { "441502": "城区", "441521": "海丰县", "441523": "陆河县", "441581": "陆丰市" },
    "441600": { "441602": "源城区", "441621": "紫金县", "441622": "龙川县", "441623": "连平县", "441624": "和平县", "441625": "东源县" },
    "441700": { "441702": "江城区", "441704": "阳东区", "441721": "阳西县", "441781": "阳春市" },
    "441800": { "441802": "清城区", "441803": "清新区", "441821": "佛冈县", "441823": "阳山县", "441825": "连山壮族瑶族自治县", "441826": "连南瑶族自治县", "441881": "英德市", "441882": "连州市" },
    "441900": { "441900003": "东城街道", "441900004": "南城街道", "441900005": "万江街道", "441900006": "莞城街道", "441900101": "石碣镇", "441900102": "石龙镇", "441900103": "茶山镇", "441900104": "石排镇", "441900105": "企石镇", "441900106": "横沥镇", "441900107": "桥头镇", "441900108": "谢岗镇", "441900109": "东坑镇", "441900110": "常平镇", "441900111": "寮步镇", "441900112": "樟木头镇", "441900113": "大朗镇", "441900114": "黄江镇", "441900115": "清溪镇", "441900116": "塘厦镇", "441900117": "凤岗镇", "441900118": "大岭山镇", "441900119": "长安镇", "441900121": "虎门镇", "441900122": "厚街镇", "441900123": "沙田镇", "441900124": "道滘镇", "441900125": "洪梅镇", "441900126": "麻涌镇", "441900127": "望牛墩镇", "441900128": "中堂镇", "441900129": "高埗镇", "441900401": "松山湖管委会", "441900402": "虎门港管委会", "441900403": "东莞生态园" },
    "442000": { "442000001": "石岐区街道", "442000002": "东区街道", "442000003": "火炬开发区街道", "442000004": "西区街道", "442000005": "南区街道", "442000006": "五桂山街道", "442000100": "小榄镇", "442000101": "黄圃镇", "442000102": "民众镇", "442000103": "东凤镇", "442000104": "东升镇", "442000105": "古镇镇", "442000106": "沙溪镇", "442000107": "坦洲镇", "442000108": "港口镇", "442000109": "三角镇", "442000110": "横栏镇", "442000111": "南头镇", "442000112": "阜沙镇", "442000113": "南朗镇", "442000114": "三乡镇", "442000115": "板芙镇", "442000116": "大涌镇", "442000117": "神湾镇" },
    "445100": { "445102": "湘桥区", "445103": "潮安区", "445122": "饶平县" },
    "445200": { "445202": "榕城区", "445203": "揭东区", "445222": "揭西县", "445224": "惠来县", "445281": "普宁市" },
    "445300": { "445302": "云城区", "445303": "云安区", "445321": "新兴县", "445322": "郁南县", "445381": "罗定市" },
    "450000": { "450100": "南宁市", "450200": "柳州市", "450300": "桂林市", "450400": "梧州市", "450500": "北海市", "450600": "防城港市", "450700": "钦州市", "450800": "贵港市", "450900": "玉林市", "451000": "百色市", "451100": "贺州市", "451200": "河池市", "451300": "来宾市", "451400": "崇左市" },
    "450100": { "450102": "兴宁区", "450103": "青秀区", "450105": "江南区", "450107": "西乡塘区", "450108": "良庆区", "450109": "邕宁区", "450110": "武鸣区", "450123": "隆安县", "450124": "马山县", "450125": "上林县", "450126": "宾阳县", "450127": "横县" },
    "450200": { "450202": "城中区", "450203": "鱼峰区", "450204": "柳南区", "450205": "柳北区", "450206": "柳江区", "450222": "柳城县", "450223": "鹿寨县", "450224": "融安县", "450225": "融水苗族自治县", "450226": "三江侗族自治县" },
    "450300": { "450302": "秀峰区", "450303": "叠彩区", "450304": "象山区", "450305": "七星区", "450311": "雁山区", "450312": "临桂区", "450321": "阳朔县", "450323": "灵川县", "450324": "全州县", "450325": "兴安县", "450326": "永福县", "450327": "灌阳县", "450328": "龙胜各族自治县", "450329": "资源县", "450330": "平乐县", "450331": "荔浦县", "450332": "恭城瑶族自治县" },
    "450400": { "450403": "万秀区", "450405": "长洲区", "450406": "龙圩区", "450421": "苍梧县", "450422": "藤县", "450423": "蒙山县", "450481": "岑溪市" },
    "450500": { "450502": "海城区", "450503": "银海区", "450512": "铁山港区", "450521": "合浦县" },
    "450600": { "450602": "港口区", "450603": "防城区", "450621": "上思县", "450681": "东兴市" },
    "450700": { "450702": "钦南区", "450703": "钦北区", "450721": "灵山县", "450722": "浦北县" },
    "450800": { "450802": "港北区", "450803": "港南区", "450804": "覃塘区", "450821": "平南县", "450881": "桂平市" },
    "450900": { "450902": "玉州区", "450903": "福绵区", "450921": "容县", "450922": "陆川县", "450923": "博白县", "450924": "兴业县", "450981": "北流市" },
    "451000": { "451002": "右江区", "451021": "田阳县", "451022": "田东县", "451023": "平果县", "451024": "德保县", "451026": "那坡县", "451027": "凌云县", "451028": "乐业县", "451029": "田林县", "451030": "西林县", "451031": "隆林各族自治县", "451081": "靖西市" },
    "451100": { "451102": "八步区", "451103": "平桂区", "451121": "昭平县", "451122": "钟山县", "451123": "富川瑶族自治县" },
    "451200": { "451202": "金城江区", "451221": "南丹县", "451222": "天峨县", "451223": "凤山县", "451224": "东兰县", "451225": "罗城仫佬族自治县", "451226": "环江毛南族自治县", "451227": "巴马瑶族自治县", "451228": "都安瑶族自治县", "451229": "大化瑶族自治县", "451281": "宜州市" },
    "451300": { "451302": "兴宾区", "451321": "忻城县", "451322": "象州县", "451323": "武宣县", "451324": "金秀瑶族自治县", "451381": "合山市" },
    "451400": { "451402": "江州区", "451421": "扶绥县", "451422": "宁明县", "451423": "龙州县", "451424": "大新县", "451425": "天等县", "451481": "凭祥市" },
    "460000": { "460100": "海口市", "460200": "三亚市", "460300": "三沙市", "460400": "儋州市", "469001": "五指山市", "469002": "琼海市", "469005": "文昌市", "469006": "万宁市", "469007": "东方市", "469021": "定安县", "469022": "屯昌县", "469023": "澄迈县", "469024": "临高县", "469025": "白沙黎族自治县", "469026": "昌江黎族自治县", "469027": "乐东黎族自治县", "469028": "陵水黎族自治县", "469029": "保亭黎族苗族自治县", "469030": "琼中黎族苗族自治县" },
    "460100": { "460105": "秀英区", "460106": "龙华区", "460107": "琼山区", "460108": "美兰区" },
    "460200": { "460202": "海棠区", "460203": "吉阳区", "460204": "天涯区", "460205": "崖州区" },
    "460300": { "460321": "西沙群岛", "460322": "南沙群岛", "460323": "中沙群岛的岛礁及其海域" },
    "460400": { "4604001": "那大镇", "4604004": "国营西培农场", "4604005": "华南热作学院", "46040011": "三都镇", "460400101": "和庆镇", "460400102": "南丰镇", "460400103": "大成镇", "460400104": "雅星镇", "460400105": "兰洋镇", "460400106": "光村镇", "460400107": "木棠镇", "460400108": "海头镇", "460400109": "峨蔓镇", "460400111": "王五镇", "460400112": "白马井镇", "460400113": "中和镇", "460400114": "排浦镇", "460400115": "东成镇", "460400116": "新州镇", "460400404": "国营西联农场", "460400405": "国营蓝洋农场", "460400407": "国营八一农场", "460400499": "洋浦经济开发区" },
    "469001": { "4690011": "通什镇", "4690012": "畅好乡", "4690014": "畅好农场", "469001101": "南圣镇", "469001102": "毛阳镇", "469001103": "番阳镇", "469001201": "毛道乡", "469001202": "水满乡" },
    "469002": { "4690021": "嘉积镇", "4690024": "国营东太农场", "4690025": "彬村山华侨农场", "46900211": "大路镇", "469002101": "万泉镇", "469002102": "石壁镇", "469002103": "中原镇", "469002104": "博鳌镇", "469002105": "阳江镇", "469002106": "龙江镇", "469002107": "潭门镇", "469002108": "塔洋镇", "469002109": "长坡镇", "469002111": "会山镇", "469002402": "国营东红农场", "469002403": "国营东升农场" },
    "469005": { "4690051": "文城镇", "4690054": "国营东路农场", "46900511": "昌洒镇", "469005101": "重兴镇", "469005102": "蓬莱镇", "469005103": "会文镇", "469005104": "东路镇", "469005105": "潭牛镇", "469005106": "东阁镇", "469005107": "文教镇", "469005108": "东郊镇", "469005109": "龙楼镇", "469005111": "翁田镇", "469005112": "抱罗镇", "469005113": "冯坡镇", "469005114": "锦山镇", "469005115": "铺前镇", "469005116": "公坡镇", "469005401": "国营南阳农场", "469005402": "国营罗豆农场" },
    "469006": { "4690061": "万城镇", "4690064": "国营东兴农场", "4690065": "兴隆华侨农场", "46900611": "南桥镇", "469006101": "龙滚镇", "469006102": "和乐镇", "469006103": "后安镇", "469006104": "大茂镇", "469006105": "东澳镇", "469006106": "礼纪镇", "469006107": "长丰镇", "469006108": "山根镇", "469006109": "北大镇", "469006111": "三更罗镇", "469006401": "国营东和农场", "469006404": "国营新中农场", "469006501": "地方国营六连林场" },
    "469007": { "4690071": "八所镇", "4690072": "天安乡", "4690074": "国营广坝农场", "4690075": "东方华侨农场", "469007101": "东河镇", "469007102": "大田镇", "469007103": "感城镇", "469007104": "板桥镇", "469007105": "三家镇", "469007106": "四更镇", "469007107": "新龙镇", "469007201": "江边乡" },
    "469021": { "4690211": "定城镇", "4690214": "国营中瑞农场", "469021101": "新竹镇", "469021102": "龙湖镇", "469021103": "黄竹镇", "469021104": "雷鸣镇", "469021105": "龙门镇", "469021106": "龙河镇", "469021107": "岭口镇", "469021108": "翰林镇", "469021109": "富文镇", "469021401": "国营南海农场", "469021402": "国营金鸡岭农场" },
    "469022": { "4690221": "屯城镇", "4690224": "国营中建农场", "469022101": "新兴镇", "469022102": "枫木镇", "469022103": "乌坡镇", "469022104": "南吕镇", "469022105": "南坤镇", "469022106": "坡心镇", "469022107": "西昌镇", "469022401": "国营中坤农场" },
    "469023": { "4690231": "金江镇", "4690234": "国营红光农场", "46902311": "大丰镇", "469023101": "老城镇", "469023102": "瑞溪镇", "469023103": "永发镇", "469023104": "加乐镇", "469023105": "文儒镇", "469023106": "中兴镇", "469023107": "仁兴镇", "469023108": "福山镇", "469023109": "桥头镇", "469023402": "国营西达农场", "469023405": "国营金安农场" },
    "469024": { "4690241": "临城镇", "4690244": "国营红华农场", "469024101": "波莲镇", "469024102": "东英镇", "469024103": "博厚镇", "469024104": "皇桐镇", "469024105": "多文镇", "469024106": "和舍镇", "469024107": "南宝镇", "469024108": "新盈镇", "469024109": "调楼镇", "469024401": "国营加来农场" },
    "469025": { "4690251": "牙叉镇", "4690252": "细水乡", "469025101": "七坊镇", "469025102": "邦溪镇", "469025103": "打安镇", "469025201": "元门乡", "469025202": "南开乡", "469025203": "阜龙乡", "469025204": "青松乡", "469025205": "金波乡", "469025206": "荣邦乡", "469025401": "国营白沙农场", "469025404": "国营龙江农场", "469025408": "国营邦溪农场" },
    "469026": { "4690261": "石碌镇", "4690262": "王下乡", "4690265": "国营霸王岭林场", "469026101": "叉河镇", "469026102": "十月田镇", "469026103": "乌烈镇", "469026104": "昌化镇", "469026105": "海尾镇", "469026106": "七叉镇", "469026401": "国营红林农场", "469026501": "海南矿业联合有限公司" },
    "469027": { "4690271": "抱由镇", "4690275": "国营尖峰岭林业公司", "46902711": "莺歌海镇", "469027101": "万冲镇", "469027102": "大安镇", "469027103": "志仲镇", "469027104": "千家镇", "469027105": "九所镇", "469027106": "利国镇", "469027107": "黄流镇", "469027108": "佛罗镇", "469027109": "尖峰镇", "469027401": "国营山荣农场", "469027402": "国营乐光农场", "469027405": "国营保国农场", "469027501": "国营莺歌海盐场" },
    "469028": { "4690281": "椰林镇", "4690282": "提蒙乡", "4690284": "国营岭门农场", "4690285": "国营吊罗山林业公司", "469028101": "光坡镇", "469028102": "三才镇", "469028103": "英州镇", "469028104": "隆广镇", "469028105": "文罗镇", "469028106": "本号镇", "469028107": "新村镇", "469028108": "黎安镇", "469028201": "群英乡", "469028401": "国营南平农场" },
    "469029": { "4690291": "保城镇", "4690292": "六弓乡", "469029101": "什玲镇", "469029102": "加茂镇", "469029103": "响水镇", "469029104": "新政镇", "469029105": "三道镇", "469029201": "南林乡", "469029202": "毛感乡", "469029401": "国营新星农场", "469029402": "海南保亭热带作物研究所", "469029403": "国营金江农场", "469029405": "国营三道农场" },
    "469030": { "4690301": "营根镇", "4690302": "吊罗山乡", "4690305": "海南黎母山省级自然保护区管理站", "469030101": "湾岭镇", "469030102": "黎母山镇", "469030103": "和平镇", "469030104": "长征镇", "469030105": "红毛镇", "469030106": "中平镇", "469030201": "上安乡", "469030202": "什运乡", "469030402": "国营阳江农场", "469030403": "国营乌石农场", "469030406": "国营加钗农场", "469030407": "国营长征农场" },
    "500000": { "500100": "市辖区", "500228": "梁平县", "500229": "城口县", "500230": "丰都县", "500231": "垫江县", "500232": "武隆县", "500233": "忠县", "500235": "云阳县", "500236": "奉节县", "500237": "巫山县", "500238": "巫溪县", "500240": "石柱土家族自治县", "500241": "秀山土家族苗族自治县", "500242": "酉阳土家族苗族自治县", "500243": "彭水苗族土家族自治县" },
    "500100": { "500101": "万州区", "500102": "涪陵区", "500103": "渝中区", "500104": "大渡口区", "500105": "江北区", "500106": "沙坪坝区", "500107": "九龙坡区", "500108": "南岸区", "500109": "北碚区", "500110": "綦江区", "500111": "大足区", "500112": "渝北区", "500113": "巴南区", "500114": "黔江区", "500115": "长寿区", "500116": "江津区", "500117": "合川区", "500118": "永川区", "500119": "南川区", "500120": "璧山区", "500151": "铜梁区", "500152": "潼南区", "500153": "荣昌区", "500154": "开州区" },
    "500228": { "5002282": "安胜乡", "5002284": "梁平县农场", "50022811": "聚奎镇", "50022812": "合兴镇", "500228001": "梁平县梁山街道", "500228002": "梁平县双桂街道", "500228101": "仁贤镇", "500228102": "礼让镇", "500228103": "云龙镇", "500228104": "屏锦镇", "500228106": "袁驿镇", "500228107": "新盛镇", "500228108": "福禄镇", "500228109": "金带镇", "500228111": "明达镇", "500228112": "荫平镇", "500228113": "和林镇", "500228114": "回龙镇", "500228115": "碧山镇", "500228116": "虎城镇", "500228117": "七星镇", "500228118": "龙门镇", "500228119": "文化镇", "500228121": "石安镇", "500228122": "柏家镇", "500228123": "大观镇", "500228124": "竹山镇", "500228125": "蟠龙镇", "500228126": "星桥镇", "500228127": "曲水镇", "500228201": "铁门乡", "500228202": "龙胜乡", "500228203": "复平乡", "500228205": "紫照乡", "500228401": "梁平县双桂工业园区" },
    "500229": { "50022911": "咸宜镇", "50022921": "双河乡", "50022922": "厚坪乡", "500229001": "葛城街道", "500229002": "复兴街道", "500229102": "巴山镇", "500229103": "坪坝镇", "500229104": "庙坝镇", "500229105": "明通镇", "500229106": "修齐镇", "500229107": "高观镇", "500229108": "高燕镇", "500229109": "东安镇", "500229111": "高楠镇", "500229201": "龙田乡", "500229202": "北屏乡", "500229205": "左岚乡", "500229208": "沿河乡", "500229211": "蓼子乡", "500229212": "鸡鸣乡", "500229214": "周溪乡", "500229216": "明中乡", "500229217": "治平乡", "500229219": "岚天乡", "500229221": "河鱼乡" },
    "500230": { "500230": "名山街道", "50023011": "兴义镇", "50023012": "兴龙镇", "50023021": "三建乡", "500230101": "虎威镇", "500230102": "社坛镇", "500230103": "三元镇", "500230104": "许明寺镇", "500230105": "董家镇", "500230106": "树人镇", "500230107": "十直镇", "500230109": "高家镇", "500230111": "双路镇", "500230112": "江池镇", "500230113": "龙河镇", "500230114": "武平镇", "500230115": "包鸾镇", "500230116": "湛普镇", "500230118": "南天湖镇", "500230119": "保合镇", "500230121": "仁沙镇", "500230122": "龙孔镇", "500230123": "暨龙镇", "500230124": "双龙镇", "500230125": "仙女湖镇", "500230202": "青龙乡", "500230206": "太平坝乡", "500230207": "都督乡", "500230209": "栗子乡" },
    "500231": { "50023111": "太平镇", "50023112": "裴兴镇", "500231001": "桂溪街道", "500231002": "桂阳街道", "500231101": "新民镇", "500231102": "沙坪镇", "500231103": "周嘉镇", "500231104": "普顺镇", "500231105": "永安镇", "500231106": "高安镇", "500231107": "高峰镇", "500231108": "五洞镇", "500231109": "澄溪镇", "500231111": "鹤游镇", "500231112": "坪山镇", "500231113": "砚台镇", "500231114": "曹回镇", "500231115": "杠家镇", "500231116": "包家镇", "500231117": "白家镇", "500231118": "永平镇", "500231119": "三溪镇", "500231121": "黄沙镇", "500231122": "长龙镇", "500231202": "沙河乡", "500231204": "大石乡" },
    "500232": { "5002321": "巷口镇", "5002322": "凤来乡", "50023211": "土坎镇", "50023221": "后坪苗族土家族乡", "500232101": "火炉镇", "500232102": "白马镇", "500232103": "鸭江镇", "500232104": "长坝镇", "500232105": "江口镇", "500232106": "平桥镇", "500232107": "羊角镇", "500232108": "仙女山镇", "500232109": "桐梓镇", "500232111": "和顺镇", "500232112": "双河镇", "500232202": "庙垭乡", "500232203": "石桥苗族土家族乡", "500232205": "黄莺乡", "500232206": "沧沟乡", "500232207": "文复苗族土家族乡", "500232208": "土地乡", "500232209": "白云乡", "500232211": "浩口苗族仡佬族乡", "500232212": "接龙乡", "500232213": "赵家乡", "500232214": "大洞河乡" },
    "500233": { "50023311": "官坝镇", "50023312": "白石镇", "50023321": "兴峰乡", "500233001": "忠州街道", "500233002": "白公街道", "500233101": "新生镇", "500233102": "任家镇", "500233103": "乌杨镇", "500233104": "洋渡镇", "500233105": "东溪镇", "500233106": "复兴镇", "500233107": "石宝镇", "500233108": "汝溪镇", "500233109": "野鹤镇", "500233111": "石黄镇", "500233112": "马灌镇", "500233113": "金鸡镇", "500233114": "新立镇", "500233115": "双桂镇", "500233116": "拔山镇", "500233117": "花桥镇", "500233118": "永丰镇", "500233119": "三汇镇", "500233122": "黄金镇", "500233201": "善广乡", "500233203": "石子乡", "500233204": "磨子土家族乡", "500233206": "涂井乡", "500233208": "金声乡" },
    "500235": { "50023513": "桑坪镇", "50023514": "蔈草镇", "500235001": "双江街道", "500235002": "青龙街道", "500235003": "人和街道", "500235004": "盘龙街道", "500235105": "龙角镇", "500235107": "故陵镇", "500235108": "红狮镇", "500235115": "路阳镇", "500235116": "农坝镇", "500235118": "渠马镇", "500235121": "黄石镇", "500235122": "巴阳镇", "500235123": "沙市镇", "500235124": "鱼泉镇", "500235125": "凤鸣镇", "500235127": "宝坪镇", "500235128": "南溪镇", "500235129": "双土镇", "500235131": "江口镇", "500235132": "高阳镇", "500235133": "平安镇", "500235135": "云阳镇", "500235136": "云安镇", "500235137": "栖霞镇", "500235138": "双龙镇", "500235139": "泥溪镇", "500235141": "养鹿镇", "500235142": "水口镇", "500235143": "堰坪镇", "500235144": "龙洞镇", "500235145": "后叶镇", "500235146": "耀灵镇", "500235147": "大阳镇", "500235208": "外郎乡", "500235215": "新津乡", "500235216": "普安乡", "500235218": "洞鹿乡", "500235219": "石门乡", "500235239": "上坝乡", "500235242": "清水土家族自治乡" },
    "500236": { "50023612": "康乐镇", "50023613": "新民镇", "50023627": "康坪乡", "500236001": "永安街道", "500236002": "鱼复街道", "500236003": "夔门街道", "500236117": "白帝镇", "500236118": "草堂镇", "500236119": "汾河镇", "500236121": "大树镇", "500236122": "竹园镇", "500236123": "公平镇", "500236124": "朱衣镇", "500236125": "甲高镇", "500236126": "羊市镇", "500236127": "吐祥镇", "500236128": "兴隆镇", "500236129": "青龙镇", "500236131": "永乐镇", "500236132": "安坪镇", "500236133": "五马镇", "500236134": "青莲镇", "500236265": "岩湾乡", "500236266": "平安乡", "500236267": "红土乡", "500236269": "石岗乡", "500236272": "太和土家族乡", "500236274": "鹤峰乡", "500236275": "冯坪乡", "500236276": "长安土家族乡", "500236277": "龙桥土家族乡", "500236278": "云雾土家族乡" },
    "500237": { "5002372": "红椿乡", "50023711": "铜鼓镇", "50023721": "建坪乡", "500237001": "高唐街道", "500237002": "龙门街道", "500237101": "庙宇镇", "500237102": "大昌镇", "500237103": "福田镇", "500237104": "龙溪镇", "500237105": "双龙镇", "500237106": "官阳镇", "500237107": "骡坪镇", "500237108": "抱龙镇", "500237109": "官渡镇", "500237111": "巫峡镇", "500237207": "两坪乡", "500237208": "曲尺乡", "500237211": "大溪乡", "500237214": "金坪乡", "500237216": "平河乡", "500237219": "当阳乡", "500237222": "竹贤乡", "500237225": "三溪乡", "500237227": "培石乡", "500237229": "笃坪乡", "500237231": "邓家乡" },
    "500238": { "5002381": "城厢镇", "5002384": "红池坝经济开发区", "50023811": "峰灵镇", "50023821": "长桂乡", "50023824": "双阳乡", "500238001": "宁河街道", "500238002": "柏杨街道", "500238101": "凤凰镇", "500238102": "宁厂镇", "500238103": "上磺镇", "500238104": "古路镇", "500238105": "文峰镇", "500238106": "徐家镇", "500238107": "白鹿镇", "500238108": "尖山镇", "500238109": "下堡镇", "500238111": "塘坊镇", "500238112": "朝阳镇", "500238113": "田坝镇", "500238114": "通城镇", "500238115": "菱角镇", "500238116": "蒲莲镇", "500238117": "土城镇", "500238204": "胜利乡", "500238207": "大河乡", "500238208": "天星乡", "500238226": "鱼鳞乡", "500238227": "乌龙乡", "500238234": "中岗乡", "500238237": "花台乡", "500238239": "兰英乡", "500238242": "中梁乡", "500238243": "天元乡" },
    "500240": { "500240": "下路街道", "50024011": "龙沙镇", "50024021": "石家乡", "500240101": "西沱镇", "500240103": "悦崃镇", "500240104": "临溪镇", "500240105": "黄水镇", "500240106": "马武镇", "500240107": "沙子镇", "500240108": "王场镇", "500240109": "沿溪镇", "500240111": "鱼池镇", "500240112": "三河镇", "500240113": "大歇镇", "500240114": "桥头镇", "500240115": "万朝镇", "500240116": "冷水镇", "500240117": "黄鹤镇", "500240203": "黎场乡", "500240204": "三星乡", "500240205": "六塘乡", "500240207": "三益乡", "500240208": "王家乡", "500240209": "河嘴乡", "500240212": "枫木乡", "500240213": "中益乡", "500240214": "洗新乡", "500240216": "龙潭乡", "500240217": "新乐乡", "500240218": "金铃乡", "500240219": "金竹乡" },
    "500241": { "50024111": "雅江镇", "500241001": "中和街道", "500241002": "乌杨街道", "500241003": "平凯街道", "500241102": "清溪场镇", "500241103": "隘口镇", "500241104": "溶溪镇", "500241105": "官庄镇", "500241106": "龙池镇", "500241107": "石堤镇", "500241108": "峨溶镇", "500241109": "洪安镇", "500241111": "石耶镇", "500241112": "梅江镇", "500241113": "兰桥镇", "500241114": "膏田镇", "500241115": "溪口镇", "500241116": "妙泉镇", "500241117": "宋农镇", "500241118": "里仁镇", "500241119": "钟灵镇", "500241201": "孝溪乡", "500241207": "海洋乡", "500241208": "大溪乡", "500241211": "涌洞乡", "500241214": "中平乡", "500241215": "岑溪乡" },
    "500242": { "5002422": "涂市乡", "50024211": "泔溪镇", "50024221": "后坪乡", "50024222": "清泉乡", "500242001": "桃花源街道", "500242002": "钟多街道", "500242101": "龙潭镇", "500242102": "麻旺镇", "500242103": "酉酬镇", "500242104": "大溪镇", "500242105": "兴隆镇", "500242106": "黑水镇", "500242107": "丁市镇", "500242108": "龚滩镇", "500242109": "李溪镇", "500242111": "酉水河镇", "500242112": "苍岭镇", "500242113": "小河镇", "500242114": "板溪镇", "500242202": "铜鼓乡", "500242204": "可大乡", "500242205": "偏柏乡", "500242206": "五福乡", "500242207": "木叶乡", "500242208": "毛坝乡", "500242209": "花田乡", "500242211": "天馆乡", "500242212": "宜居乡", "500242213": "万木乡", "500242214": "两罾乡", "500242215": "板桥乡", "500242216": "官清乡", "500242217": "南腰界乡", "500242218": "车田乡", "500242219": "腴地乡", "500242221": "庙溪乡", "500242222": "浪坪乡", "500242223": "双泉乡", "500242224": "楠木乡" },
    "500243": { "50024311": "万足镇", "50024321": "走马乡", "500243001": "汉葭街道", "500243002": "绍庆街道", "500243003": "靛水街道", "500243101": "保家镇", "500243102": "郁山镇", "500243103": "高谷镇", "500243104": "桑柘镇", "500243105": "鹿角镇", "500243106": "黄家镇", "500243107": "普子镇", "500243108": "龙射镇", "500243109": "连湖镇", "500243111": "平安镇", "500243112": "长生镇", "500243113": "新田镇", "500243114": "鞍子镇", "500243115": "太原镇", "500243116": "龙溪镇", "500243117": "梅子垭镇", "500243118": "大同镇", "500243201": "岩东乡", "500243202": "鹿鸣乡", "500243204": "棣棠乡", "500243206": "三义乡", "500243207": "联合乡", "500243208": "石柳乡", "500243211": "芦塘乡", "500243213": "乔梓乡", "500243217": "诸佛乡", "500243219": "桐楼乡", "500243222": "善感乡", "500243223": "双龙乡", "500243224": "石盘乡", "500243225": "大垭乡", "500243226": "润溪乡", "500243227": "朗溪乡", "500243228": "龙塘乡" },
    "510000": { "510100": "成都市", "510300": "自贡市", "510400": "攀枝花市", "510500": "泸州市", "510600": "德阳市", "510700": "绵阳市", "510800": "广元市", "510900": "遂宁市", "511000": "内江市", "511100": "乐山市", "511300": "南充市", "511400": "眉山市", "511500": "宜宾市", "511600": "广安市", "511700": "达州市", "511800": "雅安市", "511900": "巴中市", "512000": "资阳市", "513200": "阿坝藏族羌族自治州", "513300": "甘孜藏族自治州", "513400": "凉山彝族自治州" },
    "510100": { "510104": "锦江区", "510105": "青羊区", "510106": "金牛区", "510107": "武侯区", "510108": "成华区", "510112": "龙泉驿区", "510113": "青白江区", "510114": "新都区", "510115": "温江区", "510116": "双流区", "510121": "金堂县", "510124": "郫县", "510129": "大邑县", "510131": "蒲江县", "510132": "新津县", "510181": "都江堰市", "510182": "彭州市", "510183": "邛崃市", "510184": "崇州市", "510185": "简阳市" },
    "510300": { "510302": "自流井区", "510303": "贡井区", "510304": "大安区", "510311": "沿滩区", "510321": "荣县", "510322": "富顺县" },
    "510400": { "510402": "东区", "510403": "西区", "510411": "仁和区", "510421": "米易县", "510422": "盐边县" },
    "510500": { "510502": "江阳区", "510503": "纳溪区", "510504": "龙马潭区", "510521": "泸县", "510522": "合江县", "510524": "叙永县", "510525": "古蔺县" },
    "510600": { "510603": "旌阳区", "510623": "中江县", "510626": "罗江县", "510681": "广汉市", "510682": "什邡市", "510683": "绵竹市" },
    "510700": { "510703": "涪城区", "510704": "游仙区", "510705": "安州区", "510722": "三台县", "510723": "盐亭县", "510725": "梓潼县", "510726": "北川羌族自治县", "510727": "平武县", "510781": "江油市" },
    "510800": { "510802": "利州区", "510811": "昭化区", "510812": "朝天区", "510821": "旺苍县", "510822": "青川县", "510823": "剑阁县", "510824": "苍溪县" },
    "510900": { "510903": "船山区", "510904": "安居区", "510921": "蓬溪县", "510922": "射洪县", "510923": "大英县" },
    "511000": { "511002": "市中区", "511011": "东兴区", "511024": "威远县", "511025": "资中县", "511028": "隆昌县" },
    "511100": { "511102": "市中区", "511111": "沙湾区", "511112": "五通桥区", "511113": "金口河区", "511123": "犍为县", "511124": "井研县", "511126": "夹江县", "511129": "沐川县", "511132": "峨边彝族自治县", "511133": "马边彝族自治县", "511181": "峨眉山市" },
    "511300": { "511302": "顺庆区", "511303": "高坪区", "511304": "嘉陵区", "511321": "南部县", "511322": "营山县", "511323": "蓬安县", "511324": "仪陇县", "511325": "西充县", "511381": "阆中市" },
    "511400": { "511402": "东坡区", "511403": "彭山区", "511421": "仁寿县", "511423": "洪雅县", "511424": "丹棱县", "511425": "青神县" },
    "511500": { "511502": "翠屏区", "511503": "南溪区", "511521": "宜宾县", "511523": "江安县", "511524": "长宁县", "511525": "高县", "511526": "珙县", "511527": "筠连县", "511528": "兴文县", "511529": "屏山县" },
    "511600": { "511602": "广安区", "511603": "前锋区", "511621": "岳池县", "511622": "武胜县", "511623": "邻水县", "511681": "华蓥市" },
    "511700": { "511702": "通川区", "511703": "达川区", "511722": "宣汉县", "511723": "开江县", "511724": "大竹县", "511725": "渠县", "511781": "万源市" },
    "511800": { "511802": "雨城区", "511803": "名山区", "511822": "荥经县", "511823": "汉源县", "511824": "石棉县", "511825": "天全县", "511826": "芦山县", "511827": "宝兴县" },
    "511900": { "511902": "巴州区", "511903": "恩阳区", "511921": "通江县", "511922": "南江县", "511923": "平昌县" },
    "512000": { "512002": "雁江区", "512021": "安岳县", "512022": "乐至县" },
    "513200": { "513201": "马尔康市", "513221": "汶川县", "513222": "理县", "513223": "茂县", "513224": "松潘县", "513225": "九寨沟县", "513226": "金川县", "513227": "小金县", "513228": "黑水县", "513230": "壤塘县", "513231": "阿坝县", "513232": "若尔盖县", "513233": "红原县" },
    "513300": { "513301": "康定市", "513322": "泸定县", "513323": "丹巴县", "513324": "九龙县", "513325": "雅江县", "513326": "道孚县", "513327": "炉霍县", "513328": "甘孜县", "513329": "新龙县", "513330": "德格县", "513331": "白玉县", "513332": "石渠县", "513333": "色达县", "513334": "理塘县", "513335": "巴塘县", "513336": "乡城县", "513337": "稻城县", "513338": "得荣县" },
    "513400": { "513401": "西昌市", "513422": "木里藏族自治县", "513423": "盐源县", "513424": "德昌县", "513425": "会理县", "513426": "会东县", "513427": "宁南县", "513428": "普格县", "513429": "布拖县", "513430": "金阳县", "513431": "昭觉县", "513432": "喜德县", "513433": "冕宁县", "513434": "越西县", "513435": "甘洛县", "513436": "美姑县", "513437": "雷波县" },
    "520000": { "520100": "贵阳市", "520200": "六盘水市", "520300": "遵义市", "520400": "安顺市", "520500": "毕节市", "520600": "铜仁市", "522300": "黔西南布依族苗族自治州", "522600": "黔东南苗族侗族自治州", "522700": "黔南布依族苗族自治州" },
    "520100": { "520102": "南明区", "520103": "云岩区", "520111": "花溪区", "520112": "乌当区", "520113": "白云区", "520115": "观山湖区", "520121": "开阳县", "520122": "息烽县", "520123": "修文县", "520181": "清镇市" },
    "520200": { "520201": "钟山区", "520203": "六枝特区", "520221": "水城县", "520222": "盘县" },
    "520300": { "520302": "红花岗区", "520303": "汇川区", "520304": "播州区", "520322": "桐梓县", "520323": "绥阳县", "520324": "正安县", "520325": "道真仡佬族苗族自治县", "520326": "务川仡佬族苗族自治县", "520327": "凤冈县", "520328": "湄潭县", "520329": "余庆县", "520330": "习水县", "520381": "赤水市", "520382": "仁怀市" },
    "520400": { "520402": "西秀区", "520403": "平坝区", "520422": "普定县", "520423": "镇宁布依族苗族自治县", "520424": "关岭布依族苗族自治县", "520425": "紫云苗族布依族自治县" },
    "520500": { "520502": "七星关区", "520521": "大方县", "520522": "黔西县", "520523": "金沙县", "520524": "织金县", "520525": "纳雍县", "520526": "威宁彝族回族苗族自治县", "520527": "赫章县" },
    "520600": { "520602": "碧江区", "520603": "万山区", "520621": "江口县", "520622": "玉屏侗族自治县", "520623": "石阡县", "520624": "思南县", "520625": "印江土家族苗族自治县", "520626": "德江县", "520627": "沿河土家族自治县", "520628": "松桃苗族自治县" },
    "522300": { "522301": "兴义市", "522322": "兴仁县", "522323": "普安县", "522324": "晴隆县", "522325": "贞丰县", "522326": "望谟县", "522327": "册亨县", "522328": "安龙县" },
    "522600": { "522601": "凯里市", "522622": "黄平县", "522623": "施秉县", "522624": "三穗县", "522625": "镇远县", "522626": "岑巩县", "522627": "天柱县", "522628": "锦屏县", "522629": "剑河县", "522630": "台江县", "522631": "黎平县", "522632": "榕江县", "522633": "从江县", "522634": "雷山县", "522635": "麻江县", "522636": "丹寨县" },
    "522700": { "522701": "都匀市", "522702": "福泉市", "522722": "荔波县", "522723": "贵定县", "522725": "瓮安县", "522726": "独山县", "522727": "平塘县", "522728": "罗甸县", "522729": "长顺县", "522730": "龙里县", "522731": "惠水县", "522732": "三都水族自治县" },
    "530000": { "530100": "昆明市", "530300": "曲靖市", "530400": "玉溪市", "530500": "保山市", "530600": "昭通市", "530700": "丽江市", "530800": "普洱市", "530900": "临沧市", "532300": "楚雄彝族自治州", "532500": "红河哈尼族彝族自治州", "532600": "文山壮族苗族自治州", "532800": "西双版纳傣族自治州", "532900": "大理白族自治州", "533100": "德宏傣族景颇族自治州", "533300": "怒江傈僳族自治州", "533400": "迪庆藏族自治州" },
    "530100": { "530102": "五华区", "530103": "盘龙区", "530111": "官渡区", "530112": "西山区", "530113": "东川区", "530114": "呈贡区", "530122": "晋宁县", "530124": "富民县", "530125": "宜良县", "530126": "石林彝族自治县", "530127": "嵩明县", "530128": "禄劝彝族苗族自治县", "530129": "寻甸回族彝族自治县", "530181": "安宁市" },
    "530300": { "530302": "麒麟区", "530303": "沾益区", "530321": "马龙县", "530322": "陆良县", "530323": "师宗县", "530324": "罗平县", "530325": "富源县", "530326": "会泽县", "530381": "宣威市" },
    "530400": { "530402": "红塔区", "530403": "江川区", "530422": "澄江县", "530423": "通海县", "530424": "华宁县", "530425": "易门县", "530426": "峨山彝族自治县", "530427": "新平彝族傣族自治县", "530428": "元江哈尼族彝族傣族自治县" },
    "530500": { "530502": "隆阳区", "530521": "施甸县", "530523": "龙陵县", "530524": "昌宁县", "530581": "腾冲市" },
    "530600": { "530602": "昭阳区", "530621": "鲁甸县", "530622": "巧家县", "530623": "盐津县", "530624": "大关县", "530625": "永善县", "530626": "绥江县", "530627": "镇雄县", "530628": "彝良县", "530629": "威信县", "530630": "水富县" },
    "530700": { "530702": "古城区", "530721": "玉龙纳西族自治县", "530722": "永胜县", "530723": "华坪县", "530724": "宁蒗彝族自治县" },
    "530800": { "530802": "思茅区", "530821": "宁洱哈尼族彝族自治县", "530822": "墨江哈尼族自治县", "530823": "景东彝族自治县", "530824": "景谷傣族彝族自治县", "530825": "镇沅彝族哈尼族拉祜族自治县", "530826": "江城哈尼族彝族自治县", "530827": "孟连傣族拉祜族佤族自治县", "530828": "澜沧拉祜族自治县", "530829": "西盟佤族自治县" },
    "530900": { "530902": "临翔区", "530921": "凤庆县", "530922": "云县", "530923": "永德县", "530924": "镇康县", "530925": "双江拉祜族佤族布朗族傣族自治县", "530926": "耿马傣族佤族自治县", "530927": "沧源佤族自治县" },
    "532300": { "532301": "楚雄市", "532322": "双柏县", "532323": "牟定县", "532324": "南华县", "532325": "姚安县", "532326": "大姚县", "532327": "永仁县", "532328": "元谋县", "532329": "武定县", "532331": "禄丰县" },
    "532500": { "532501": "个旧市", "532502": "开远市", "532503": "蒙自市", "532504": "弥勒市", "532523": "屏边苗族自治县", "532524": "建水县", "532525": "石屏县", "532527": "泸西县", "532528": "元阳县", "532529": "红河县", "532530": "金平苗族瑶族傣族自治县", "532531": "绿春县", "532532": "河口瑶族自治县" },
    "532600": { "532601": "文山市", "532622": "砚山县", "532623": "西畴县", "532624": "麻栗坡县", "532625": "马关县", "532626": "丘北县", "532627": "广南县", "532628": "富宁县" },
    "532800": { "532801": "景洪市", "532822": "勐海县", "532823": "勐腊县" },
    "532900": { "532901": "大理市", "532922": "漾濞彝族自治县", "532923": "祥云县", "532924": "宾川县", "532925": "弥渡县", "532926": "南涧彝族自治县", "532927": "巍山彝族回族自治县", "532928": "永平县", "532929": "云龙县", "532930": "洱源县", "532931": "剑川县", "532932": "鹤庆县" },
    "533100": { "533102": "瑞丽市", "533103": "芒市", "533122": "梁河县", "533123": "盈江县", "533124": "陇川县" },
    "533300": { "533301": "泸水市", "533323": "福贡县", "533324": "贡山独龙族怒族自治县", "533325": "兰坪白族普米族自治县" },
    "533400": { "533401": "香格里拉市", "533422": "德钦县", "533423": "维西傈僳族自治县" },
    "540000": { "540100": "拉萨市", "540200": "日喀则市", "540300": "昌都市", "540400": "林芝市", "540500": "山南市", "542400": "那曲地区", "542500": "阿里地区" },
    "540100": { "540102": "城关区", "540103": "堆龙德庆区", "540121": "林周县", "540122": "当雄县", "540123": "尼木县", "540124": "曲水县", "540126": "达孜县", "540127": "墨竹工卡县" },
    "540200": { "540202": "桑珠孜区", "540221": "南木林县", "540222": "江孜县", "540223": "定日县", "540224": "萨迦县", "540225": "拉孜县", "540226": "昂仁县", "540227": "谢通门县", "540228": "白朗县", "540229": "仁布县", "540230": "康马县", "540231": "定结县", "540232": "仲巴县", "540233": "亚东县", "540234": "吉隆县", "540235": "聂拉木县", "540236": "萨嘎县", "540237": "岗巴县" },
    "540300": { "540302": "卡若区", "540321": "江达县", "540322": "贡觉县", "540323": "类乌齐县", "540324": "丁青县", "540325": "察雅县", "540326": "八宿县", "540327": "左贡县", "540328": "芒康县", "540329": "洛隆县", "540330": "边坝县" },
    "540400": { "540402": "巴宜区", "540421": "工布江达县", "540422": "米林县", "540423": "墨脱县", "540424": "波密县", "540425": "察隅县", "540426": "朗县" },
    "540500": { "540502": "乃东区", "540521": "扎囊县", "540522": "贡嘎县", "540523": "桑日县", "540524": "琼结县", "540525": "曲松县", "540526": "措美县", "540527": "洛扎县", "540528": "加查县", "540529": "隆子县", "540530": "错那县", "540531": "浪卡子县" },
    "542400": { "542421": "那曲县", "542422": "嘉黎县", "542423": "比如县", "542424": "聂荣县", "542425": "安多县", "542426": "申扎县", "542427": "索县", "542428": "班戈县", "542429": "巴青县", "542430": "尼玛县", "542431": "双湖县" },
    "542500": { "542521": "普兰县", "542522": "札达县", "542523": "噶尔县", "542524": "日土县", "542525": "革吉县", "542526": "改则县", "542527": "措勤县" },
    "610000": { "610100": "西安市", "610200": "铜川市", "610300": "宝鸡市", "610400": "咸阳市", "610500": "渭南市", "610600": "延安市", "610700": "汉中市", "610800": "榆林市", "610900": "安康市", "611000": "商洛市" },
    "610100": { "610102": "新城区", "610103": "碑林区", "610104": "莲湖区", "610111": "灞桥区", "610112": "未央区", "610113": "雁塔区", "610114": "阎良区", "610115": "临潼区", "610116": "长安区", "610117": "高陵区", "610122": "蓝田县", "610124": "周至县", "610125": "户县" },
    "610200": { "610202": "王益区", "610203": "印台区", "610204": "耀州区", "610222": "宜君县" },
    "610300": { "610302": "渭滨区", "610303": "金台区", "610304": "陈仓区", "610322": "凤翔县", "610323": "岐山县", "610324": "扶风县", "610326": "眉县", "610327": "陇县", "610328": "千阳县", "610329": "麟游县", "610330": "凤县", "610331": "太白县" },
    "610400": { "610402": "秦都区", "610403": "杨陵区", "610404": "渭城区", "610422": "三原县", "610423": "泾阳县", "610424": "乾县", "610425": "礼泉县", "610426": "永寿县", "610427": "彬县", "610428": "长武县", "610429": "旬邑县", "610430": "淳化县", "610431": "武功县", "610481": "兴平市" },
    "610500": { "610502": "临渭区", "610503": "华州区", "610522": "潼关县", "610523": "大荔县", "610524": "合阳县", "610525": "澄城县", "610526": "蒲城县", "610527": "白水县", "610528": "富平县", "610581": "韩城市", "610582": "华阴市" },
    "610600": { "610602": "宝塔区", "610603": "安塞区", "610621": "延长县", "610622": "延川县", "610623": "子长县", "610625": "志丹县", "610626": "吴起县", "610627": "甘泉县", "610628": "富县", "610629": "洛川县", "610630": "宜川县", "610631": "黄龙县", "610632": "黄陵县" },
    "610700": { "610702": "汉台区", "610721": "南郑县", "610722": "城固县", "610723": "洋县", "610724": "西乡县", "610725": "勉县", "610726": "宁强县", "610727": "略阳县", "610728": "镇巴县", "610729": "留坝县", "610730": "佛坪县" },
    "610800": { "610802": "榆阳区", "610803": "横山区", "610821": "神木县", "610822": "府谷县", "610824": "靖边县", "610825": "定边县", "610826": "绥德县", "610827": "米脂县", "610828": "佳县", "610829": "吴堡县", "610830": "清涧县", "610831": "子洲县" },
    "610900": { "610902": "汉滨区", "610921": "汉阴县", "610922": "石泉县", "610923": "宁陕县", "610924": "紫阳县", "610925": "岚皋县", "610926": "平利县", "610927": "镇坪县", "610928": "旬阳县", "610929": "白河县" },
    "611000": { "611002": "商州区", "611021": "洛南县", "611022": "丹凤县", "611023": "商南县", "611024": "山阳县", "611025": "镇安县", "611026": "柞水县" },
    "620000": { "620100": "兰州市", "620200": "嘉峪关市", "620300": "金昌市", "620400": "白银市", "620500": "天水市", "620600": "武威市", "620700": "张掖市", "620800": "平凉市", "620900": "酒泉市", "621000": "庆阳市", "621100": "定西市", "621200": "陇南市", "622900": "临夏回族自治州", "623000": "甘南藏族自治州" },
    "620100": { "620102": "城关区", "620103": "七里河区", "620104": "西固区", "620105": "安宁区", "620111": "红古区", "620121": "永登县", "620122": "皋兰县", "620123": "榆中县" },
    "620300": { "620302": "金川区", "620321": "永昌县" },
    "620400": { "620402": "白银区", "620403": "平川区", "620421": "靖远县", "620422": "会宁县", "620423": "景泰县" },
    "620500": { "620502": "秦州区", "620503": "麦积区", "620521": "清水县", "620522": "秦安县", "620523": "甘谷县", "620524": "武山县", "620525": "张家川回族自治县" },
    "620600": { "620602": "凉州区", "620621": "民勤县", "620622": "古浪县", "620623": "天祝藏族自治县" },
    "620700": { "620702": "甘州区", "620721": "肃南裕固族自治县", "620722": "民乐县", "620723": "临泽县", "620724": "高台县", "620725": "山丹县" },
    "620800": { "620802": "崆峒区", "620821": "泾川县", "620822": "灵台县", "620823": "崇信县", "620824": "华亭县", "620825": "庄浪县", "620826": "静宁县" },
    "620900": { "620902": "肃州区", "620921": "金塔县", "620922": "瓜州县", "620923": "肃北蒙古族自治县", "620924": "阿克塞哈萨克族自治县", "620981": "玉门市", "620982": "敦煌市" },
    "621000": { "621002": "西峰区", "621021": "庆城县", "621022": "环县", "621023": "华池县", "621024": "合水县", "621025": "正宁县", "621026": "宁县", "621027": "镇原县" },
    "621100": { "621102": "安定区", "621121": "通渭县", "621122": "陇西县", "621123": "渭源县", "621124": "临洮县", "621125": "漳县", "621126": "岷县" },
    "621200": { "621202": "武都区", "621221": "成县", "621222": "文县", "621223": "宕昌县", "621224": "康县", "621225": "西和县", "621226": "礼县", "621227": "徽县", "621228": "两当县" },
    "622900": { "622901": "临夏市", "622921": "临夏县", "622922": "康乐县", "622923": "永靖县", "622924": "广河县", "622925": "和政县", "622926": "东乡族自治县", "622927": "积石山保安族东乡族撒拉族自治县" },
    "623000": { "623001": "合作市", "623021": "临潭县", "623022": "卓尼县", "623023": "舟曲县", "623024": "迭部县", "623025": "玛曲县", "623026": "碌曲县", "623027": "夏河县" },
    "630000": { "630100": "西宁市", "630200": "海东市", "632200": "海北藏族自治州", "632300": "黄南藏族自治州", "632500": "海南藏族自治州", "632600": "果洛藏族自治州", "632700": "玉树藏族自治州", "632800": "海西蒙古族藏族自治州" },
    "630100": { "630102": "城东区", "630103": "城中区", "630104": "城西区", "630105": "城北区", "630121": "大通回族土族自治县", "630122": "湟中县", "630123": "湟源县" },
    "630200": { "630202": "乐都区", "630203": "平安区", "630222": "民和回族土族自治县", "630223": "互助土族自治县", "630224": "化隆回族自治县", "630225": "循化撒拉族自治县" },
    "632200": { "632221": "门源回族自治县", "632222": "祁连县", "632223": "海晏县", "632224": "刚察县" },
    "632300": { "632321": "同仁县", "632322": "尖扎县", "632323": "泽库县", "632324": "河南蒙古族自治县" },
    "632500": { "632521": "共和县", "632522": "同德县", "632523": "贵德县", "632524": "兴海县", "632525": "贵南县" },
    "632600": { "632621": "玛沁县", "632622": "班玛县", "632623": "甘德县", "632624": "达日县", "632625": "久治县", "632626": "玛多县" },
    "632700": { "632701": "玉树市", "632722": "杂多县", "632723": "称多县", "632724": "治多县", "632725": "囊谦县", "632726": "曲麻莱县" },
    "632800": { "632801": "格尔木市", "632802": "德令哈市", "632821": "乌兰县", "632822": "都兰县", "632823": "天峻县" },
    "640000": { "640100": "银川市", "640200": "石嘴山市", "640300": "吴忠市", "640400": "固原市", "640500": "中卫市" },
    "640100": { "640104": "兴庆区", "640105": "西夏区", "640106": "金凤区", "640121": "永宁县", "640122": "贺兰县", "640181": "灵武市" },
    "640200": { "640202": "大武口区", "640205": "惠农区", "640221": "平罗县" },
    "640300": { "640302": "利通区", "640303": "红寺堡区", "640323": "盐池县", "640324": "同心县", "640381": "青铜峡市" },
    "640400": { "640402": "原州区", "640422": "西吉县", "640423": "隆德县", "640424": "泾源县", "640425": "彭阳县" },
    "640500": { "640502": "沙坡头区", "640521": "中宁县", "640522": "海原县" },
    "650000": { "650100": "乌鲁木齐市", "650200": "克拉玛依市", "650400": "吐鲁番市", "650500": "哈密市", "652300": "昌吉回族自治州", "652700": "博尔塔拉蒙古自治州", "652800": "巴音郭楞蒙古自治州", "652900": "阿克苏地区", "653000": "克孜勒苏柯尔克孜自治州", "653100": "喀什地区", "653200": "和田地区", "654000": "伊犁哈萨克自治州", "654200": "塔城地区", "654300": "阿勒泰地区", "659001": "石河子市", "659002": "阿拉尔市", "659003": "图木舒克市", "659004": "五家渠市", "659006": "铁门关市" },
    "650100": { "650102": "天山区", "650103": "沙依巴克区", "650104": "新市区", "650105": "水磨沟区", "650106": "头屯河区", "650107": "达坂城区", "650109": "米东区", "650121": "乌鲁木齐县" },
    "650200": { "650202": "独山子区", "650203": "克拉玛依区", "650204": "白碱滩区", "650205": "乌尔禾区" },
    "650400": { "650402": "高昌区", "650421": "鄯善县", "650422": "托克逊县" },
    "650500": { "650502": "伊州区", "650521": "巴里坤哈萨克自治县", "650522": "伊吾县" },
    "652300": { "652301": "昌吉市", "652302": "阜康市", "652323": "呼图壁县", "652324": "玛纳斯县", "652325": "奇台县", "652327": "吉木萨尔县", "652328": "木垒哈萨克自治县" },
    "652700": { "652701": "博乐市", "652702": "阿拉山口市", "652722": "精河县", "652723": "温泉县" },
    "652800": { "652801": "库尔勒市", "652822": "轮台县", "652823": "尉犁县", "652824": "若羌县", "652825": "且末县", "652826": "焉耆回族自治县", "652827": "和静县", "652828": "和硕县", "652829": "博湖县" },
    "652900": { "652901": "阿克苏市", "652922": "温宿县", "652923": "库车县", "652924": "沙雅县", "652925": "新和县", "652926": "拜城县", "652927": "乌什县", "652928": "阿瓦提县", "652929": "柯坪县" },
    "653000": { "653001": "阿图什市", "653022": "阿克陶县", "653023": "阿合奇县", "653024": "乌恰县" },
    "653100": { "653101": "喀什市", "653121": "疏附县", "653122": "疏勒县", "653123": "英吉沙县", "653124": "泽普县", "653125": "莎车县", "653126": "叶城县", "653127": "麦盖提县", "653128": "岳普湖县", "653129": "伽师县", "653130": "巴楚县", "653131": "塔什库尔干塔吉克自治县" },
    "653200": { "653201": "和田市", "653221": "和田县", "653222": "墨玉县", "653223": "皮山县", "653224": "洛浦县", "653225": "策勒县", "653226": "于田县", "653227": "民丰县" },
    "654000": { "654002": "伊宁市", "654003": "奎屯市", "654004": "霍尔果斯市", "654021": "伊宁县", "654022": "察布查尔锡伯自治县", "654023": "霍城县", "654024": "巩留县", "654025": "新源县", "654026": "昭苏县", "654027": "特克斯县", "654028": "尼勒克县" },
    "654200": { "654201": "塔城市", "654202": "乌苏市", "654221": "额敏县", "654223": "沙湾县", "654224": "托里县", "654225": "裕民县", "654226": "和布克赛尔蒙古自治县" },
    "654300": { "654301": "阿勒泰市", "654321": "布尔津县", "654322": "富蕴县", "654323": "福海县", "654324": "哈巴河县", "654325": "青河县", "654326": "吉木乃县" },
    "659001": { "6590011": "北泉镇", "6590015": "兵团一五二团", "659001001": "新城街道", "659001002": "向阳街道", "659001003": "红山街道", "659001004": "老街街道", "659001005": "东城街道", "659001101": "石河子镇" },
    "659002": { "6590022": "托喀依乡", "6590025": "兵团七团", "65900252": "兵团三团", "659002001": "金银川路街道", "659002002": "幸福路街道", "659002003": "青松路街道", "659002004": "南口街道", "659002402": "工业园区", "659002501": "兵团八团", "659002503": "兵团十团", "659002504": "兵团十一团", "659002505": "兵团十二团", "659002506": "兵团十三团", "659002507": "兵团十四团", "659002509": "兵团十六团", "659002511": "兵团第一师水利水电工程处", "659002512": "兵团第一师塔里木灌区水利管理处", "659002513": "阿拉尔农场", "659002514": "兵团第一师幸福农场", "659002515": "中心监狱", "659002516": "兵团一团", "659002517": "兵团农一师沙井子水利管理处", "659002518": "西工业园区管理委员会", "659002519": "兵团二团" },
    "659003": { "65900351": "兵团五十团", "659003001": "齐干却勒街道", "659003002": "前海街道", "659003003": "永安坝街道", "659003504": "兵团四十四团", "659003509": "兵团四十九团", "659003511": "兵团五十一团", "659003513": "兵团五十三团", "659003514": "兵团图木舒克市喀拉拜勒镇" },
    "659004": { "6590045": "兵团一零一团", "659004001": "军垦路街道", "659004002": "青湖路街道", "659004003": "人民路街道", "659004501": "兵团一零二团", "659004502": "兵团一零三团" },
    "659006": { "6590061": "博古其镇", "659006101": "双丰镇" },
    "710000": { "710100": "台湾省" },
    "710100": { "710101": "金门", "710102": "连江", "710103": "苗栗", "710104": "南投", "710105": "澎湖", "710106": "屏东", "710107": "台东", "710108": "台中", "710109": "台南", "710110": "台北", "710111": "桃园", "710112": "云林", "710113": "新北", "710114": "彰化", "710115": "嘉义", "710116": "新竹", "710117": "花莲", "710118": "宜兰", "710119": "高雄", "710120": "基隆" },
    "810000": { "810101": "中西区", "810102": "东区", "810103": "九龙城区", "810104": "观塘区", "810105": "深水埗区", "810106": "湾仔区", "810107": "黄大仙区", "810108": "油尖旺区", "810109": "离岛区", "810110": "葵青区", "810111": "北区", "810112": "西贡区", "810113": "沙田区", "810114": "屯门区", "810115": "大埔区", "810116": "荃湾区", "810117": "元朗区", "810118": "香港", "810119": "九龙", "810120": "新界" },
    "820000": { "820101": "离岛", "820102": "澳门半岛", "820103": "凼仔", "820104": "路凼城", "820105": "路环" },
    "910000": { "810000": "香港特别行政区", "820000": "澳门特别行政区" }
  };

  // src/core/region-names.js
  var SUFFIXES = [
    "特别行政区",
    "自治区",
    "自治州",
    "自治县",
    "自治旗",
    "维吾尔",
    "壮族",
    "回族",
    "藏族",
    "蒙古族",
    "土家族",
    "苗族",
    "侗族",
    "布依族",
    "彝族",
    "白族",
    "傣族",
    "哈尼族",
    "朝鲜族",
    "满族",
    "哈萨克",
    "地区",
    "省",
    "市",
    "区",
    "县",
    "盟",
    "旗"
  ].map((s) => norm(s));
  function normalizeRegion(name) {
    let text = norm(name);
    if (!text) return "";
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < SUFFIXES.length; i += 1) {
        const suffix = SUFFIXES[i];
        if (suffix && text.length > suffix.length && text.endsWith(suffix)) {
          text = text.slice(0, -suffix.length);
          changed = true;
          break;
        }
      }
    }
    return text;
  }
  var PROVINCE_ALIASES = /* @__PURE__ */ new Map();
  var CITY_ALIASES = /* @__PURE__ */ new Map();
  var DISTRICT_ALIASES = /* @__PURE__ */ new Map();
  function addAlias(map, full) {
    if (!full) return;
    map.set(full, full);
    const short = normalizeRegion(full);
    if (short && !map.has(short)) map.set(short, full);
  }
  function provinceAliases() {
    return PROVINCE_ALIASES;
  }
  function cityAliases() {
    return CITY_ALIASES;
  }
  function districtAliases() {
    return DISTRICT_ALIASES;
  }
  var PROVINCE_NAMES = /* @__PURE__ */ new Set();
  var CITY_NAMES = /* @__PURE__ */ new Set();
  var DISTRICT_NAMES = /* @__PURE__ */ new Set();
  (function buildRegionNames() {
    const provinces = REGIONS["86"] || {};
    Object.keys(provinces).forEach((provinceCode) => {
      PROVINCE_NAMES.add(normalizeRegion(provinces[provinceCode]));
      addAlias(PROVINCE_ALIASES, provinces[provinceCode]);
      const cities = REGIONS[provinceCode] || {};
      Object.keys(cities).forEach((cityCode) => {
        CITY_NAMES.add(normalizeRegion(cities[cityCode]));
        addAlias(CITY_ALIASES, cities[cityCode]);
        const districts = REGIONS[cityCode] || {};
        Object.keys(districts).forEach((areaCode) => {
          DISTRICT_NAMES.add(normalizeRegion(districts[areaCode]));
          addAlias(DISTRICT_ALIASES, districts[areaCode]);
        });
      });
    });
  })();
  function regionLevelOf(node) {
    if (!node || node.tagName !== "SELECT" || !node.options) return "";
    const texts = [];
    for (let i = 0; i < node.options.length; i += 1) {
      const t = normalizeRegion(node.options[i].textContent);
      if (t) texts.push(t);
    }
    if (texts.length < 2) return "";
    let province = 0;
    let city = 0;
    let district = 0;
    texts.forEach((t) => {
      if (PROVINCE_NAMES.has(t)) province += 1;
      if (CITY_NAMES.has(t)) city += 1;
      if (DISTRICT_NAMES.has(t)) district += 1;
    });
    const best = Math.max(province, city, district);
    if (best < 2) return "";
    if (best === province) return "province";
    if (best === city) return "city";
    return "district";
  }

  // src/core/address.js
  var PROVINCE_RE = /^(北京市|上海市|天津市|重庆市|.{2,10}?(?:省|自治区|特别行政区))/;
  var CITY_RE = /^(.{2,10}?(?:市|自治州|地区|盟))/;
  var AREA_RE = /^(.{1,12}?(?:自治县|自治旗|区|县|旗|市))/;
  function levelCandidates(text, aliases) {
    const out = [];
    const limit = Math.min(text.length, 12);
    for (let len = limit; len >= 2; len -= 1) {
      const full = aliases.get(text.slice(0, len));
      if (full) out.push({ full, length: len });
    }
    return out;
  }
  function splitByPattern(text) {
    const out = { province: "", city: "", district: "", detail: "" };
    let rest = text;
    const m1 = rest.match(PROVINCE_RE);
    if (m1) {
      out.province = m1[1];
      rest = rest.slice(m1[1].length).trim();
    }
    const m2 = rest.match(CITY_RE);
    if (m2) {
      out.city = m2[1];
      rest = rest.slice(m2[1].length).trim();
    }
    const m3 = rest.match(AREA_RE);
    if (m3) {
      out.district = m3[1];
      rest = rest.slice(m3[1].length).trim();
    }
    out.detail = rest;
    return out;
  }
  function splitAddress(value) {
    const text = String(value == null ? "" : value).trim();
    const out = { province: "", city: "", district: "", detail: text };
    if (!text) return out;
    const none = { full: "", length: 0 };
    let best = null;
    levelCandidates(text, provinceAliases()).concat([none]).forEach((p) => {
      const afterP = text.slice(p.length);
      levelCandidates(afterP, cityAliases()).concat([none]).forEach((c) => {
        const afterC = afterP.slice(c.length);
        levelCandidates(afterC, districtAliases()).concat([none]).forEach((a) => {
          const total = p.length + c.length + a.length;
          if (!best || total > best.total) best = { p, c, a, total };
        });
      });
    });
    if (!best || best.total === 0) return splitByPattern(text);
    out.province = best.p.full;
    out.city = best.c.full;
    out.district = best.a.full;
    out.detail = text.slice(best.total).trim();
    return out;
  }
  function addressRole(el2) {
    const label = norm(labelText(el2));
    const attr = norm(String(el2.getAttribute("name") || "") + String(el2.getAttribute("id") || "") + String(el2.getAttribute("placeholder") || ""));
    if (/province|sheng/.test(attr)) return "province";
    if (/city|shi/.test(attr)) return "city";
    if (/district|area|county|qu/.test(attr)) return "district";
    if (/^省$|省份|所在省|请选择省/.test(label)) return "province";
    if (/^市$|所在市|请选择市/.test(label)) return "city";
    if (/^区$|^县$|区县|所在区|请选择区|请选择县/.test(label)) return "district";
    return "";
  }
  function levelHintOf(el2) {
    const text = norm(String(el2.id || "") + " " + String(el2.getAttribute("name") || ""));
    if (/firstlevl|firstlevel|level1|parent|province/.test(text)) return "province";
    if (/secondlevl|secondlevel|level2|child|city/.test(text)) return "city";
    if (/thirdlevl|thirdlevel|level3|district|county|area/.test(text)) return "district";
    return "";
  }
  var ADDRESS_ROLES = ["province", "city", "district"];
  function assignRoles(nodes) {
    const roles = [];
    const taken = {};
    nodes.forEach((node) => {
      const guess = addressRole(node) || regionLevelOf(node) || levelHintOf(node);
      if (guess && !taken[guess]) {
        taken[guess] = 1;
        roles.push(guess);
      } else {
        roles.push("");
      }
    });
    const free = ADDRESS_ROLES.filter((role) => !taken[role]);
    for (let i = 0; i < roles.length; i += 1) {
      if (!roles[i]) roles[i] = free.shift() || "";
    }
    return roles;
  }
  var MUNICIPALITIES = ["北京", "上海", "天津", "重庆"];
  function isMunicipality(name) {
    const t = norm(name);
    if (!t) return false;
    return MUNICIPALITIES.some((m) => t.indexOf(m) === 0);
  }
  function valueForRole(values, role) {
    if (!values) return "";
    if (role === "province") return values.province || "";
    if (role === "city") return values.city || (isMunicipality(values.province) ? values.province : "");
    if (role === "district") return values.district || "";
    return "";
  }
  function cascadeValues(raw) {
    const addr = splitAddress(raw);
    return { province: addr.province, city: addr.city, district: addr.district, detail: addr.detail, raw: String(raw == null ? "" : raw) };
  }
  var ROLE_NAMES = { province: "省", city: "市", district: "区 / 县" };

  // src/core/search-select.js
  var OPTION_SELECTOR = '[role="option"], .dropdown-menu li a, .dropdown-menu li, .ant-select-item-option, .el-select-dropdown__item, .bs-searchbox ~ .dropdown-menu li a';
  function isSearchSelect(el2) {
    if (!el2 || el2.tagName !== "SELECT") return false;
    if (String(el2.getAttribute("data-live-search")) === "true") return true;
    return !!(el2.closest && el2.closest(".bootstrap-select"));
  }
  function clickNode(node) {
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  function optionsIn(wrap) {
    const list = deepQueryAll(OPTION_SELECTOR);
    const out = [];
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (isOurUI(node)) continue;
      if (wrap && !wrap.contains(node)) continue;
      if (!visible(node)) continue;
      out.push(node);
    }
    return out;
  }
  function pickOption(list, want) {
    const w = norm(want);
    const hits = [];
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      const text = norm(node.textContent);
      if (!text || text === "请选择") continue;
      if (/no-results|search-no|model-close/.test(String(node.className || ""))) continue;
      let score = 0;
      if (text === w) score = 100;
      else if (text.indexOf(w) >= 0) score = 60;
      else if (w.indexOf(text) >= 0) score = 40;
      if (score) hits.push({ node, score });
    }
    if (!hits.length) return null;
    let bestScore = 0;
    for (let i = 0; i < hits.length; i += 1) bestScore = Math.max(bestScore, hits[i].score);
    const top = hits.filter((h) => h.score === bestScore).map((h) => h.node);
    for (let i = 0; i < top.length; i += 1) {
      const node = top[i];
      if (!top.some((other) => other !== node && node.contains(other))) return node;
    }
    return top[0];
  }
  async function fillSearchSelect(el2, value) {
    const want = String(value == null ? "" : value).trim();
    if (!want) return false;
    const trigger = visibleTriggerFor(el2);
    let wrap = el2.closest && el2.closest(".bootstrap-select") || null;
    if (!wrap && trigger) {
      let node = el2.parentElement;
      while (node && node !== document.body && !node.contains(trigger)) node = node.parentElement;
      wrap = node && node !== document.body ? node : trigger.parentElement;
    }
    if (!wrap) wrap = el2.parentElement;
    const toggle = trigger || wrap.querySelector('button.dropdown-toggle, [data-toggle="dropdown"]');
    if (toggle) clickNode(toggle);
    else {
      try {
        el2.focus();
      } catch (e) {
      }
    }
    await sleep(120);
    const box = wrap && wrap.querySelector('.bs-searchbox input, input[type="search"]');
    if (box) setVal(box, want);
    for (let i = 0; i < 12; i += 1) {
      await sleep(180);
      const idx = bestOptionIndex(el2, want, false);
      if (idx >= 0) {
        setVal(el2, el2.options[idx].value);
        return true;
      }
      const hit = pickOption(optionsIn(wrap), want);
      if (!hit) continue;
      clickNode(hit);
      for (let k = 0; k < 8; k += 1) {
        await sleep(80);
        if (el2.tagName !== "SELECT") return true;
        if (String(el2.value || "").trim()) return true;
      }
      return el2.tagName !== "SELECT";
    }
    if (box) setVal(box, "");
    if (toggle) clickNode(toggle);
    return false;
  }

  // src/core/floating-picker.js
  var MIN_ITEMS = 3;
  var OPEN_ROUNDS = 8;
  var PICK_ROUNDS = 12;
  function clickNode2(node) {
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  function snapshotVisible() {
    const seen = /* @__PURE__ */ new Set();
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length; i += 1) {
      if (visible(all[i])) seen.add(all[i]);
    }
    return seen;
  }
  var STATE_CLASS_RE = /^(active|selected|current|hover|focus|on|open|checked|disabled|hide|show|cur)$/;
  function classKeyOf(node) {
    const list = String(node.className || "").split(/\s+/).filter(Boolean).filter((c) => !STATE_CLASS_RE.test(c));
    list.sort();
    return node.tagName + "|" + list.join(".");
  }
  function sameStructureChildren(container) {
    const groups = /* @__PURE__ */ new Map();
    const kids = container.children || [];
    for (let i = 0; i < kids.length; i += 1) {
      const child = kids[i];
      if (!visible(child)) continue;
      const text = norm(child.textContent);
      if (text.length > 80) continue;
      const key = classKeyOf(child);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    }
    let best = [];
    groups.forEach((list) => {
      if (list.length > best.length) best = list;
    });
    return best;
  }
  function candidateItems(root) {
    let best = [];
    let bestScore = -1;
    const nodes = [root];
    const inside = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (let i = 0; i < inside.length; i += 1) nodes.push(inside[i]);
    for (let i = 0; i < nodes.length; i += 1) {
      const items = sameStructureChildren(nodes[i]);
      const texts = items.map((item) => norm(item.textContent)).filter(Boolean);
      if (!texts.length) continue;
      let total = 0;
      for (let k = 0; k < texts.length; k += 1) total += texts[k].length;
      const score = texts.length * 10 - total / texts.length;
      if (score > bestScore) {
        bestScore = score;
        best = items;
      }
    }
    return best;
  }
  function panelColumns(panel) {
    const cols = sameStructureChildren(panel);
    if (cols.length < 2) return null;
    const hasItems = cols.some((col) => sameStructureChildren(col).length > 0);
    if (!hasItems) return null;
    return cols;
  }
  function clickTargetFor(node) {
    const inner = node.querySelector && node.querySelector('a, button, [role="option"], [role="menuitem"]');
    return inner || node;
  }
  function pickItem(items, want) {
    const w = norm(want);
    const hits = [];
    for (let i = 0; i < items.length; i += 1) {
      const text = norm(items[i].textContent);
      if (!text) continue;
      let score = 0;
      if (text === w) score = 100;
      else if (text.indexOf(w) >= 0) score = 60;
      else if (w.indexOf(text) >= 0) score = 40;
      if (score) hits.push({ node: items[i], score });
    }
    if (!hits.length) return null;
    let bestScore = 0;
    for (let i = 0; i < hits.length; i += 1) bestScore = Math.max(bestScore, hits[i].score);
    const top = hits.filter((h) => h.score === bestScore).map((h) => h.node);
    for (let i = 0; i < top.length; i += 1) {
      const node = top[i];
      if (!top.some((other) => other !== node && node.contains(other))) return clickTargetFor(node);
    }
    return clickTargetFor(top[0]);
  }
  function looksLikePanel(node) {
    if (node.querySelector && node.querySelector('input, textarea, [role="option"], [role="listbox"]')) return true;
    return sameStructureChildren(node).length >= MIN_ITEMS;
  }
  function whollyFresh(node, before) {
    const all = node.querySelectorAll ? node.querySelectorAll("*") : [];
    for (let i = 0; i < all.length; i += 1) {
      if (before.has(all[i])) return false;
    }
    return true;
  }
  async function openPanel(el2) {
    const before = snapshotVisible();
    clickNode2(el2);
    for (let round = 0; round < OPEN_ROUNDS; round += 1) {
      await sleep(150);
      const fresh = [];
      const all = document.querySelectorAll("body *");
      for (let i = 0; i < all.length; i += 1) {
        const node = all[i];
        if (isOurUI(node) || before.has(node) || !visible(node)) continue;
        fresh.push(node);
      }
      const hits = [];
      for (let i = 0; i < fresh.length; i += 1) {
        const node = fresh[i];
        if (!looksLikePanel(node)) continue;
        if (!whollyFresh(node, before)) continue;
        hits.push(node);
      }
      if (!hits.length) continue;
      for (let i = 0; i < hits.length; i += 1) {
        const node = hits[i];
        if (!hits.some((other) => other !== node && other.contains(node))) return { panel: node };
      }
      return { panel: hits[0] };
    }
    return null;
  }
  function searchBoxIn(panel) {
    const list = panel.querySelectorAll("input, textarea");
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (node.readOnly || node.disabled || !visible(node)) continue;
      const type = (node.type || "").toLowerCase();
      if (type === "hidden" || type === "checkbox" || type === "radio" || type === "file") continue;
      return node;
    }
    return null;
  }
  function shownText(el2) {
    if (el2.tagName === "INPUT" || el2.tagName === "TEXTAREA") return String(el2.value || "");
    return String(el2.textContent || "");
  }
  async function waitPicked(el2, want) {
    const w = norm(want);
    for (let i = 0; i < 10; i += 1) {
      await sleep(120);
      const value = norm(shownText(el2));
      if (value && value.indexOf(w) >= 0) return true;
    }
    return false;
  }
  async function fillFloatingPicker(el2, value) {
    const want = String(value == null ? "" : value).trim();
    if (!want) return false;
    const opened = await openPanel(el2);
    if (!opened) return false;
    const box = searchBoxIn(opened.panel);
    if (box) setVal(box, want);
    for (let round = 0; round < PICK_ROUNDS; round += 1) {
      await sleep(150);
      const hit = pickItem(candidateItems(opened.panel), want);
      if (!hit) continue;
      clickNode2(hit);
      if (await waitPicked(el2, want)) return true;
      break;
    }
    clickNode2(el2);
    return false;
  }

  // src/core/wait.js
  function waitFor(predicate, options) {
    const opts = options || {};
    const timeout = opts.timeout == null ? 5e3 : opts.timeout;
    const interval = opts.interval == null ? 60 : opts.interval;
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      let observer = null;
      let deadline = null;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        if (deadline) clearTimeout(deadline);
        if (observer) observer.disconnect();
        resolve(value == null ? null : value);
      };
      const check = () => {
        let value = null;
        try {
          value = predicate();
        } catch (e) {
          value = null;
        }
        if (value) finish(value);
      };
      timer = setInterval(check, interval);
      deadline = setTimeout(() => finish(null), timeout);
      if (typeof MutationObserver === "function" && opts.root) {
        try {
          observer = new MutationObserver(check);
          observer.observe(opts.root, { childList: true, subtree: true, attributes: true });
        } catch (e) {
          observer = null;
        }
      }
      check();
    });
  }

  // src/core/cascade.js
  var MAX_LEVELS = 4;
  function isCascadeKey(key) {
    return !!ADDRESS_KEYS[key];
  }
  function selectableControls(scope) {
    const out = [];
    const list = scope.querySelectorAll("input, select");
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (isOurUI(node) || node.disabled) continue;
      const t = (node.type || "").toLowerCase();
      if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") continue;
      if (t === "file" || t === "checkbox" || t === "radio") continue;
      if (node.tagName !== "INPUT" && node.tagName !== "SELECT" && node.getAttribute("role") !== "combobox") continue;
      out.push(node);
    }
    return out;
  }
  function cascadeScope(el2) {
    const tag = el2.tagName;
    let node = el2;
    for (let depth = 0; depth < 8 && node && node.parentElement; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      const hasSibling = Array.prototype.some.call(parent.children, (child) => {
        if (child === node) return false;
        if (child.tagName === tag) return true;
        return !!(child.querySelector && child.querySelector(tag));
      });
      if (hasSibling) return parent;
      node = parent;
    }
    return sectionContainer(el2);
  }
  function controlUnits(scope) {
    const controls = selectableControls(scope);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < controls.length; i += 1) {
      const node = controls[i];
      let box = node;
      while (box.parentElement && box.parentElement !== scope) box = box.parentElement;
      if (box.parentElement !== scope) continue;
      if (seen.has(box)) continue;
      seen.add(box);
      const inside = controls.filter((n) => n === box || box.contains(n));
      const pick = inside.find((n) => n.tagName === "SELECT") || inside[0];
      out.push({ box, node: pick });
    }
    return out;
  }
  function detectCascade(el2, classify) {
    if (!el2 || el2.tagName !== "SELECT" && el2.tagName !== "INPUT") return null;
    const scope = cascadeScope(el2);
    if (!scope) return null;
    const units = controlUnits(scope);
    const list = units.map((u) => ({ node: u.node, key: classify(u.node) }));
    const idx = list.findIndex((item) => item.node === el2);
    if (idx < 0) return null;
    const tag = el2.tagName;
    let start = idx;
    let end = idx;
    while (start > 0 && list[start - 1].node.tagName === tag) start -= 1;
    while (end < list.length - 1 && list[end + 1].node.tagName === tag) end += 1;
    const seg = list.slice(start, end + 1);
    let groupKey = "";
    for (let i = 0; i < seg.length; i += 1) {
      if (seg[i].key && isCascadeKey(seg[i].key)) {
        groupKey = seg[i].key;
        break;
      }
    }
    if (!groupKey) return null;
    const members = seg.filter((item) => !item.key || item.key === groupKey);
    if (!members.length || members.length > MAX_LEVELS) return null;
    const nodes = members.map((item) => item.node);
    return {
      key: groupKey,
      nodes,
      roles: assignRoles(nodes),
      position: members.findIndex((item) => item.node === el2)
    };
  }
  function visibleTriggerFor(node) {
    if (!node || !node.getAttribute) return null;
    if (visible(node)) return null;
    let scope = node.parentElement;
    for (let depth = 0; scope && depth < 4; depth += 1) {
      const list = scope.querySelectorAll('button, a, [role="button"], [role="combobox"], [data-toggle="dropdown"]');
      for (let i = 0; i < list.length; i += 1) {
        const el2 = list[i];
        if (el2 === node || el2.contains(node)) continue;
        if (visible(el2)) return el2;
      }
      scope = scope.parentElement;
    }
    return null;
  }
  function hasVisibleMirror(node) {
    return !!visibleTriggerFor(node);
  }
  function mirrorText(node) {
    const wrap = node.closest && node.closest(".bootstrap-select");
    if (!wrap) return "";
    const span = wrap.querySelector(".filter-option");
    if (span) return String(span.textContent).trim();
    const toggle = wrap.querySelector("button.dropdown-toggle");
    return toggle ? String(toggle.getAttribute("title") || "").trim() : "";
  }
  function verifyWritten(node, want) {
    const w = normalizeRegion(want);
    if (!w) return false;
    if (node.tagName === "SELECT") {
      const text2 = node.selectedIndex >= 0 ? String(node.options[node.selectedIndex].textContent) : "";
      if (text2 && normalizeRegion(text2).indexOf(w) >= 0) return true;
      const mirror = normalizeRegion(mirrorText(node));
      return !!mirror && mirror.indexOf(w) >= 0;
    }
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      const value = normalizeRegion(node.value);
      return !!value && value.indexOf(w) >= 0;
    }
    const text = normalizeRegion(node.textContent);
    return !!text && text.indexOf(w) >= 0;
  }
  async function writeNative(node, want) {
    if (node.tagName !== "SELECT") {
      setVal(node, want);
      return verifyWritten(node, want);
    }
    const idx = bestOptionIndex(node, want, false);
    if (idx < 0) return false;
    setVal(node, node.options[idx].value);
    return verifyWritten(node, want);
  }
  async function driveControl(node, want) {
    const attempts = [];
    if (node.tagName === "SELECT") {
      if (isSearchSelect(node)) attempts.push(() => fillSearchSelect(node, want));
      attempts.push(() => writeNative(node, want));
    } else if (node.readOnly) {
      attempts.push(() => fillFloatingPicker(node, want));
      attempts.push(() => writeNative(node, want));
    } else {
      attempts.push(() => writeNative(node, want));
    }
    for (let i = 0; i < attempts.length; i += 1) {
      let ok = false;
      try {
        ok = await attempts[i]();
      } catch (e) {
        ok = false;
      }
      if (ok && verifyWritten(node, want)) return true;
    }
    return false;
  }
  function optionsReady(node) {
    if (!node || node.tagName !== "SELECT") return true;
    if (node.options && node.options.length > 1) return true;
    return isSearchSelect(node);
  }
  async function fillCascade(group, values, options) {
    const opts = options || {};
    const levelTimeout = opts.timeout == null ? 6e3 : opts.timeout;
    const result = { written: 0, blocked: [], missing: [] };
    for (let i = 0; i < group.nodes.length; i += 1) {
      const node = group.nodes[i];
      const role = group.roles[i];
      if (!role) continue;
      const want = valueForRole(values, role);
      if (!want) continue;
      if (node.tagName === "SELECT") {
        await waitFor(() => optionsReady(node), { timeout: levelTimeout, root: node.parentElement || node });
      }
      if (await driveControl(node, want)) result.written += 1;
      else result.blocked.push(role);
    }
    ADDRESS_ROLES.forEach((role) => {
      if (group.roles.indexOf(role) >= 0) return;
      if (valueForRole(values, role)) result.missing.push(role);
    });
    return result;
  }
  async function fillCascadePanel(el2, values, options) {
    const opts = options || {};
    const result = { written: 0, blocked: [], missing: [] };
    const opened = await openPanel(el2);
    if (!opened) return result;
    const cols = panelColumns(opened.panel);
    for (let i = 0; i < ADDRESS_ROLES.length; i += 1) {
      const role = ADDRESS_ROLES[i];
      const want = valueForRole(values, role);
      if (!want) continue;
      const scope = cols ? cols[i] : opened.panel;
      if (!scope) {
        result.missing = ADDRESS_ROLES.slice(i).filter((r) => valueForRole(values, r));
        break;
      }
      const itemsIn = () => cols ? sameStructureChildren(scope) : candidateItems(scope);
      const hit = await waitFor(() => pickItem(itemsIn(), want), { timeout: opts.timeout || 2500 });
      if (!hit) {
        result.blocked.push(role);
        result.missing = ADDRESS_ROLES.slice(i + 1).filter((r) => valueForRole(values, r));
        break;
      }
      clickNode2(hit);
      result.written += 1;
    }
    return result;
  }

  // src/core/date-widget.js
  var PICKER_CLASS_RE = /ant-picker|ant-calendar-picker|el-date-editor|ivu-date-picker|arco-picker|n-date-picker|van-calendar|flatpickr|react-datepicker|vdp-datepicker|datepicker|date-picker/i;
  var PANEL_SELECTOR = '.ant-picker-dropdown, .el-picker-panel, .ivu-picker-panel, .arco-picker-container, .n-date-panel, .flatpickr-calendar, .react-datepicker, [class*="picker-panel"], [class*="datepicker"], [class*="date-picker"]';
  var PREV_SELECTOR = '[class*="super-prev"], [class*="prev"]';
  function isDatePicker(el2) {
    if (!el2 || el2.tagName !== "INPUT" || isCustomSelect(el2)) return false;
    const cls = String(el2.className || "") + " " + String(el2.parentElement && el2.parentElement.className || "");
    return PICKER_CLASS_RE.test(cls);
  }
  function panelVisible(panel) {
    try {
      const r = panel.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
    } catch (e) {
    }
    const style = panel.getAttribute && panel.getAttribute("style");
    if (style && /display\s*:\s*none/i.test(style)) return false;
    return true;
  }
  function findPanel() {
    const list = deepQueryAll(PANEL_SELECTOR).filter(panelVisible);
    return list.length ? list[list.length - 1] : null;
  }
  function clickNode3(node) {
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    node.click();
  }
  function innermost(hits) {
    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i];
      let wraps = false;
      for (let j = 0; j < hits.length; j += 1) {
        if (i !== j && hit.contains && hit.contains(hits[j])) {
          wraps = true;
          break;
        }
      }
      if (!wraps) return hit;
    }
    return hits[0];
  }
  function clickCell(panel, texts) {
    const cells = panel.querySelectorAll("td, th, li, button, a, span, div");
    const hits = [];
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const text = String(cell.textContent || "").trim();
      if (texts.indexOf(text) < 0) continue;
      const cls = String(cell.className || "");
      if (/disabled|prev|next|out-of-range|not-current/.test(cls)) continue;
      hits.push(cell);
    }
    if (!hits.length) return false;
    clickNode3(innermost(hits));
    return true;
  }
  function openYearView(panel) {
    const headers = panel.querySelectorAll('[class*="header"], [class*="title"]');
    for (let i = 0; i < headers.length; i += 1) {
      const parts = headers[i].querySelectorAll("button, span, div, a");
      const hits = [];
      for (let j = 0; j < parts.length; j += 1) {
        if (/^\d{4}\s*年?$/.test(String(parts[j].textContent || "").trim())) hits.push(parts[j]);
      }
      if (hits.length) {
        clickNode3(innermost(hits));
        return true;
      }
    }
    return false;
  }
  function clickPrev(panel) {
    const list = panel.querySelectorAll(PREV_SELECTOR);
    for (let i = 0; i < list.length; i += 1) {
      const cls = String(list[i].className || "");
      if (/next|super-next/.test(cls)) continue;
      clickNode3(list[i]);
      return true;
    }
    return false;
  }
  function clickNext(panel) {
    const list = panel.querySelectorAll('[class*="next"]');
    for (let i = 0; i < list.length; i += 1) {
      const cls = String(list[i].className || "");
      if (/prev/.test(cls) && !/next/.test(cls)) continue;
      clickNode3(list[i]);
      return true;
    }
    return false;
  }
  async function pickYear(panel, year) {
    for (let i = 0; i < 12; i += 1) {
      if (clickCell(panel, [year])) return true;
      if (!clickPrev(panel)) break;
      await sleep(90);
    }
    for (let i = 0; i < 24; i += 1) {
      if (clickCell(panel, [year])) return true;
      if (!clickNext(panel)) break;
      await sleep(90);
    }
    return false;
  }
  function monthTexts(month) {
    const n = String(Number(month));
    return [n + "月", month + "月", n, month];
  }
  function dayTexts(day) {
    const n = String(Number(day));
    return [n, day, n + "日", day + "日"];
  }
  async function fillDatePicker(el2, value) {
    const date = splitDateTime(value);
    if (!date) return false;
    let panel = null;
    try {
      el2.focus();
      el2.click();
      await sleep(260);
      panel = findPanel();
      if (!panel) return false;
      await sleep(60);
      if (openYearView(panel)) await sleep(160);
      if (!await pickYear(panel, date.year)) return false;
      await sleep(120);
      if (!clickCell(panel, monthTexts(date.month))) return false;
      await sleep(120);
      if (!clickCell(panel, dayTexts(date.day))) return false;
      await sleep(200);
      return !!String(el2.value || "").trim();
    } catch (e) {
      return false;
    } finally {
      if (panel) {
        try {
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        } catch (e) {
        }
      }
    }
  }
  function dateRole(el2) {
    const label = norm(labelText(el2));
    const attr = norm(String(el2.getAttribute("name") || "") + " " + String(el2.getAttribute("id") || "") + " " + String(el2.getAttribute("placeholder") || ""));
    const whole = pickKey({ label, attr, hint: "", allowHint: false });
    if (whole && DATE_KEYS[whole]) return "";
    if (/(^|[^a-z])(year|yyyy)([^a-z]|$)/.test(attr)) return "year";
    if (/(^|[^a-z])month([^a-z]|$)/.test(attr)) return "month";
    if (/(^|[^a-z])(day|dd)([^a-z]|$)/.test(attr)) return "day";
    if (/年$/.test(label)) return "year";
    if (/月$/.test(label)) return "month";
    if (/[日号]$/.test(label)) return "day";
    return "";
  }
  function usable(node) {
    if (!node || !node.tagName) return false;
    if (node.disabled || node.readOnly) return false;
    if ((node.type || "").toLowerCase() === "hidden") return false;
    return !isOurUI(node);
  }
  function dateSegmentGroup(el2) {
    const row = rowContainer(el2);
    if (!row || !row.querySelectorAll) return null;
    const nodes = [];
    const inside = row.querySelectorAll("input, select");
    for (let i = 0; i < inside.length; i += 1) {
      if (usable(inside[i])) nodes.push(inside[i]);
    }
    if (nodes.length < 2 || nodes.length > 3) return null;
    const fallback = nodes.length === 3 ? ["year", "month", "day"] : ["year", "month"];
    const roles = nodes.map((node) => dateRole(node));
    const taken = {};
    for (let i = 0; i < roles.length; i += 1) {
      if (roles[i] && !taken[roles[i]]) taken[roles[i]] = 1;
      else roles[i] = "";
    }
    for (let i = 0; i < roles.length; i += 1) {
      if (roles[i]) continue;
      const pick = fallback.filter((r) => !taken[r])[0];
      if (!pick) return null;
      roles[i] = pick;
      taken[pick] = 1;
    }
    if (!(taken.year && taken.month)) return null;
    return { row, nodes, roles };
  }
  function writeDateSegment(node, role, date) {
    const want = role === "year" ? date.year : role === "month" ? date.month : date.day;
    if (node.tagName === "SELECT") {
      const idx = bestOptionIndex(node, want, false);
      if (idx < 0) return false;
      setVal(node, node.options[idx].value);
      return !!String(node.value || "").trim();
    }
    setVal(node, want);
    return !!String(node.value || "").trim();
  }

  // src/core/blocks.js
  var KEYS_OF = KEY_GROUPS;
  function fieldKeyOf(el2, type) {
    if (!el2 || !el2.tagName) return null;
    const tag = el2.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return null;
    if (isOurUI(el2)) return null;
    const t = (el2.type || "").toLowerCase();
    if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") return null;
    const k = pickKey({ label: labelText(el2), attr: attrText(el2), hint: "", allowHint: false });
    return k && KEYS_OF[type][k] ? k : null;
  }
  function fieldsOf(root, type) {
    const out = [];
    if (!root || !root.querySelectorAll) return out;
    if (fieldKeyOf(root, type)) out.push(root);
    const list = root.querySelectorAll("input, textarea, select");
    for (let i = 0; i < list.length; i += 1) {
      if (fieldKeyOf(list[i], type)) out.push(list[i]);
    }
    return out;
  }
  function repeatedBySequence(blocks, sigs) {
    const flat = sigs.map((s) => s[0]);
    const half = Math.floor(flat.length / 2);
    for (let len = 1; len <= half; len += 1) {
      let same = true;
      for (let i = 0; i < len; i += 1) {
        if (flat[i] !== flat[i + len]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      const out = [];
      for (let i = 0; i < flat.length; i += len) out.push(blocks[i]);
      return out;
    }
    return null;
  }
  function repeatedLevel(el2, type) {
    let node = el2;
    for (let depth = 0; depth < 8 && node && node.parentElement; depth += 1) {
      node = node.parentElement;
      if (!node || node === document.body || node === document.documentElement) break;
      const parent = node.parentElement;
      if (!parent) break;
      const blocks = [];
      for (let i = 0; i < parent.children.length; i += 1) {
        const child = parent.children[i];
        if (fieldsOf(child, type).length) blocks.push(child);
      }
      if (blocks.length > 1) {
        const sigs = blocks.map((b) => fieldsOf(b, type).map((n) => fieldKeyOf(n, type)));
        if (sigs.every((s) => s.length === 1)) {
          const bySeq = repeatedBySequence(blocks, sigs);
          if (bySeq) return { node, blocks: bySeq };
        }
        for (let i = 0; i < sigs.length; i += 1) {
          if (sigs[i].length < 2) continue;
          const distinct = {};
          sigs[i].forEach((k) => {
            distinct[k] = 1;
          });
          if (Object.keys(distinct).length < 2) continue;
          for (let j = i + 1; j < sigs.length; j += 1) {
            if (sigs[i].length !== sigs[j].length) continue;
            if (!sigs[i].every((k) => sigs[j].indexOf(k) >= 0)) continue;
            if (blocks[i].tagName !== blocks[j].tagName) continue;
            if (String(blocks[i].className || "") !== String(blocks[j].className || "")) continue;
            return { node, blocks };
          }
        }
      }
    }
    return null;
  }
  function firstFieldOfType(type) {
    const list = document.querySelectorAll("input, textarea, select");
    for (let i = 0; i < list.length; i += 1) {
      if (fieldKeyOf(list[i], type)) return list[i];
    }
    return null;
  }
  function blockContainers(type) {
    const field = firstFieldOfType(type);
    if (!field) return [];
    const hit = repeatedLevel(field, type);
    return hit ? hit.blocks : [];
  }
  function blockIndexOf(el2, type) {
    const hit = repeatedLevel(el2, type);
    if (!hit) return 1;
    for (let i = 0; i < hit.blocks.length; i += 1) {
      if (hit.blocks[i] === hit.node || hit.blocks[i].contains(el2)) return i + 1;
    }
    return 1;
  }

  // src/core/options-hint.js
  var ENUMS = [
    { key: "gender", labels: ["男", "女"], min: 2 },
    { key: "maritalStatus", labels: ["未婚", "已婚", "离异", "丧偶"], min: 2 },
    { key: "politicalStatus", labels: ["中共党员", "共青团员", "民主党派", "群众", "预备党员"], min: 2 },
    { key: "hukouType", labels: ["农业户口", "非农业户口", "居民户口", "城镇户口"], min: 2 }
  ];
  function optionsKeyOf(node) {
    if (!node || node.tagName !== "SELECT" || !node.options) return "";
    const texts = [];
    for (let i = 0; i < node.options.length; i += 1) {
      const t = norm(node.options[i].textContent);
      if (t && t !== "请选择") texts.push(t);
    }
    if (texts.length < 2) return "";
    let best = "";
    let bestHits = 1;
    ENUMS.forEach((spec) => {
      let hits = 0;
      spec.labels.forEach((label) => {
        const l = norm(label);
        if (texts.some((t) => t === l || t.indexOf(l) >= 0)) hits += 1;
      });
      if (hits >= spec.min && hits > bestHits) {
        bestHits = hits;
        best = spec.key;
      }
    });
    return best;
  }

  // src/core/filler.js
  var PREREQUISITE = {
    eduEnd: "eduStart",
    workEnd: "workStart",
    projectEnd: "projectStart",
    activityEnd: "activityStart",
    idCard: "idType"
  };
  function describe(el2, key) {
    const lb = labelText(el2) || el2.getAttribute && el2.getAttribute("placeholder") || key || "";
    return String(lb).replace(/\s+/g, " ").trim().slice(0, 40);
  }
  function shouldSkip(el2) {
    if (!el2 || el2.disabled || el2.readOnly) return true;
    const t = (el2.type || "").toLowerCase();
    if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") return true;
    if (el2.getAttribute("aria-hidden") === "true") return true;
    return false;
  }
  var HINT_RE = /^(请输入|请填写|请选择|请上传|输入|填写|选择|上传|字数控制在|只支持|支持)/;
  function isHintText(el2, value) {
    const placeholder = String(el2.getAttribute("placeholder") || "").trim();
    if (placeholder && value === placeholder) return true;
    if (el2.getAttribute("data-noevent") !== null && HINT_RE.test(value)) return true;
    return HINT_RE.test(value);
  }
  function alreadyFilled(el2) {
    if (el2.tagName === "SELECT") {
      return !!(el2.value && el2.selectedIndex > 0 && String(el2.options[el2.selectedIndex].text).trim());
    }
    const value = String(el2.value || "").trim();
    if (!value) return false;
    return !isHintText(el2, value);
  }
  function highlight(el2) {
    try {
      const old = el2.style.outline;
      el2.style.outline = "2px solid #16a34a";
      el2.style.outlineOffset = "1px";
      setTimeout(() => {
        el2.style.outline = old;
      }, 4e3);
    } catch (e) {
    }
  }
  function roleText(list) {
    return list.map((role) => ROLE_NAMES[role] || role).join(" / ");
  }
  function addressValueFor(el2, value) {
    const values = cascadeValues(value);
    return valueForRole(values, addressRole(el2) || "province") || values.raw;
  }
  function isCountrySelect(el2) {
    const text = Array.from(el2.options).map((o) => o.textContent).join(" ");
    if (!text) return false;
    return /中国大陆|中国香港|中国澳门|中国台湾|\+86|国家和地区|国家\/地区/.test(text);
  }
  async function applyValue(el2, key, value, options, profile, st) {
    const name = FIELD_NAMES[key] || "自定义";
    if (key === "phone" && el2.tagName === "SELECT" && isCountrySelect(el2)) {
      const want = String(profile.phoneCountry || "中国大陆");
      let idx = bestOptionIndex(el2, want, false);
      if (idx < 0 && want === "中国大陆") idx = bestOptionIndex(el2, "+86", false);
      if (idx >= 0) {
        const text = String(el2.options[idx].text).trim();
        setVal(el2, el2.options[idx].value);
        st.count += 1;
        st.filled.push(name + " → " + text);
        if (options.highlight) highlight(el2);
      } else {
        st.manual.push(name + "：国家 / 地区代码没有匹配项，请手动选");
      }
      return;
    }
    if (el2.tagName === "SELECT") {
      const preferEnrolled = key === "degree" && /在读|应届/.test(String(profile.degreeNote || "在读"));
      const want = ADDRESS_KEYS[key] ? addressValueFor(el2, value) : value;
      const idx = bestOptionIndex(el2, want, preferEnrolled);
      if (idx >= 0) {
        const text = String(el2.options[idx].text).trim();
        setVal(el2, el2.options[idx].value);
        st.count += 1;
        st.filled.push(name + " → " + text);
        if (options.highlight) highlight(el2);
        if (want !== value) st.manual.push(name + "：这个下拉只到「" + text + "」，后面的部分请手动补全");
        return;
      }
      if (isSearchSelect(el2)) {
        const search = ADDRESS_KEYS[key] ? addressValueFor(el2, value) : value;
        if (await fillSearchSelect(el2, search)) {
          st.count += 1;
          st.filled.push(name + " → " + search);
          if (options.highlight) highlight(el2);
        } else {
          st.manual.push(name + "：可搜索下拉里没有匹配项，请手动选");
        }
        return;
      }
      if (isCustomSelect(el2)) {
        const ok = await fillCustomSelect(el2, value);
        if (ok) {
          st.count += 1;
          st.filled.push(name);
          if (options.highlight) highlight(el2);
        } else {
          st.manual.push(name + "：下拉框没有合适选项，请手动选");
        }
        return;
      }
      st.manual.push(name + "：下拉框没有合适选项，请手动选");
      return;
    }
    if (options.fillDatePickers && isDatePicker(el2)) {
      const ok = await fillDatePicker(el2, value);
      if (ok) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el2);
      } else {
        st.manual.push(name + "：日期选择器没有选上，请手动选");
      }
      return;
    }
    if (el2.tagName !== "INPUT" && el2.tagName !== "TEXTAREA" && el2.tagName !== "SELECT") {
      if (await fillFloatingPicker(el2, value)) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el2);
      } else {
        st.manual.push(name + "：弹出层里没有匹配项，请手动选");
      }
      return;
    }
    if (el2.tagName === "INPUT" && el2.readOnly) {
      if (isDatePicker(el2)) {
        if (await fillDatePicker(el2, value)) {
          st.count += 1;
          st.filled.push(name);
          if (options.highlight) highlight(el2);
        } else {
          st.manual.push(name + "：日期选择器没有选上，请手动选");
        }
        return;
      }
      if (DATE_KEYS[key]) {
        st.manual.push(name + "：只读的日期控件，请手动选");
        return;
      }
      if (ADDRESS_KEYS[key]) {
        const panelRes = await fillCascadePanel(el2, cascadeValues(value), { timeout: 2500 });
        if (panelRes.written) {
          st.count += panelRes.written;
          st.filled.push(name);
          if (options.highlight) highlight(el2);
          if (panelRes.missing.length) st.manual.push(name + "：" + roleText(panelRes.missing) + " 请手动补全");
          return;
        }
      }
      if (await fillFloatingPicker(el2, value)) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el2);
      } else {
        st.manual.push(name + "：弹出层里没有匹配项，请手动选");
      }
      return;
    }
    if (isCustomSelect(el2) && el2.readOnly) {
      const ok = await fillCustomSelect(el2, value);
      if (ok) {
        st.count += 1;
        st.filled.push(name);
        if (options.highlight) highlight(el2);
      } else {
        st.manual.push(name + "：自定义下拉框，请手动选");
      }
      return;
    }
    const out = formatValue(el2, value, labelText(el2));
    if (!out) {
      st.manual.push(name + "：这个控件要填具体时刻，资料里没有，请手动填写");
      return;
    }
    const wasEmpty = /ng-empty/.test(String(el2.className || ""));
    setVal(el2, out);
    const back = String(el2.value || "").trim();
    if (!back) {
      st.manual.push(name + "：控件不接受这个格式，请手动填写");
      return;
    }
    if (back !== out && isHintText(el2, back)) {
      st.manual.push(name + "：写进去的值被换回了提示文字，请手动填写");
      return;
    }
    if (wasEmpty && /ng-empty/.test(String(el2.className || ""))) {
      st.manual.push(name + "：页面没有接受这个值，请手动填写");
      return;
    }
    st.count += 1;
    st.filled.push(name);
    if (options.highlight) highlight(el2);
  }
  function pairedStart(el2, key) {
    const startKey = PREREQUISITE[key];
    if (!startKey) return null;
    const scope = rowContainer(el2) || sectionContainer(el2);
    if (!scope || !scope.querySelectorAll) return null;
    const list = scope.querySelectorAll("input, select, textarea");
    for (let i = 0; i < list.length; i += 1) {
      const n = list[i];
      if (n === el2) break;
      if (isOurUI(n) || shouldSkip(n) || alreadyFilled(n)) continue;
      const k = pickKey({
        label: labelText(n),
        attr: attrText(n),
        block: sectionBlockType(n),
        hint: fieldHint(n),
        allowHint: false
      });
      if (k === startKey) return { node: n, key: k };
    }
    return null;
  }
  async function runFill(profile, opts) {
    const options = Object.assign({ onlyEmpty: true, autoConsent: false, highlight: true, fillDatePickers: true }, opts || {});
    const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0, skipped: 0 };
    const nodes = deepQueryAll('input, textarea, select, [role="combobox"]');
    const handled = /* @__PURE__ */ new Set();
    const segments = /* @__PURE__ */ new Map();
    const skipNode = (el2) => {
      if (isOurUI(el2) || el2.disabled) return true;
      const t = (el2.type || "").toLowerCase();
      if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") return true;
      if (el2.getAttribute("aria-hidden") === "true") return true;
      if (!visible(el2)) {
        if (hasVisibleMirror(el2)) return false;
        return true;
      }
      return false;
    };
    const indexCache = /* @__PURE__ */ new Map();
    const rowIndexOf = (el2, key) => {
      const group = groupOf(key);
      if (!group) return 1;
      if (!indexCache.has(el2)) indexCache.set(el2, blockIndexOf(el2, group));
      return indexCache.get(el2);
    };
    const scopeIds = /* @__PURE__ */ new WeakMap();
    let scopeSeq = 0;
    const scopeIdOf = (node) => {
      if (!scopeIds.has(node)) {
        scopeSeq += 1;
        scopeIds.set(node, scopeSeq);
      }
      return scopeIds.get(node);
    };
    const claimed = /* @__PURE__ */ new Set();
    const isRepeatInSection = (el2, key) => {
      if (!groupOf(key)) return false;
      const scope = sectionContainer(el2) || rowContainer(el2);
      if (!scope) return false;
      const stamp = scopeIdOf(scope) + "|" + key + "|" + rowIndexOf(el2, key);
      if (claimed.has(stamp)) return true;
      claimed.add(stamp);
      return false;
    };
    const segmentOf = (el2) => {
      const row = rowContainer(el2);
      if (!row) return null;
      if (!segments.has(row)) segments.set(row, dateSegmentGroup(el2));
      return segments.get(row);
    };
    const cascadeKeyCache = /* @__PURE__ */ new Map();
    const classifyForCascade = (node) => {
      if (cascadeKeyCache.has(node)) return cascadeKeyCache.get(node);
      const k = pickKey({
        label: labelText(node),
        attr: attrText(node),
        block: sectionBlockType(node),
        hint: "",
        allowHint: false
      });
      cascadeKeyCache.set(node, k);
      return k;
    };
    const runCascade = async (group) => {
      const label = FIELD_NAMES[group.key] || group.key;
      const values = cascadeValues(valueForField(group.key, profile, 1));
      if (!values.province && !values.city && !values.raw) return false;
      const res = await fillCascade(group, values, { timeout: 6e3 });
      group.nodes.forEach((n) => handled.add(n));
      if (res.written) {
        st.count += res.written;
        st.filled.push(label + "（分级选择）");
        if (options.highlight) group.nodes.forEach((n) => highlight(n));
      }
      if (res.blocked.length) st.manual.push(label + "：" + roleText(res.blocked) + " 没有选中，请手动选");
      if (res.missing.length) st.manual.push(label + "：这一栏没有 " + roleText(res.missing) + " 控件，请手动补全");
      return res.written > 0 || res.blocked.length > 0 || res.missing.length > 0;
    };
    const fillSegment = (el2, group, rowKey) => {
      const date = splitDateTime(valueForField(rowKey, profile, rowIndexOf(el2, rowKey)));
      if (!date) return false;
      const name = FIELD_NAMES[rowKey] || rowKey;
      let written = 0;
      let blocked = 0;
      for (let i = 0; i < group.nodes.length; i += 1) {
        const node = group.nodes[i];
        handled.add(node);
        if (options.onlyEmpty && alreadyFilled(node)) {
          st.skipped += 1;
          continue;
        }
        if (writeDateSegment(node, group.roles[i], date)) written += 1;
        else blocked += 1;
      }
      if (written) {
        st.count += written;
        st.filled.push(name + "（年/月/日分开填写）");
        if (options.highlight) group.nodes.forEach((n) => highlight(n));
      }
      if (blocked) st.manual.push(name + "：年/月/日控件没有能选中的值，请手动选");
      return written > 0 || blocked > 0;
    };
    for (let i = 0; i < nodes.length; i += 1) {
      const el2 = nodes[i];
      if (handled.has(el2) || skipNode(el2)) continue;
      const type = (el2.type || "").toLowerCase();
      if (type === "file") {
        if (visible(el2)) st.manual.push("手动上传文件：" + describe(el2));
        continue;
      }
      if (type === "checkbox") {
        const nm = norm(labelText(el2) + " " + attrText(el2));
        if (options.autoConsent && !el2.checked && /我已阅读|同意|接受|隐私政策|服务条款|agree|consent|accept/.test(nm)) {
          el2.click();
          st.count += 1;
          st.filled.push("勾选：" + describe(el2));
        }
        continue;
      }
      if (type === "radio") {
        const gname = el2.name || "__radio_" + i;
        if (st.radioDone[gname]) continue;
        st.radioDone[gname] = 1;
        const all = [el2];
        for (let k = 0; k < nodes.length; k += 1) {
          const n = nodes[k];
          if (n !== el2 && (n.type || "").toLowerCase() === "radio" && n.name === el2.name) all.push(n);
        }
        if (all.some((n) => n.checked) && options.onlyEmpty) {
          st.skipped += 1;
          continue;
        }
        const sample = all[0];
        const sampleBlock = sectionBlockType(sample);
        let key2 = pickKey({
          label: labelText(sample),
          attr: attrText(sample),
          block: sampleBlock,
          hint: fieldHint(sample),
          allowHint: false
        });
        if (!key2) {
          key2 = pickKey({
            label: visibleText(rowContainer(sample), 80),
            attr: "",
            block: sampleBlock,
            hint: fieldHint(sample),
            allowHint: true
          });
        }
        if (!key2) continue;
        const want = norm(valueForField(key2, profile, 1));
        if (!want) continue;
        let hit = null;
        for (let k = 0; k < all.length; k += 1) {
          const n = all[k];
          const own = norm(labelText(n) + " " + visibleText(n.parentElement, 50) + " " + (n.value || ""));
          if (own && (own === want || own.indexOf(want) >= 0)) {
            hit = n;
            break;
          }
        }
        if (hit) {
          hit.click();
          st.count += 1;
          st.filled.push(FIELD_NAMES[key2] || key2);
          if (options.highlight) highlight(hit);
        }
        continue;
      }
      const label = labelText(el2);
      const attr = attrText(el2);
      const rowText = visibleText(rowContainer(el2), 160);
      const block = sectionBlockType(el2);
      const rowKey = pickKey({ label: rowText, attr: "", block, hint: fieldHint(el2), allowHint: true });
      if (rowKey && DATE_KEYS[rowKey]) {
        const segGroup = segmentOf(el2);
        if (segGroup && fillSegment(el2, segGroup, rowKey)) continue;
      }
      let key = pickKey({ label, attr, block, hint: fieldHint(el2), allowHint: !label && !attr });
      const cascade = detectCascade(el2, classifyForCascade);
      if (cascade && (cascade.nodes.length > 1 || !key)) {
        if (await runCascade(cascade)) continue;
      }
      let direct = false;
      if (!key) {
        const ex = matchExtra(profile, label, attr, rowText);
        if (ex) {
          key = ex;
          direct = true;
        }
      }
      if (!key && el2.tagName === "SELECT") key = optionsKeyOf(el2);
      if (!key) {
        if (visible(el2) && !alreadyFilled(el2)) {
          const d = describe(el2) || attr.slice(0, 30);
          if (d && st.unknown.indexOf(d) < 0) st.unknown.push(d);
        }
        continue;
      }
      const value = direct ? key.slice(6) : valueForField(key, profile, rowIndexOf(el2, key));
      if (!value) continue;
      if (isRepeatInSection(el2, key)) continue;
      const pair = pairedStart(el2, key);
      if (pair && !alreadyFilled(pair.node)) {
        const pairValue = valueForField(pair.key, profile, rowIndexOf(pair.node, pair.key));
        if (pairValue) await applyValue(pair.node, pair.key, pairValue, options, profile, st);
      }
      if (options.onlyEmpty && alreadyFilled(el2)) {
        st.skipped += 1;
        continue;
      }
      await applyValue(el2, key, value, options, profile, st);
    }
    return st;
  }

  // src/core/messaging.js
  var RUN_MSG = "__resume_autofill_run__";
  var RES_MSG = "__resume_autofill_result__";
  var FRAME_ID = Math.random().toString(36).slice(2);
  function relayToChildren(msg) {
    const kids = window.frames;
    for (let i = 0; i < kids.length; i += 1) {
      try {
        kids[i].postMessage(msg, "*");
      } catch (e) {
      }
    }
  }
  function initMessaging() {
    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d || d.type !== RUN_MSG) return;
      runFill(d.profile || {}, d.options || {}).then((st) => {
        relayToChildren({ type: RUN_MSG, profile: d.profile, options: d.options });
        const payload = {
          type: RES_MSG,
          id: FRAME_ID,
          count: st.count,
          skipped: st.skipped,
          filled: st.filled.slice(0, 30),
          manual: st.manual.slice(0, 20),
          unknown: st.unknown.slice(0, 20)
        };
        try {
          if (IS_TOP) window.postMessage(payload, "*");
          else window.top.postMessage(payload, "*");
        } catch (e) {
        }
      });
    });
  }

  // src/core/block-adder.js
  var ADD_RE = /添加|新增|再加|继续添加|增加一条|添加一条|add/i;
  var SECTION_RE = {
    edu: /教育|学历|院校|学校/,
    work: /工作|实习|职业/,
    cert: /证书|资格/,
    patent: /专利/,
    paper: /论文|期刊/,
    award: /奖励|奖项|荣誉/,
    family: /家庭|亲属/,
    activity: /活动|社团/,
    project: /项目|课题/
  };
  function targetBlockCount(profile, type) {
    const list = profile[GROUP_ARRAYS[type]];
    return Array.isArray(list) ? list.length : 0;
  }
  function findAddButton(type) {
    const re = SECTION_RE[type];
    const nodes = deepQueryAll('button, a, [role="button"]');
    let loose = null;
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (isOurUI(node)) continue;
      const text = String(node.textContent || "").replace(/\s+/g, "");
      if (!text || !ADD_RE.test(text)) continue;
      let cur = node.parentElement;
      for (let depth = 0; depth < 6 && cur; depth += 1) {
        if (re.test(String(cur.textContent || "").slice(0, 400))) return node;
        cur = cur.parentElement;
      }
      if (!loose) loose = node;
    }
    return null;
  }
  async function waitForGrow(type, before, limit) {
    const deadline = Date.now() + limit;
    while (Date.now() < deadline) {
      if (blockContainers(type).length > before) return true;
      await new Promise((r) => setTimeout(r, 120));
    }
    return false;
  }
  async function addMissingBlocks(profile, type) {
    const target = targetBlockCount(profile, type);
    if (target <= 1) return 0;
    let added = 0;
    for (let i = 1; i < target; i += 1) {
      if (blockContainers(type).length >= target) break;
      const btn = findAddButton(type);
      if (!btn) break;
      const before = blockContainers(type).length;
      btn.click();
      if (!await waitForGrow(type, before, 1500)) break;
      added += 1;
    }
    return added;
  }

  // src/core/watcher.js
  var THROTTLE_MS = 600;
  function fillableControls(node) {
    const list = [];
    if (!node || node.nodeType !== 1) return list;
    if (node.matches && node.matches("input, textarea, select")) list.push(node);
    if (node.querySelectorAll) {
      const inside = node.querySelectorAll("input, textarea, select");
      for (let i = 0; i < inside.length; i += 1) list.push(inside[i]);
    }
    return list;
  }
  function hasFillable(node) {
    if (isOurUI(node)) return false;
    const list = fillableControls(node);
    for (let i = 0; i < list.length; i += 1) {
      const el2 = list[i];
      if (isOurUI(el2)) continue;
      const t = (el2.type || "").toLowerCase();
      if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") continue;
      if (pickKey({ label: labelText(el2), attr: attrText(el2), hint: "", allowHint: false })) return true;
      if (String(el2.getAttribute("name") || "").trim()) return true;
    }
    return false;
  }
  function watchNewBlocks(onNewBlocks) {
    if (typeof MutationObserver !== "function") return () => {
    };
    let timer = null;
    const observer = new MutationObserver((records) => {
      let hit = false;
      for (let i = 0; i < records.length && !hit; i += 1) {
        const added = records[i].addedNodes;
        for (let j = 0; j < added.length; j += 1) {
          if (hasFillable(added[j])) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        onNewBlocks();
      }, THROTTLE_MS);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }

  // src/ui/panel.js
  var CSS2 = [
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}',
    ".pill{position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:27px;border:0;cursor:pointer;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:15px;font-weight:600;box-shadow:0 6px 20px rgba(37,99,235,.45);z-index:2147483647}",
    ".pill:hover{transform:translateY(-1px)}",
    ".mask{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(15,23,42,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:18px}",
    ".card{background:#fff;color:#0f172a;border-radius:14px;width:780px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}",
    ".hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;background:#fff;z-index:2}",
    ".hd b{font-size:15px}",
    ".bd{padding:16px 18px}",
    ".row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
    ".btn{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}",
    ".btn:hover{background:#f1f5f9}",
    ".btn.primary{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}",
    ".btn.primary:hover{background:#1d4ed8}",
    ".btn.ghost{border-color:transparent;color:#64748b}",
    ".btn:disabled{opacity:.6;cursor:default}",
    "select.btn{padding:7px 8px}",
    ".status{font-size:13px;color:#475569;margin:8px 0;line-height:1.6}",
    ".ok{color:#15803d;font-weight:600}",
    ".warn{color:#b45309;font-weight:600}",
    "h4{margin:18px 0 8px;font-size:13px;color:#334155;border-left:3px solid #2563eb;padding-left:8px}",
    ".grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
    ".f{display:flex;flex-direction:column;gap:4px}",
    ".f.wide{grid-column:span 3}",
    ".f label{font-size:12px;color:#64748b}",
    ".f input,.f select,.f textarea{border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:13px;width:100%;background:#fff;color:#0f172a;font-family:inherit}",
    ".f textarea{min-height:78px;resize:vertical;line-height:1.55}",
    ".list{font-size:12px;color:#475569;line-height:1.75;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:6px;max-height:170px;overflow:auto;white-space:pre-wrap}",
    ".tip{font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.6}",
    ".extra{display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;margin-bottom:6px}",
    ".extra input{border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:12px;width:100%}",
    ".x{border:0;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:15px}",
    ".hidden{display:none}",
    ".block{border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:10px;background:#f8fafc}",
    ".region{display:flex;gap:6px;flex-wrap:wrap}",
    ".region select,.region input{flex:1 1 90px;min-width:80px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:13px;background:#fff;color:#0f172a}",
    ".block-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#64748b;font-weight:600}"
  ].join("");
  var FORM_GROUPS = [
    ["基本信息", [
      ["name", "姓名", "text"],
      ["englishName", "英文名/拼音", "text"],
      ["gender", "性别", "select", ["", "男", "女"]],
      ["birthday", "出生日期", "date"],
      ["nation", "民族", "text"],
      ["politicalStatus", "政治面貌", "select", ["", "中共党员", "中共预备党员", "共青团员", "民主党派", "群众"]],
      ["maritalStatus", "婚姻状况", "select", ["", "未婚", "已婚", "离异"]],
      ["idType", "证件类型", "select", ["", "身份证", "护照", "军官证", "香港身份证", "澳门身份证", "台湾身份证", "台胞证", "其他"]],
      ["idCard", "身份证号", "text"],
      ["phoneCountry", "手机号国家 / 地区", "select", ["", "中国大陆", "中国香港", "中国澳门", "中国台湾", "其他"]],
      ["phone", "手机号", "text"],
      ["email", "邮箱", "text"],
      ["wechat", "微信号", "text"],
      ["hometown", "籍贯", "region"],
      ["hukou", "户口所在地", "region"],
      ["hukouType", "户口类型", "text", "如 家庭户口 / 学校集体户口"],
      ["currentCity", "现居城市", "region"],
      ["zipcode", "邮编", "text"],
      ["address", "详细地址", "text"],
      ["health", "健康状况", "select", ["", "健康", "良好", "有病史"]],
      ["gaokaoOrigin", "高考生源地", "region"],
      ["isFreshGraduate", "是否应届毕业生", "select", ["", "是", "否"]]
    ]],
    ["求职意向", [
      ["applyPosition", "意向岗位", "text"],
      ["expectCity", "意向城市", "text"],
      ["expectSalary", "期望薪资", "text"],
      ["availableDate", "到岗时间", "date"],
      ["jobType", "期望工作性质", "select", ["", "全职", "兼职", "实习"]],
      ["adjust", "是否服从调剂", "select", ["", "是", "否"]],
      ["source", "获知渠道", "text", "如 公司官网"],
      ["referralCode", "内推码", "text"],
      ["website", "个人网站/博客", "text"],
      ["github", "GitHub/开源", "text"]
    ]],
    ["语言、技能与爱好", [
      ["englishLevel", "英语水平", "select", ["", "普通", "良好", "精通", "熟练"]],
      ["otherLanguages", "其他外语水平及成绩", "text"],
      ["itSkills", "IT 技能掌握程度", "text"],
      ["hobbies", "个人爱好", "text"]
    ]],
    ["其他常用长文本", [
      ["selfEvaluation", "自我评价", "textarea"],
      ["skills", "专业技能", "textarea"]
    ]],
    ["紧急联系人", [
      ["emergencyName", "姓名", "text"],
      ["emergencyRelation", "与本人关系", "text"],
      ["emergencyPhone", "电话", "text"]
    ]]
  ];
  var shadow = null;
  var app = null;
  var data = null;
  var draft = null;
  var view = "main";
  var lastReport = null;
  var settings = {
    onlyEmpty: true,
    autoConsent: false,
    highlight: true,
    fillDatePickers: true,
    autoFillNewBlocks: true,
    addMissingBlocks: false
  };
  var filling = false;
  var stopWatch = null;
  function initPanel(initialData) {
    data = initialData;
  }
  var regionPickerSeq = 0;
  function regionPicker(value, setValue) {
    regionPickerSeq += 1;
    const areaListId = "ra-areas-" + regionPickerSeq;
    const parsed = splitAddress(value);
    const box = el("div", "region");
    const makeSelect = (placeholder) => {
      const s = el("select");
      const empty = el("option", null, placeholder);
      empty.value = "";
      s.appendChild(empty);
      return s;
    };
    const provSel = makeSelect("省");
    const citySel = makeSelect("市");
    const detail = el("input");
    detail.type = "text";
    detail.placeholder = "详细地址（可选）";
    detail.value = parsed.detail || "";
    const areaInput = el("input");
    areaInput.type = "text";
    areaInput.placeholder = "区 / 县";
    areaInput.value = parsed.district || "";
    areaInput.setAttribute("list", areaListId);
    const areaList = el("datalist");
    areaList.id = areaListId;
    const fillAreas = (cityCode) => {
      areaList.innerHTML = "";
      const areas = REGIONS[cityCode] || {};
      Object.keys(areas).forEach((code) => {
        const option = el("option");
        option.value = areas[code];
        areaList.appendChild(option);
      });
    };
    const codeOf = (map, name) => Object.keys(map).find((code) => map[code] === name) || "";
    const fillSelect = (sel, map, placeholder, current) => {
      sel.innerHTML = "";
      const empty = el("option", null, placeholder);
      empty.value = "";
      sel.appendChild(empty);
      Object.keys(map).forEach((code) => {
        const option = el("option", null, map[code]);
        option.value = code;
        sel.appendChild(option);
      });
      sel.value = codeOf(map, current) || "";
    };
    const emit = () => {
      const province = provSel.value ? REGIONS["86"][provSel.value] : "";
      const city = citySel.value ? (REGIONS[provSel.value] || {})[citySel.value] || "" : "";
      setValue([province, city].join("") + areaInput.value.trim() + detail.value.trim());
    };
    const provinces = REGIONS["86"] || {};
    fillSelect(provSel, provinces, "省", parsed.province);
    fillSelect(citySel, REGIONS[provSel.value] || {}, "市", parsed.city);
    fillAreas(citySel.value);
    provSel.onchange = () => {
      fillSelect(citySel, REGIONS[provSel.value] || {}, "市", "");
      fillAreas("");
      emit();
    };
    citySel.onchange = () => {
      fillAreas(citySel.value);
      emit();
    };
    areaInput.oninput = emit;
    detail.oninput = emit;
    box.appendChild(provSel);
    box.appendChild(citySel);
    box.appendChild(areaInput);
    box.appendChild(areaList);
    box.appendChild(detail);
    return box;
  }
  function makeFieldControl(type, extra, value, setValue) {
    if (type === "region") return regionPicker(value, setValue);
    if (type === "select") {
      const inp2 = el("select");
      (extra || [""]).forEach((o) => {
        const op = el("option", null, o === "" ? "（不填）" : o);
        op.value = o;
        inp2.appendChild(op);
      });
      inp2.value = value == null ? "" : String(value);
      inp2.onchange = () => setValue(inp2.value);
      return inp2;
    }
    if (type === "textarea") {
      const inp2 = el("textarea");
      inp2.value = value == null ? "" : String(value);
      inp2.oninput = () => setValue(inp2.value);
      return inp2;
    }
    if (type === "date") {
      const inp2 = el("input");
      inp2.type = "date";
      inp2.value = value == null ? "" : String(value);
      inp2.oninput = () => setValue(inp2.value);
      return inp2;
    }
    const inp = el("input");
    inp.type = "text";
    if (extra) inp.placeholder = extra;
    inp.value = value == null ? "" : String(value);
    inp.oninput = () => setValue(inp.value);
    return inp;
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function build() {
    if (!IS_TOP || document.getElementById(UI_ID)) return;
    const host = document.createElement("div");
    host.id = UI_ID;
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS2;
    shadow.appendChild(style);
    app = el("div");
    shadow.appendChild(app);
    document.documentElement.appendChild(host);
    render();
  }
  function render() {
    if (!app) return;
    app.innerHTML = "";
    if (view === "main") renderPill();
    else renderPanel();
  }
  function renderPill() {
    const b = el("button", "pill", "填表");
    b.title = "简历自动填充（Alt+Shift+F）";
    b.onclick = () => {
      view = "panel";
      render();
    };
    app.appendChild(b);
  }
  function closePanel() {
    view = "main";
    render();
  }
  function renderPanel() {
    const mask = el("div", "mask");
    mask.onclick = (e) => {
      if (e.target === mask) closePanel();
    };
    const card = el("div", "card");
    mask.appendChild(card);
    app.appendChild(mask);
    const hd = el("div", "hd");
    hd.appendChild(el("b", null, view === "edit" ? "编辑资料" : "简历自动填充"));
    const right = el("div", "row");
    if (view === "edit") {
      const back = el("button", "btn", "保存并返回");
      back.onclick = () => {
        saveDraft();
        view = "panel";
        render();
      };
      right.appendChild(back);
    }
    const x = el("button", "btn ghost", "✕");
    x.onclick = closePanel;
    right.appendChild(x);
    hd.appendChild(right);
    card.appendChild(hd);
    const bd = el("div", "bd");
    card.appendChild(bd);
    if (view === "edit") renderEditor(bd);
    else renderMain(bd);
  }
  function renderMain(bd) {
    const names = Object.keys(data.profiles);
    const row1 = el("div", "row");
    row1.appendChild(el("span", "tip", "资料方案"));
    const sel = el("select", "btn");
    names.forEach((n) => {
      const o = el("option", null, n);
      o.value = n;
      sel.appendChild(o);
    });
    sel.value = data.current;
    sel.onchange = () => {
      data.current = sel.value;
      saveData(data);
      lastReport = null;
      render();
    };
    row1.appendChild(sel);
    const bNew = el("button", "btn", "复制一份");
    bNew.title = "以当前方案为模板，建一套新资料（比如投后端岗用）";
    bNew.onclick = () => {
      let n = "";
      try {
        n = (prompt("新方案的名字：", data.current + " 副本") || "").trim();
      } catch (e) {
        n = "";
      }
      if (!n) return;
      if (data.profiles[n]) {
        alert("这个名字已经存在了");
        return;
      }
      data.profiles[n] = JSON.parse(JSON.stringify(data.profiles[data.current] || {}));
      data.current = n;
      saveData(data);
      lastReport = null;
      render();
    };
    row1.appendChild(bNew);
    const bRename = el("button", "btn", "重命名");
    bRename.onclick = () => {
      let n = "";
      try {
        n = (prompt("改成什么名字：", data.current) || "").trim();
      } catch (e) {
        n = "";
      }
      if (!n || n === data.current) return;
      if (data.profiles[n]) {
        alert("这个名字已经存在了");
        return;
      }
      data.profiles[n] = data.profiles[data.current];
      delete data.profiles[data.current];
      data.current = n;
      saveData(data);
      render();
    };
    row1.appendChild(bRename);
    const bDel = el("button", "btn", "删除");
    bDel.onclick = () => {
      if (Object.keys(data.profiles).length <= 1) {
        alert("至少要留一套资料");
        return;
      }
      let ok = true;
      try {
        ok = confirm("确定删除方案「" + data.current + "」？");
      } catch (e) {
        ok = true;
      }
      if (!ok) return;
      delete data.profiles[data.current];
      data.current = Object.keys(data.profiles)[0];
      saveData(data);
      render();
    };
    row1.appendChild(bDel);
    bd.appendChild(row1);
    if (profileIsEmpty(data.profiles[data.current] || {})) {
      const empty = el("div", "status warn");
      empty.style.marginTop = "12px";
      empty.textContent = "这套资料还是空的：点下面「载入资料文件」选同目录的「我的资料.json」，或点「编辑资料」手动填一份。";
      bd.appendChild(empty);
    }
    const fillBtn = el("button", "btn primary", "一键填充本页表单");
    fillBtn.style.cssText = "margin-top:14px;padding:10px 18px;font-size:14px;width:100%";
    fillBtn.onclick = () => {
      doFill(fillBtn);
    };
    bd.appendChild(fillBtn);
    const opts = el("div");
    opts.style.marginTop = "10px";
    const mkOpt = (label, key) => {
      const wrap = el("label", "status");
      wrap.style.display = "block";
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = !!settings[key];
      cb.onchange = () => {
        settings[key] = cb.checked;
      };
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(" " + label));
      return wrap;
    };
    opts.appendChild(mkOpt("只填空白字段（不覆盖我已经填好的内容）", "onlyEmpty"));
    opts.appendChild(mkOpt("自动勾选「我已阅读并同意」这类条款", "autoConsent"));
    opts.appendChild(mkOpt("日期选择器自动点开弹层选日期", "fillDatePickers"));
    opts.appendChild(mkOpt("页面上新出现的编辑框自动填（点「添加」之后出现的那些）", "autoFillNewBlocks"));
    opts.appendChild(mkOpt("资料里有几段经历就自动点「添加」补几段", "addMissingBlocks"));
    bd.appendChild(opts);
    if (lastReport) {
      const box = el("div");
      const s1 = el("div", "status");
      s1.innerHTML = '<span class="ok">已填好 ' + lastReport.count + " 项</span>";
      box.appendChild(s1);
      if (!lastReport.count && lastReport.skipped) {
        box.appendChild(el("div", "tip", "页面上有 " + lastReport.skipped + " 个字段本来就有内容，按「只填空白字段」这一项跳过了。想覆盖就把那个勾去掉再点一次。"));
      }
      if (!lastReport.count && !lastReport.skipped && !lastReport.unknown.length) {
        box.appendChild(el("div", "tip", "这一页没有找到能填的字段：表格可能在别的框架里，也可能字段名没能认出来（换一页再点一次，或者打开需要手动处理的那些看看）。"));
      }
      if (lastReport.filled.length) box.appendChild(el("div", "list", lastReport.filled.join("　·　")));
      if (lastReport.manual.length) {
        box.appendChild(el("div", "status warn", "需要你手动处理 " + lastReport.manual.length + " 项"));
        box.appendChild(el("div", "list", lastReport.manual.join("\n")));
      }
      if (lastReport.unknown.length) {
        box.appendChild(el("div", "status warn", "没认出来的字段 " + lastReport.unknown.length + " 个"));
        box.appendChild(el("div", "list", lastReport.unknown.join("　·　")));
        box.appendChild(el("div", "tip", "如果这些字段你想自动填，点下面的「编辑资料」→ 最底部「补充规则」，照着写一条就行。"));
      }
      bd.appendChild(box);
    }
    const foot = el("div", "row");
    foot.style.marginTop = "16px";
    const bEdit = el("button", "btn", "编辑资料");
    bEdit.onclick = () => {
      draft = JSON.parse(JSON.stringify(data.profiles[data.current] || {}));
      view = "edit";
      render();
    };
    foot.appendChild(bEdit);
    const bLoad = el("button", "btn", "载入资料文件");
    bLoad.title = "选择「我的资料.json」，用它覆盖当前方案";
    bLoad.onclick = importFile;
    foot.appendChild(bLoad);
    const bSave = el("button", "btn", "导出资料文件");
    bSave.title = "把全部方案存成 我的资料.json";
    bSave.onclick = exportFile;
    foot.appendChild(bSave);
    bd.appendChild(foot);
    bd.appendChild(el("div", "tip", "资料只存在你自己的浏览器里，不会上传到任何地方。"));
  }
  function renderEditor(bd) {
    FORM_GROUPS.forEach((group) => {
      bd.appendChild(el("h4", null, group[0]));
      const grid = el("div", "grid");
      group[1].forEach((f) => {
        const key = f[0];
        const label = f[1];
        const type = f[2];
        const extra = f[3];
        const wrap = el("div", "f" + (type === "textarea" || type === "region" ? " wide" : ""));
        wrap.appendChild(el("label", null, label));
        wrap.appendChild(makeFieldControl(type, extra, draft[key], (v) => {
          draft[key] = v;
        }));
        grid.appendChild(wrap);
      });
      bd.appendChild(grid);
    });
    renderBlocks(bd, "educations", "教育经历", "一段一张卡片，按网页上的顺序排：网页上第一段教育经历填这里的第一张卡片。点「+ 加一段」可以再加。", EDU_ITEM_FORM);
    renderBlocks(bd, "works", "工作 / 实习经历", "一段一张卡片，顺序同上。", WORK_ITEM_FORM);
    renderBlocks(bd, "certificates", "证书", "一张卡片一项证书。", CERT_ITEM_FORM);
    renderBlocks(bd, "patents", "专利", "一张卡片一项专利。", PATENT_ITEM_FORM);
    renderBlocks(bd, "papers", "论文", "一张卡片一篇论文。", PAPER_ITEM_FORM);
    renderBlocks(bd, "awards", "奖励与荣誉", "一张卡片一项奖励。", AWARD_ITEM_FORM);
    renderBlocks(bd, "projects", "项目经历", "一张卡片一个项目。", PROJECT_ITEM_FORM);
    renderBlocks(bd, "activities", "社团与活动", "一张卡片一项活动经历。", ACTIVITY_ITEM_FORM);
    renderBlocks(bd, "family", "家庭关系", "一张卡片一位家庭成员。", FAMILY_ITEM_FORM);
    bd.appendChild(el("h4", null, "补充规则（认不出来的字段写这里）"));
    const extraBox = el("div");
    bd.appendChild(extraBox);
    renderExtras(extraBox);
    bd.appendChild(el("div", "tip", "左边写网页上那个字段旁边的字，右边写要填的内容。比如左边写「期望岗位」，右边写「AI应用工程师」。"));
    const foot = el("div", "row");
    foot.style.marginTop = "18px";
    const bSave = el("button", "btn primary", "保存并返回");
    bSave.onclick = () => {
      saveDraft();
      view = "panel";
      render();
    };
    foot.appendChild(bSave);
    const bReset = el("button", "btn", "放弃本次修改");
    bReset.onclick = () => {
      view = "panel";
      render();
    };
    foot.appendChild(bReset);
    bd.appendChild(foot);
  }
  function renderExtras(container) {
    container.innerHTML = "";
    if (!draft.extra) draft.extra = [];
    const list = draft.extra;
    list.forEach((item, i) => {
      const row = el("div", "extra");
      const a = el("input");
      a.placeholder = "网页上那个字段的文字";
      a.value = item.match || "";
      a.oninput = () => {
        item.match = a.value;
      };
      const b = el("input");
      b.placeholder = "要填进去的内容";
      b.value = item.value || "";
      b.oninput = () => {
        item.value = b.value;
      };
      const x = el("button", "x", "×");
      x.onclick = () => {
        list.splice(i, 1);
        renderExtras(container);
      };
      row.appendChild(a);
      row.appendChild(b);
      row.appendChild(x);
      container.appendChild(row);
    });
    const add = el("button", "btn", "+ 加一条");
    add.onclick = () => {
      list.push({ match: "", value: "" });
      renderExtras(container);
    };
    container.appendChild(add);
  }
  function renderBlocks(bd, key, title, tip, form) {
    if (!Array.isArray(draft[key])) draft[key] = [];
    bd.appendChild(el("h4", null, title));
    bd.appendChild(el("div", "tip", tip));
    const box = el("div");
    box.style.marginTop = "8px";
    bd.appendChild(box);
    renderBlockList(box, key, form);
  }
  function renderBlockList(box, key, form) {
    box.innerHTML = "";
    const list = draft[key];
    list.forEach((item, index) => {
      const block = el("div", "block");
      const hd = el("div", "block-hd");
      hd.appendChild(el("span", null, "第 " + (index + 1) + " 段"));
      const del = el("button", "x", "×");
      del.onclick = () => {
        list.splice(index, 1);
        renderBlockList(box, key, form);
      };
      hd.appendChild(del);
      block.appendChild(hd);
      const grid = el("div", "grid");
      form.forEach((f) => {
        const field = f[0];
        const label = f[1];
        const type = f[2];
        const extra = f[3];
        const wrap = el("div", "f" + (type === "textarea" ? " wide" : ""));
        wrap.appendChild(el("label", null, label));
        wrap.appendChild(makeFieldControl(type, extra, item[field], (v) => {
          item[field] = v;
        }));
        grid.appendChild(wrap);
      });
      block.appendChild(grid);
      box.appendChild(block);
    });
    const add = el("button", "btn", "+ 加一段");
    add.onclick = () => {
      list.push({});
      renderBlockList(box, key, form);
    };
    box.appendChild(add);
  }
  function saveDraft() {
    if (!draft) return;
    data.profiles[data.current] = draft;
    saveData(data);
    lastReport = null;
  }
  function profileIsEmpty(p) {
    return !String(p.name || "").trim() && !String(p.phone || "").trim() && !String(p.email || "").trim();
  }
  async function doFill(btn) {
    const profile = data.profiles[data.current] || {};
    if (profileIsEmpty(profile)) {
      alert("这套资料还是空的：请先点「载入资料文件」选同目录的「我的资料.json」，或者点「编辑资料」手动填一份。");
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "正在填…";
    }
    filling = true;
    if (settings.addMissingBlocks) {
      const groups = Object.keys(GROUP_ARRAYS);
      for (let i = 0; i < groups.length; i += 1) await addMissingBlocks(profile, groups[i]);
    }
    const got = [];
    const onMsg = (ev) => {
      const d = ev.data;
      if (d && d.type === RES_MSG && d.id !== FRAME_ID) got.push(d);
    };
    window.addEventListener("message", onMsg);
    try {
      const mine = await runFill(profile, settings);
      got.push({
        id: FRAME_ID,
        count: mine.count,
        skipped: mine.skipped,
        filled: mine.filled,
        manual: mine.manual,
        unknown: mine.unknown
      });
      relayToChildren({ type: RUN_MSG, profile, options: settings });
      await sleep(1700);
    } catch (e) {
      got.push({ count: 0, skipped: 0, filled: [], manual: ["填充出错：" + (e && e.message ? e.message : e)], unknown: [] });
    } finally {
      window.removeEventListener("message", onMsg);
      filling = false;
    }
    const uniq = (arr) => {
      const seen = {};
      const out = [];
      arr.forEach((v) => {
        if (v && !seen[v]) {
          seen[v] = 1;
          out.push(v);
        }
      });
      return out;
    };
    lastReport = {
      count: got.reduce((a, b) => a + (b.count || 0), 0),
      skipped: got.reduce((a, b) => a + (b.skipped || 0), 0),
      filled: uniq([].concat.apply([], got.map((g) => g.filled || []))),
      manual: uniq([].concat.apply([], got.map((g) => g.manual || []))),
      unknown: uniq([].concat.apply([], got.map((g) => g.unknown || [])))
    };
    if (btn) {
      btn.disabled = false;
    }
    render();
  }
  function fillCurrentPage() {
    return doFill(null);
  }
  function importFile() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          data = assertData(JSON.parse(String(fr.result)));
          saveData(data);
          lastReport = null;
          render();
        } catch (e) {
          alert("资料文件读不进去：" + (e && e.message ? e.message : e));
        }
      };
      fr.readAsText(f, "utf-8");
    };
    inp.click();
  }
  function exportFile() {
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "我的资料.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 8e3);
  }
  function startAutoFill() {
    if (stopWatch) return;
    stopWatch = watchNewBlocks(() => {
      if (!settings.autoFillNewBlocks || filling || !data) return;
      const profile = data.profiles[data.current] || {};
      if (profileIsEmpty(profile)) return;
      filling = true;
      runFill(profile, settings).then((st) => {
        if (!st.count) return;
        lastReport = {
          count: st.count,
          skipped: st.skipped,
          filled: st.filled.slice(0, 30),
          manual: st.manual.slice(0, 20),
          unknown: st.unknown.slice(0, 20)
        };
        if (app) render();
      }).finally(() => {
        filling = false;
      });
    });
  }
  function forceShow() {
    if (!document.getElementById(UI_ID)) build();
    view = "panel";
    render();
  }

  // src/main.js
  initMessaging();
  function looksLikeForm() {
    const nodes = deepQueryAll("input, textarea");
    let n = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const t = (node.type || "").toLowerCase();
      if (t === "text" || t === "email" || t === "tel" || node.tagName === "TEXTAREA") {
        if (visible(node)) n += 1;
        if (n >= 4) return true;
      }
    }
    return false;
  }
  function bootstrap() {
    if (!IS_TOP) return;
    initPanel(loadData());
    let tries = 0;
    const tick = () => {
      if (document.getElementById(UI_ID)) return;
      if (looksLikeForm()) {
        build();
        return;
      }
      tries += 1;
      if (tries < 6) setTimeout(tick, 1800);
    };
    tick();
    startAutoFill();
    try {
      GM_registerMenuCommand("简历自动填充：打开面板", forceShow);
      GM_registerMenuCommand("简历自动填充：立即填一遍", () => {
        forceShow();
        fillCurrentPage();
      });
    } catch (e) {
    }
    window.addEventListener("keydown", (e) => {
      if (e.altKey && e.shiftKey && String(e.key).toLowerCase() === "f") {
        e.preventDefault();
        forceShow();
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
