// ==UserScript==
// @name         简历自动填充助手
// @name:en      Resume Autofill Helper
// @namespace    local.resume.autofill
// @version      1.8.0
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
    { key: "familyName", re: /家庭成员姓名|家属姓名|亲属姓名|^姓名$/, ctx: ["family"] },
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
    { key: "major", re: /所学专业|专业名称|^专业$|专业|major|fieldofstudy|discipline/, neg: /专业方向|专业类别|专业排名|转专业|专业技能|专业资格/ },
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
        const okTag = tag === "LABEL" || tag === "TD" || tag === "TH" || tag === "SPAN" || tag === "DIV" || tag === "P" || tag === "B" || tag === "STRONG" || tag === "EM";
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
    return cs.display !== "none" && cs.visibility !== "hidden";
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
  function setVal(el2, value) {
    let proto = HTMLInputElement.prototype;
    if (el2 instanceof HTMLTextAreaElement) proto = HTMLTextAreaElement.prototype;
    else if (el2 instanceof HTMLSelectElement) proto = HTMLSelectElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el2, value);
    else el2.value = value;
    el2.dispatchEvent(new Event("input", { bubbles: true }));
    el2.dispatchEvent(new Event("change", { bubbles: true }));
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

  // src/core/address.js
  var PROVINCE_RE = /^(北京市|上海市|天津市|重庆市|.{2,10}?(?:省|自治区|特别行政区))/;
  var CITY_RE = /^(.{2,10}?(?:市|自治州|地区|盟))/;
  var AREA_RE = /^(.{1,12}?(?:自治县|自治旗|区|县|旗|市))/;
  function splitAddress(value) {
    let rest = String(value == null ? "" : value).trim();
    const out = { province: "", city: "", district: "", detail: "" };
    const m1 = rest.match(PROVINCE_RE);
    if (m1) {
      out.province = m1[1];
      rest = rest.slice(out.province.length).trim();
    }
    const m2 = rest.match(CITY_RE);
    if (m2) {
      out.city = m2[1];
      rest = rest.slice(out.city.length).trim();
    }
    const m3 = rest.match(AREA_RE);
    if (m3) {
      out.district = m3[1];
      rest = rest.slice(out.district.length).trim();
    }
    out.detail = rest;
    return out;
  }
  function addressRole(el2) {
    const label = norm(labelText(el2));
    const attr = norm(String(el2.getAttribute("name") || "") + String(el2.getAttribute("id") || "") + String(el2.getAttribute("placeholder") || ""));
    if (/province|sheng/.test(attr)) return "province";
    if (/city|shi/.test(attr)) return "city";
    if (/district|area|county|qu|area/.test(attr)) return "district";
    if (/^省$|省份|所在省|请选择省/.test(label)) return "province";
    if (/^市$|所在市|请选择市/.test(label)) return "city";
    if (/^区$|^县$|区县|所在区|请选择区|请选择县/.test(label)) return "district";
    return "";
  }
  function usable(node) {
    if (!node || !node.tagName) return false;
    if (node.disabled || node.readOnly) return false;
    if ((node.type || "").toLowerCase() === "hidden") return false;
    return !isOurUI(node);
  }
  function addressSegmentGroup(el2) {
    const row = rowContainer(el2);
    if (!row || !row.querySelectorAll) return null;
    const nodes = [];
    const inside = row.querySelectorAll("input, select");
    for (let i = 0; i < inside.length; i += 1) {
      if (usable(inside[i])) nodes.push(inside[i]);
    }
    if (nodes.length < 2 || nodes.length > 3) return null;
    const roles = nodes.map((node) => addressRole(node));
    const taken = {};
    for (let i = 0; i < roles.length; i += 1) {
      if (roles[i] && !taken[roles[i]]) taken[roles[i]] = 1;
      else roles[i] = "";
    }
    const fallback = nodes.length === 3 ? ["province", "city", "district"] : ["province", "city"];
    for (let i = 0; i < roles.length; i += 1) {
      if (roles[i]) continue;
      const pick = fallback.filter((r) => !taken[r])[0];
      if (!pick) return null;
      roles[i] = pick;
      taken[pick] = 1;
    }
    if (!taken.province || !taken.city) return null;
    return { row, nodes, roles };
  }
  async function bestOptionWithWait(select, want, tries) {
    const rounds = tries || 4;
    for (let i = 0; i < rounds; i += 1) {
      const idx = bestOptionIndex(select, want, false);
      if (idx >= 0) return idx;
      await sleep(200);
    }
    return -1;
  }
  async function fillAddressSegment(group, address) {
    let written = 0;
    let blocked = 0;
    for (let i = 0; i < group.nodes.length; i += 1) {
      const node = group.nodes[i];
      const want = address[group.roles[i]];
      if (!want) continue;
      if (node.tagName === "SELECT") {
        const idx = await bestOptionWithWait(node, want);
        if (idx < 0) {
          blocked += 1;
          continue;
        }
        setVal(node, node.options[idx].value);
      } else {
        setVal(node, want);
      }
      written += 1;
      await sleep(150);
    }
    return { written, blocked };
  }

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
      if (/no-results|search-no/.test(String(node.className || ""))) continue;
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
    const wrap = el2.closest && el2.closest(".bootstrap-select") || el2.parentElement;
    const toggle = wrap && wrap.querySelector('button.dropdown-toggle, [data-toggle="dropdown"]');
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
  var PICKER_INPUT = 'input[readonly][school-or-subject="1"]';
  var PICKER_PANEL = ".search-result-li, .school-m, .school-b, .main-data";
  var PICKER_ITEM = ".search-result-li li, .search-result-li a, .school-m li, .school-m a, .school-b li, .school-b a, .main-data li, .main-data a, .main-data p, .main-data span";
  function pickerRoot(el2) {
    let node = el2.parentElement;
    for (let i = 0; node && node !== document.body && i < 10; i += 1) {
      if (node.querySelector && node.querySelector(PICKER_INPUT) && node.querySelector(PICKER_PANEL)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function isModalPicker(el2) {
    if (!el2 || el2.tagName !== "INPUT" || !el2.readOnly) return false;
    if (el2.getAttribute("school-or-subject") !== "1") return false;
    return !!pickerRoot(el2);
  }
  function isPickerHelper(el2) {
    if (!el2 || el2.tagName !== "INPUT" || el2.readOnly) return false;
    return !!pickerRoot(el2);
  }
  function pickerCandidates(root) {
    const list = root.querySelectorAll(PICKER_ITEM);
    const out = [];
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (isOurUI(node) || !visible(node)) continue;
      if (/no-results|search-no|model-close/.test(String(node.className || ""))) continue;
      out.push(node);
    }
    return out;
  }
  async function fillModalPicker(el2, value) {
    const want = String(value == null ? "" : value).trim();
    if (!want) return false;
    const root = pickerRoot(el2);
    if (!root) return false;
    clickNode(el2);
    await sleep(300);
    const box = root.querySelector(".search-school, .search-job");
    if (box) setVal(box, want);
    const model = root.querySelector('input[school-or-subject="2"]');
    for (let i = 0; i < 12; i += 1) {
      const hit = pickOption(pickerCandidates(root), want);
      if (hit) {
        clickNode(hit);
        for (let k = 0; k < 10; k += 1) {
          await sleep(120);
          if (String(el2.value || "").trim()) return true;
          if (model && norm(model.value) === norm(want)) return true;
        }
        return false;
      }
      await sleep(180);
    }
    return false;
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
  function clickNode2(node) {
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
    clickNode2(innermost(hits));
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
        clickNode2(innermost(hits));
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
      clickNode2(list[i]);
      return true;
    }
    return false;
  }
  function clickNext(panel) {
    const list = panel.querySelectorAll('[class*="next"]');
    for (let i = 0; i < list.length; i += 1) {
      const cls = String(list[i].className || "");
      if (/prev/.test(cls) && !/next/.test(cls)) continue;
      clickNode2(list[i]);
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
  function usable2(node) {
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
      if (usable2(inside[i])) nodes.push(inside[i]);
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
        for (let i = 0; i < sigs.length; i += 1) {
          for (let j = i + 1; j < sigs.length; j += 1) {
            if (sigs[i].some((k) => sigs[j].indexOf(k) >= 0)) return { node, blocks };
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
  function alreadyFilled(el2) {
    if (el2.tagName === "SELECT") {
      return !!(el2.value && el2.selectedIndex > 0 && String(el2.options[el2.selectedIndex].text).trim());
    }
    return !!String(el2.value || "").trim();
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
  function addressValueFor(el2, value) {
    const addr = splitAddress(value);
    const role = addressRole(el2);
    if (role === "city") return addr.city || addr.province;
    if (role === "district") return addr.district || addr.city || addr.province;
    return addr.province || String(value || "").trim();
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
    if (isModalPicker(el2)) {
      if (await fillModalPicker(el2, value)) {
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
    setVal(el2, out);
    if (!String(el2.value || "").trim()) {
      st.manual.push(name + "：控件不接受这个格式，请手动填写");
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
    const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0 };
    const nodes = deepQueryAll("input, textarea, select");
    const handled = /* @__PURE__ */ new Set();
    const segments = /* @__PURE__ */ new Map();
    const skipNode = (el2) => {
      if (isOurUI(el2)) return true;
      if (isPickerHelper(el2)) return true;
      if (options.fillDatePickers && el2.tagName === "INPUT" && el2.readOnly && isDatePicker(el2)) return false;
      if (el2.tagName === "INPUT" && el2.readOnly && isModalPicker(el2)) return false;
      return shouldSkip(el2);
    };
    const indexCache = /* @__PURE__ */ new Map();
    const rowIndexOf = (el2, key) => {
      const group = groupOf(key);
      if (!group) return 1;
      if (!indexCache.has(el2)) indexCache.set(el2, blockIndexOf(el2, group));
      return indexCache.get(el2);
    };
    const segmentOf = (el2) => {
      const row = rowContainer(el2);
      if (!row) return null;
      if (!segments.has(row)) segments.set(row, dateSegmentGroup(el2));
      return segments.get(row);
    };
    const addressGroups = /* @__PURE__ */ new Map();
    const addressGroupOf = (el2) => {
      const row = rowContainer(el2);
      if (!row) return null;
      if (!addressGroups.has(row)) addressGroups.set(row, addressSegmentGroup(el2));
      return addressGroups.get(row);
    };
    const fillAddressGroup = async (group, key) => {
      const name = FIELD_NAMES[key] || key;
      const address = splitAddress(valueForField(key, profile, 1));
      if (!address.province && !address.city) return false;
      const res = await fillAddressSegment(group, address);
      group.nodes.forEach((n) => handled.add(n));
      if (res.written) {
        st.count += res.written;
        st.filled.push(name + "（省 / 市 / 区分开填写）");
        if (options.highlight) group.nodes.forEach((n) => highlight(n));
      }
      if (res.blocked) st.manual.push(name + "：省 / 市 / 区控件没有能选中的值，请手动选");
      return res.written > 0 || res.blocked > 0;
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
        if (options.onlyEmpty && alreadyFilled(node)) continue;
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
        if (all.some((n) => n.checked) && options.onlyEmpty) continue;
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
      if (rowKey && ADDRESS_KEYS[rowKey]) {
        const addrGroup = addressGroupOf(el2);
        if (addrGroup && await fillAddressGroup(addrGroup, rowKey)) continue;
      }
      let key = pickKey({ label, attr, block, hint: fieldHint(el2), allowHint: !label && !attr });
      let direct = false;
      if (!key) {
        const ex = matchExtra(profile, label, attr, rowText);
        if (ex) {
          key = ex;
          direct = true;
        }
      }
      if (!key) {
        if (visible(el2) && !alreadyFilled(el2)) {
          const d = describe(el2) || attr.slice(0, 30);
          if (d && st.unknown.indexOf(d) < 0) st.unknown.push(d);
        }
        continue;
      }
      const value = direct ? key.slice(6) : valueForField(key, profile, rowIndexOf(el2, key));
      if (!value) continue;
      const pair = pairedStart(el2, key);
      if (pair && !alreadyFilled(pair.node)) {
        const pairValue = valueForField(pair.key, profile, rowIndexOf(pair.node, pair.key));
        if (pairValue) await applyValue(pair.node, pair.key, pairValue, options, profile, st);
      }
      if (options.onlyEmpty && alreadyFilled(el2)) continue;
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

  // src/core/regions.js
  var REGIONS = {
    "86": { "110000": "北京市", "120000": "天津市", "130000": "河北省", "140000": "山西省", "150000": "内蒙古自治区", "210000": "辽宁省", "220000": "吉林省", "230000": "黑龙江省", "310000": "上海市", "320000": "江苏省", "330000": "浙江省", "340000": "安徽省", "350000": "福建省", "360000": "江西省", "370000": "山东省", "410000": "河南省", "420000": "湖北省", "430000": "湖南省", "440000": "广东省", "450000": "广西壮族自治区", "460000": "海南省", "500000": "重庆市", "510000": "四川省", "520000": "贵州省", "530000": "云南省", "540000": "西藏自治区", "610000": "陕西省", "620000": "甘肃省", "630000": "青海省", "640000": "宁夏回族自治区", "650000": "新疆维吾尔自治区", "710000": "台湾省", "810000": "香港特别行政区", "820000": "澳门特别行政区" },
    "110000": { "110101": "东城区", "110102": "西城区", "110105": "朝阳区", "110106": "丰台区", "110107": "石景山区", "110108": "海淀区", "110109": "门头沟区", "110111": "房山区", "110112": "通州区", "110113": "顺义区", "110114": "昌平区", "110115": "大兴区", "110116": "怀柔区", "110117": "平谷区", "110118": "密云区", "110119": "延庆区" },
    "120000": { "120101": "和平区", "120102": "河东区", "120103": "河西区", "120104": "南开区", "120105": "河北区", "120106": "红桥区", "120110": "东丽区", "120111": "西青区", "120112": "津南区", "120113": "北辰区", "120114": "武清区", "120115": "宝坻区", "120116": "滨海新区", "120117": "宁河区", "120118": "静海区", "120119": "蓟州区" },
    "130000": { "130100": "石家庄市", "130200": "唐山市", "130300": "秦皇岛市", "130400": "邯郸市", "130500": "邢台市", "130600": "保定市", "130700": "张家口市", "130800": "承德市", "130900": "沧州市", "131000": "廊坊市", "131100": "衡水市", "139001": "定州市", "139002": "辛集市" },
    "140000": { "140100": "太原市", "140200": "大同市", "140300": "阳泉市", "140400": "长治市", "140500": "晋城市", "140600": "朔州市", "140700": "晋中市", "140800": "运城市", "140900": "忻州市", "141000": "临汾市", "141100": "吕梁市" },
    "150000": { "150100": "呼和浩特市", "150200": "包头市", "150300": "乌海市", "150400": "赤峰市", "150500": "通辽市", "150600": "鄂尔多斯市", "150700": "呼伦贝尔市", "150800": "巴彦淖尔市", "150900": "乌兰察布市", "152200": "兴安盟", "152500": "锡林郭勒盟", "152900": "阿拉善盟" },
    "210000": { "210100": "沈阳市", "210200": "大连市", "210300": "鞍山市", "210400": "抚顺市", "210500": "本溪市", "210600": "丹东市", "210700": "锦州市", "210800": "营口市", "210900": "阜新市", "211000": "辽阳市", "211100": "盘锦市", "211200": "铁岭市", "211300": "朝阳市", "211400": "葫芦岛市" },
    "220000": { "220100": "长春市", "220200": "吉林市", "220300": "四平市", "220400": "辽源市", "220500": "通化市", "220600": "白山市", "220700": "松原市", "220800": "白城市", "222400": "延边朝鲜族自治州" },
    "230000": { "230100": "哈尔滨市", "230200": "齐齐哈尔市", "230300": "鸡西市", "230400": "鹤岗市", "230500": "双鸭山市", "230600": "大庆市", "230700": "伊春市", "230800": "佳木斯市", "230900": "七台河市", "231000": "牡丹江市", "231100": "黑河市", "231200": "绥化市", "232700": "大兴安岭地区" },
    "310000": { "310101": "黄浦区", "310104": "徐汇区", "310105": "长宁区", "310106": "静安区", "310107": "普陀区", "310109": "虹口区", "310110": "杨浦区", "310112": "闵行区", "310113": "宝山区", "310114": "嘉定区", "310115": "浦东新区", "310116": "金山区", "310117": "松江区", "310118": "青浦区", "310120": "奉贤区", "310151": "崇明区" },
    "320000": { "320100": "南京市", "320200": "无锡市", "320300": "徐州市", "320400": "常州市", "320500": "苏州市", "320600": "南通市", "320700": "连云港市", "320800": "淮安市", "320900": "盐城市", "321000": "扬州市", "321100": "镇江市", "321200": "泰州市", "321300": "宿迁市" },
    "330000": { "330100": "杭州市", "330200": "宁波市", "330300": "温州市", "330400": "嘉兴市", "330500": "湖州市", "330600": "绍兴市", "330700": "金华市", "330800": "衢州市", "330900": "舟山市", "331000": "台州市", "331100": "丽水市" },
    "340000": { "340100": "合肥市", "340200": "芜湖市", "340300": "蚌埠市", "340400": "淮南市", "340500": "马鞍山市", "340600": "淮北市", "340700": "铜陵市", "340800": "安庆市", "341000": "黄山市", "341100": "滁州市", "341200": "阜阳市", "341300": "宿州市", "341500": "六安市", "341600": "亳州市", "341700": "池州市", "341800": "宣城市" },
    "350000": { "350100": "福州市", "350200": "厦门市", "350300": "莆田市", "350400": "三明市", "350500": "泉州市", "350600": "漳州市", "350700": "南平市", "350800": "龙岩市", "350900": "宁德市" },
    "360000": { "360100": "南昌市", "360200": "景德镇市", "360300": "萍乡市", "360400": "九江市", "360500": "新余市", "360600": "鹰潭市", "360700": "赣州市", "360800": "吉安市", "360900": "宜春市", "361000": "抚州市", "361100": "上饶市" },
    "370000": { "370100": "济南市", "370200": "青岛市", "370300": "淄博市", "370400": "枣庄市", "370500": "东营市", "370600": "烟台市", "370700": "潍坊市", "370800": "济宁市", "370900": "泰安市", "371000": "威海市", "371100": "日照市", "371200": "莱芜市", "371300": "临沂市", "371400": "德州市", "371500": "聊城市", "371600": "滨州市", "371700": "菏泽市" },
    "410000": { "410100": "郑州市", "410200": "开封市", "410300": "洛阳市", "410400": "平顶山市", "410500": "安阳市", "410600": "鹤壁市", "410700": "新乡市", "410800": "焦作市", "410900": "濮阳市", "411000": "许昌市", "411100": "漯河市", "411200": "三门峡市", "411300": "南阳市", "411400": "商丘市", "411500": "信阳市", "411600": "周口市", "411700": "驻马店市", "419001": "济源市" },
    "420000": { "420100": "武汉市", "420200": "黄石市", "420300": "十堰市", "420500": "宜昌市", "420600": "襄阳市", "420700": "鄂州市", "420800": "荆门市", "420900": "孝感市", "421000": "荆州市", "421100": "黄冈市", "421200": "咸宁市", "421300": "随州市", "422800": "恩施土家族苗族自治州", "429004": "仙桃市", "429005": "潜江市", "429006": "天门市", "429021": "神农架林区" },
    "430000": { "430100": "长沙市", "430200": "株洲市", "430300": "湘潭市", "430400": "衡阳市", "430500": "邵阳市", "430600": "岳阳市", "430700": "常德市", "430800": "张家界市", "430900": "益阳市", "431000": "郴州市", "431100": "永州市", "431200": "怀化市", "431300": "娄底市", "433100": "湘西土家族苗族自治州" },
    "440000": { "440100": "广州市", "440200": "韶关市", "440300": "深圳市", "440400": "珠海市", "440500": "汕头市", "440600": "佛山市", "440700": "江门市", "440800": "湛江市", "440900": "茂名市", "441200": "肇庆市", "441300": "惠州市", "441400": "梅州市", "441500": "汕尾市", "441600": "河源市", "441700": "阳江市", "441800": "清远市", "441900": "东莞市", "442000": "中山市", "445100": "潮州市", "445200": "揭阳市", "445300": "云浮市" },
    "450000": { "450100": "南宁市", "450200": "柳州市", "450300": "桂林市", "450400": "梧州市", "450500": "北海市", "450600": "防城港市", "450700": "钦州市", "450800": "贵港市", "450900": "玉林市", "451000": "百色市", "451100": "贺州市", "451200": "河池市", "451300": "来宾市", "451400": "崇左市" },
    "460000": { "460100": "海口市", "460200": "三亚市", "460300": "三沙市", "460400": "儋州市", "469001": "五指山市", "469002": "琼海市", "469005": "文昌市", "469006": "万宁市", "469007": "东方市", "469021": "定安县", "469022": "屯昌县", "469023": "澄迈县", "469024": "临高县", "469025": "白沙黎族自治县", "469026": "昌江黎族自治县", "469027": "乐东黎族自治县", "469028": "陵水黎族自治县", "469029": "保亭黎族苗族自治县", "469030": "琼中黎族苗族自治县" },
    "500000": { "500101": "万州区", "500102": "涪陵区", "500103": "渝中区", "500104": "大渡口区", "500105": "江北区", "500106": "沙坪坝区", "500107": "九龙坡区", "500108": "南岸区", "500109": "北碚区", "500110": "綦江区", "500111": "大足区", "500112": "渝北区", "500113": "巴南区", "500114": "黔江区", "500115": "长寿区", "500116": "江津区", "500117": "合川区", "500118": "永川区", "500119": "南川区", "500120": "璧山区", "500151": "铜梁区", "500152": "潼南区", "500153": "荣昌区", "500154": "开州区", "500228": "梁平县", "500229": "城口县", "500230": "丰都县", "500231": "垫江县", "500232": "武隆县", "500233": "忠县", "500235": "云阳县", "500236": "奉节县", "500237": "巫山县", "500238": "巫溪县", "500240": "石柱土家族自治县", "500241": "秀山土家族苗族自治县", "500242": "酉阳土家族苗族自治县", "500243": "彭水苗族土家族自治县" },
    "510000": { "510100": "成都市", "510300": "自贡市", "510400": "攀枝花市", "510500": "泸州市", "510600": "德阳市", "510700": "绵阳市", "510800": "广元市", "510900": "遂宁市", "511000": "内江市", "511100": "乐山市", "511300": "南充市", "511400": "眉山市", "511500": "宜宾市", "511600": "广安市", "511700": "达州市", "511800": "雅安市", "511900": "巴中市", "512000": "资阳市", "513200": "阿坝藏族羌族自治州", "513300": "甘孜藏族自治州", "513400": "凉山彝族自治州" },
    "520000": { "520100": "贵阳市", "520200": "六盘水市", "520300": "遵义市", "520400": "安顺市", "520500": "毕节市", "520600": "铜仁市", "522300": "黔西南布依族苗族自治州", "522600": "黔东南苗族侗族自治州", "522700": "黔南布依族苗族自治州" },
    "530000": { "530100": "昆明市", "530300": "曲靖市", "530400": "玉溪市", "530500": "保山市", "530600": "昭通市", "530700": "丽江市", "530800": "普洱市", "530900": "临沧市", "532300": "楚雄彝族自治州", "532500": "红河哈尼族彝族自治州", "532600": "文山壮族苗族自治州", "532800": "西双版纳傣族自治州", "532900": "大理白族自治州", "533100": "德宏傣族景颇族自治州", "533300": "怒江傈僳族自治州", "533400": "迪庆藏族自治州" },
    "540000": { "540100": "拉萨市", "540200": "日喀则市", "540300": "昌都市", "540400": "林芝市", "540500": "山南市", "542400": "那曲地区", "542500": "阿里地区" },
    "610000": { "610100": "西安市", "610200": "铜川市", "610300": "宝鸡市", "610400": "咸阳市", "610500": "渭南市", "610600": "延安市", "610700": "汉中市", "610800": "榆林市", "610900": "安康市", "611000": "商洛市" },
    "620000": { "620100": "兰州市", "620200": "嘉峪关市", "620300": "金昌市", "620400": "白银市", "620500": "天水市", "620600": "武威市", "620700": "张掖市", "620800": "平凉市", "620900": "酒泉市", "621000": "庆阳市", "621100": "定西市", "621200": "陇南市", "622900": "临夏回族自治州", "623000": "甘南藏族自治州" },
    "630000": { "630100": "西宁市", "630200": "海东市", "632200": "海北藏族自治州", "632300": "黄南藏族自治州", "632500": "海南藏族自治州", "632600": "果洛藏族自治州", "632700": "玉树藏族自治州", "632800": "海西蒙古族藏族自治州" },
    "640000": { "640100": "银川市", "640200": "石嘴山市", "640300": "吴忠市", "640400": "固原市", "640500": "中卫市" },
    "650000": { "650100": "乌鲁木齐市", "650200": "克拉玛依市", "650400": "吐鲁番市", "650500": "哈密市", "652300": "昌吉回族自治州", "652700": "博尔塔拉蒙古自治州", "652800": "巴音郭楞蒙古自治州", "652900": "阿克苏地区", "653000": "克孜勒苏柯尔克孜自治州", "653100": "喀什地区", "653200": "和田地区", "654000": "伊犁哈萨克自治州", "654200": "塔城地区", "654300": "阿勒泰地区", "659001": "石河子市", "659002": "阿拉尔市", "659003": "图木舒克市", "659004": "五家渠市", "659006": "铁门关市" },
    "710000": { "710101": "金门", "710102": "连江", "710103": "苗栗", "710104": "南投", "710105": "澎湖", "710106": "屏东", "710107": "台东", "710108": "台中", "710109": "台南", "710110": "台北", "710111": "桃园", "710112": "云林", "710113": "新北", "710114": "彰化", "710115": "嘉义", "710116": "新竹", "710117": "花莲", "710118": "宜兰", "710119": "高雄", "710120": "基隆" },
    "810000": { "810101": "中西区", "810102": "东区", "810103": "九龙城区", "810104": "观塘区", "810105": "深水埗区", "810106": "湾仔区", "810107": "黄大仙区", "810108": "油尖旺区", "810109": "离岛区", "810110": "葵青区", "810111": "北区", "810112": "西贡区", "810113": "沙田区", "810114": "屯门区", "810115": "大埔区", "810116": "荃湾区", "810117": "元朗区", "810118": "香港", "810119": "九龙", "810120": "新界" },
    "820000": { "820101": "离岛", "820102": "澳门半岛", "820103": "凼仔", "820104": "路凼城", "820105": "路环" }
  };

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
  function regionPicker(value, setValue) {
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
    provSel.onchange = () => {
      fillSelect(citySel, REGIONS[provSel.value] || {}, "市", "");
      emit();
    };
    citySel.onchange = emit;
    areaInput.oninput = emit;
    detail.oninput = emit;
    box.appendChild(provSel);
    box.appendChild(citySel);
    box.appendChild(areaInput);
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
      got.push({ id: FRAME_ID, count: mine.count, filled: mine.filled, manual: mine.manual, unknown: mine.unknown });
      relayToChildren({ type: RUN_MSG, profile, options: settings });
      await sleep(1700);
    } catch (e) {
      got.push({ count: 0, filled: [], manual: ["填充出错：" + (e && e.message ? e.message : e)], unknown: [] });
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
