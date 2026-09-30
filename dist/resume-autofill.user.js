// ==UserScript==
// @name         简历自动填充助手
// @name:en      Resume Autofill Helper
// @namespace    local.resume.autofill
// @version      1.1.0
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
  var norm = (s) => String(s == null ? "" : s).replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  var EDU_RE = /教育|学校|院校|学院|大学|学历|学位|就读|毕业|专业|硕士|本科|博士|university|school|education|academic/;
  var WORK_RE = /工作|实习|公司|单位|职位|任职|部门|雇主|company|employer|work|experience|intern/;
  function sectionType(text) {
    if (EDU_RE.test(text)) return "edu";
    if (WORK_RE.test(text)) return "work";
    return "";
  }
  var RULES = [
    { key: "englishName", re: /英文名|英文姓名|拼音姓名|拼音名|englishname|nameinenglish|nameinpinyin|pinyin|forename/ },
    { key: "idCard", re: /身份证|证件号码|证件号|身份号码|idcardno|idcardnumber|identityno|identitynumber|residentid/ },
    { key: "emergencyPhone", re: /(紧急|亲属|监护人).*(电话|手机|号码)|(电话|手机|号码).*紧急|emergency(phone|tel|contact|number)/ },
    { key: "emergencyRelation", re: /与本人关系|亲属关系|紧急联系人关系|relationship/ },
    { key: "emergencyName", re: /紧急联系人|紧急情况联系人|联系人姓名|监护人/ },
    { key: "birthday", re: /出生日期|出生年月|出生时间|生日|birth|dob|dateofbirth/, neg: /出生地|籍贯|省市|地区|国家/ },
    { key: "age", re: /年龄|^age$/, neg: /年龄段|年龄要求/ },
    { key: "gender", re: /性别|^gender$|^sex$/, neg: /性别要求|性别限制|性别偏好/ },
    { key: "nation", re: /民族|ethnic/, neg: /国籍|国家/ },
    { key: "politicalStatus", re: /政治面貌|党派|partyaffiliation|politicalstatus/ },
    { key: "maritalStatus", re: /婚姻|婚否|marital|marriage/ },
    { key: "phone", re: /手机|电话|联系方式|联系电话|mobile|phone|^tel$|telephone|cellphone|contactnumber/, neg: /紧急|亲属|监护|推荐人|公司|企业|座机|家庭电话|区号|国家码|验证码/ },
    { key: "email", re: /邮箱|电子邮件|邮件地址|email|电子信箱/ },
    { key: "expectCity", re: /期望城市|期望工作地|期望工作城市|期望地点|期望地区|意向城市|意向地区|意向工作地|工作地点|期望上班地点|desiredlocation|preferredcity|preferredlocation|worklocation|preferredwork/, neg: /现居|目前|籍贯|户籍|户口|出生|大学/ },
    { key: "applyPosition", re: /应聘职位|应聘岗位|申请职位|申请岗位|意向职位|意向岗位|期望职位|期望岗位|期望工作|目标职位|目标岗位|求职意向|岗位名称|positionapplied|desiredposition|desiredjob|appliedposition/, neg: /城市|地点|地区|地址/ },
    { key: "expectSalary", re: /期望薪资|期望薪酬|期望月薪|期望年薪|薪资要求|薪酬期望|期望工资|expectedsalary|salaryexpectation|desiredsalary/ },
    { key: "availableDate", re: /到岗|入职时间|最快入职|可入职|可到岗|availablefrom|availabledate|startdate|noticeperiod/ },
    { key: "source", re: /获知渠道|了解渠道|招聘信息来源|信息来源|如何得知|从哪里知道|从哪里了解到|howdidyouhear|howdidyouknow|recruitmentsource|sourcechannel/ },
    { key: "github", re: /github|gitlab|gitee|码云|开源项目|开源仓库/ },
    { key: "website", re: /个人网站|个人主页|个人博客|作品集|portfolio|personalsite|personalwebsite|homepage|^blog$|博客/, neg: /github|gitee/ },
    { key: "zipcode", re: /邮编|邮政编码|postalcode|zipcode/ },
    { key: "hukou", re: /户口所在地|户籍所在地|户口地址|户籍地址|户口所在|户籍所在/, neg: /性质|类型|农业|城镇/ },
    { key: "hometown", re: /籍贯|出生地|家乡|老家|nativeplace|hometown/ },
    { key: "address", re: /通讯地址|联系地址|现住址|现居地址|居住地址|家庭住址|详细地址|街道地址|收件地址|address|street/, neg: /邮箱|邮件|email|网址|url|户口|户籍|籍贯|学校地址|公司地址/ },
    { key: "currentCity", re: /现居城市|现居住地|现居地|目前所在城市|所在城市|所在地区|目前所在地|currentcity|currentlocation|cityofresidence|现居/, neg: /期望|意向/ },
    { key: "schoolCity", re: /学校所在地|院校所在地|学校所在省市|院校所在/ },
    { key: "school", re: /毕业院校|毕业学校|就读院校|就读学校|学校名称|院校名称|学校全称|院校全称|^学校$|^院校$|university|schoolname|institution|almamater/, neg: /高中|中学|初中|小学|学校地址|学校所在地|学校性质|学校类型|学校邮箱|学校电话|学院|院系/ },
    { key: "major", re: /所学专业|专业名称|^专业$|专业|major|fieldofstudy|discipline/, neg: /专业方向|专业类别|专业排名|转专业|专业技能/ },
    { key: "college", re: /学院|院系|系别|faculty|college|schoolof/, neg: /继续教育|成人教育/ },
    { key: "degree", re: /学历|最高学历|educationlevel|educationbackground|academicdegree|degreelevel/, neg: /学位|学校|院校|学历认证/ },
    { key: "degreeLevel", re: /学位|degreeawarded|所获学位/, neg: /学位类型/ },
    { key: "gpa", re: /gpa|绩点|平均分|平均绩点|成绩点/ },
    { key: "rank", re: /年级排名|班级排名|专业排名|排名比例|排名情况|^排名$|rank/, neg: /排名第一/ },
    { key: "eduEnd", re: /毕业时间|毕业日期|^毕业$|毕业|结束时间|结束日期|离校时间|graduation|enddate|^to$/, ctx: "edu" },
    { key: "eduStart", re: /入学时间|入学日期|^入学$|入学|起始时间|开始时间|开始日期|就读时间|startdate|^from$|^fromdate$/, ctx: "edu" },
    { key: "company", re: /公司名称|公司全称|单位名称|工作单位|^公司$|雇主|company|employer|organization|corporation/, neg: /学校|院校|公司地址|公司规模|公司性质|公司网站|子公司|母公司|公司电话|公司邮箱|公司简介/ },
    { key: "department", re: /部门|department|division|businessunit/, neg: /学院|院系|系别|部门负责人/ },
    { key: "title", re: /职位|职务|岗位|jobtitle|position|^title$/, neg: /意向|期望|应聘|申请|目标|职位类别|岗位类别|职位性质/ },
    { key: "workDesc", re: /工作内容|工作描述|工作职责|职责描述|岗位职责|主要工作|工作业绩|实习内容|工作成果|工作说明|responsibilit|jobdescription|duties/ },
    { key: "projectDesc", re: /项目描述|项目简介|项目内容|项目经历描述|项目经验描述|projectdescription|projectexperience/ },
    { key: "workEnd", re: /离职时间|离职日期|^离职$|离职|结束时间|结束日期|转正时间|enddate/, ctx: "work" },
    { key: "workStart", re: /入职时间|入职日期|^入职$|入职|起始时间|开始时间|开始日期|startdate/, ctx: "work" },
    { key: "selfEvaluation", re: /自我评价|自我介绍|个人评价|个人简介|selfevaluation|selfintroduction|aboutme|summary/ },
    { key: "skills", re: /专业技能|技能特长|技术栈|掌握技能|skills/ },
    { key: "name", re: /申请人姓名|候选人姓名|真实姓名|中文姓名|姓名全称|^姓名$|^名字$|姓名|fullname|candidatename|yourname|^name$|applicantname/, neg: /公司|企业|学校|院校|项目|用户名|昵称|英文|拼音|护照|推荐人|紧急|父母|银行|学院|专业|联系人|名称/ }
  ];
  function pickKey(t) {
    const label = norm(t.label || "");
    const attr = norm(t.attr || "");
    const ctx = sectionType(norm(t.hint || ""));
    const passes = [label, attr, label + "|" + attr];
    for (let i = 0; i < passes.length; i += 1) {
      const src = passes[i];
      if (!src) continue;
      for (let j = 0; j < RULES.length; j += 1) {
        const r = RULES[j];
        if (r.ctx && ctx !== r.ctx) continue;
        if (!r.re.test(src)) continue;
        if (r.neg && r.neg.test(src)) continue;
        return r.key;
      }
    }
    if (t.allowHint && t.hint) {
      const h = norm(t.hint);
      for (let j = 0; j < RULES.length; j += 1) {
        const r = RULES[j];
        if (r.ctx && ctx !== r.ctx) continue;
        if (!r.re.test(h)) continue;
        if (r.neg && r.neg.test(h)) continue;
        return r.key;
      }
    }
    return null;
  }

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
    const parts = [];
    if (!el2.getAttribute) return "";
    const al = el2.getAttribute("aria-label");
    if (al) parts.push(al);
    const lb = el2.getAttribute("aria-labelledby");
    if (lb) {
      lb.split(/\s+/).forEach((id) => {
        const t = document.getElementById(id);
        if (t) parts.push(visibleText(t, 80));
      });
    }
    if (el2.id) {
      try {
        const lab = document.querySelector('label[for="' + cssEscape(el2.id) + '"]');
        if (lab) parts.push(visibleText(lab, 80));
      } catch (e) {
      }
    }
    const wrap = el2.closest && el2.closest("label");
    if (wrap) parts.push(visibleText(wrap, 80));
    if (!parts.length) {
      const likeLabel = (n) => {
        if (!n || !n.tagName) return "";
        const tag = n.tagName;
        const okTag = tag === "LABEL" || tag === "TD" || tag === "TH" || tag === "SPAN" || tag === "DIV" || tag === "P" || tag === "B" || tag === "STRONG" || tag === "EM";
        if (!okTag) return "";
        if (n.querySelector && n.querySelector("input, select, textarea")) return "";
        return visibleText(n, 30).trim();
      };
      let t = likeLabel(el2.previousElementSibling);
      if (!t && el2.parentElement) t = likeLabel(el2.parentElement.previousElementSibling);
      if (t) parts.push(t);
    }
    const ti = el2.getAttribute("title");
    if (ti) parts.push(ti);
    return parts.join(" ").trim();
  }
  function attrText(el2) {
    const keys = ["name", "id", "placeholder", "data-name", "data-field", "data-label", "autocomplete", "class"];
    const parts = [];
    keys.forEach((k) => {
      const v = el2.getAttribute && el2.getAttribute(k);
      if (v && v.length < 120) parts.push(v);
    });
    return parts.join(" ");
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
  function sectionContainer(el2) {
    let cur = el2;
    for (let i = 0; i < 8 && cur; i += 1) {
      cur = cur.parentElement;
      if (!cur || cur.tagName === "BODY") break;
      const t = cur.textContent || "";
      if (t.length <= 800 && sectionType(t)) return cur;
    }
    return null;
  }
  function sectionScope(el2) {
    const probe = visibleText(el2.parentElement || el2, 120);
    const type = sectionType(norm(probe)) || sectionType(norm(fieldHint(el2)));
    if (!type) return null;
    const re = type === "edu" ? EDU_RE : WORK_RE;
    const otherRe = type === "edu" ? WORK_RE : EDU_RE;
    let cur = el2;
    let best = null;
    for (let i = 0; i < 8 && cur; i += 1) {
      cur = cur.parentElement;
      if (!cur || cur.tagName === "BODY") break;
      const txt = cur.textContent || "";
      if (txt.length > 3e3) break;
      if (!re.test(txt)) break;
      best = cur;
      if (otherRe.test(txt)) break;
    }
    return best;
  }
  function fieldHint(el2) {
    const sec = sectionContainer(el2);
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
      idCard: "",
      phone: "",
      email: "",
      wechat: "",
      hometown: "",
      hukou: "",
      currentCity: "",
      address: "",
      zipcode: "",
      applyPosition: "",
      expectCity: "",
      expectSalary: "",
      availableDate: "",
      source: "",
      website: "",
      github: "",
      school: "",
      college: "",
      major: "",
      degree: "",
      degreeLevel: "",
      eduStart: "",
      eduEnd: "",
      gpa: "",
      rank: "",
      schoolCity: "",
      bachelorSchool: "",
      bachelorCollege: "",
      bachelorMajor: "",
      bachelorStart: "",
      bachelorEnd: "",
      bachelorDegreeLevel: "",
      bachelorGpa: "",
      bachelorRank: "",
      company: "",
      department: "",
      title: "",
      workStart: "",
      workEnd: "",
      workCity: "",
      workDesc: "",
      projectDesc: "",
      selfEvaluation: "",
      skills: "",
      emergencyName: "",
      emergencyRelation: "",
      emergencyPhone: "",
      extra: []
    }
  };

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
  function loadData() {
    let d = null;
    try {
      d = GM_getValue(STORE_KEY, null);
    } catch (e) {
      d = null;
    }
    if (typeof d === "string") {
      try {
        d = JSON.parse(d);
      } catch (e) {
        d = null;
      }
    }
    if (!d || !d.profiles || !Object.keys(d.profiles).length) d = seedData();
    if (!d.current || !d.profiles[d.current]) d.current = Object.keys(d.profiles)[0];
    return d;
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
  var BACHELOR_MAP = {
    school: "bachelorSchool",
    college: "bachelorCollege",
    major: "bachelorMajor",
    eduStart: "bachelorStart",
    eduEnd: "bachelorEnd",
    degreeLevel: "bachelorDegreeLevel",
    gpa: "bachelorGpa",
    rank: "bachelorRank"
  };
  function eduSegment(rowText, rowIndex) {
    const t = norm(rowText);
    if (/高中|中学|初中|小学|中专|技校/.test(t)) return "skip";
    const iB = t.search(/本科|学士|bachelor/);
    const iM = t.search(/硕士|研究生|博士|master|phd/);
    if (iB >= 0 && iM >= 0) return iB < iM ? "bachelor" : "master";
    if (iB >= 0) return "bachelor";
    if (iM >= 0) return "master";
    if (rowIndex === 1) return "master";
    if (rowIndex === 2) return "bachelor";
    return "skip";
  }
  function valueForField(key, profile, rowText, rowIndex) {
    if (key === "age") {
      const by = parseInt(String(profile.birthday || "").slice(0, 4), 10);
      if (!by) return "";
      const bm = parseInt(String(profile.birthday || "").slice(5, 7), 10);
      const now = /* @__PURE__ */ new Date();
      let age = now.getFullYear() - by;
      if (bm && now.getMonth() + 1 < bm) age -= 1;
      return String(age);
    }
    if (!EDU_KEYS[key]) return profile[key] == null ? "" : profile[key];
    const seg = eduSegment(rowText, rowIndex);
    if (seg === "skip") return "";
    if (seg === "bachelor") {
      if (key === "degree") return "本科";
      const mapped = BACHELOR_MAP[key];
      return mapped ? profile[mapped] == null ? "" : profile[mapped] : "";
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
  function formatValue(el2, value) {
    const v = String(value);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(v)) return v;
    const type = (el2.type || "").toLowerCase();
    const full = v.length === 7 ? v + "-01" : v;
    if (type === "month") return v.slice(0, 7);
    if (type === "date") return full;
    const ph = el2.getAttribute("placeholder") || "";
    if (ph.indexOf("/") >= 0) return full.replace(/-/g, "/");
    if (/年.*月/.test(ph)) return full.slice(0, 4) + "年" + full.slice(5, 7) + "月";
    return v;
  }
  var FIELD_NAMES = {
    name: "姓名",
    englishName: "英文名",
    gender: "性别",
    birthday: "出生年月",
    age: "年龄",
    nation: "民族",
    politicalStatus: "政治面貌",
    maritalStatus: "婚姻状况",
    idCard: "身份证号",
    phone: "手机号",
    email: "邮箱",
    wechat: "微信",
    hometown: "籍贯",
    hukou: "户口所在地",
    currentCity: "现居城市",
    address: "地址",
    zipcode: "邮编",
    applyPosition: "意向岗位",
    expectCity: "意向城市",
    expectSalary: "期望薪资",
    availableDate: "到岗时间",
    source: "获知渠道",
    website: "个人网站",
    github: "GitHub",
    school: "学校",
    college: "学院",
    major: "专业",
    degree: "学历",
    degreeLevel: "学位",
    eduStart: "入学时间",
    eduEnd: "毕业时间",
    gpa: "GPA",
    rank: "排名",
    schoolCity: "学校所在地",
    bachelorSchool: "本科学校",
    bachelorCollege: "本科学院",
    bachelorMajor: "本科专业",
    bachelorStart: "本科入学",
    bachelorEnd: "本科毕业",
    bachelorDegreeLevel: "本科学位",
    bachelorGpa: "本科GPA",
    bachelorRank: "本科排名",
    company: "公司",
    department: "部门",
    title: "职位",
    workStart: "开始时间",
    workEnd: "结束时间",
    workCity: "工作城市",
    workDesc: "工作描述",
    projectDesc: "项目描述",
    selfEvaluation: "自我评价",
    skills: "专业技能",
    emergencyName: "紧急联系人",
    emergencyRelation: "与本人关系",
    emergencyPhone: "紧急联系人电话"
  };

  // src/core/filler.js
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
  async function runFill(profile, opts) {
    const options = Object.assign({ onlyEmpty: true, autoConsent: false, highlight: true }, opts || {});
    const st = { filled: [], manual: [], unknown: [], radioDone: {}, count: 0 };
    const nodes = deepQueryAll("input, textarea, select");
    const scopeCache = /* @__PURE__ */ new Map();
    const eduRowIndex = (el2) => {
      const scope = sectionScope(el2) || document;
      let rowList = scopeCache.get(scope);
      if (!rowList) {
        const rows = /* @__PURE__ */ new Map();
        const inside = scope.querySelectorAll ? scope.querySelectorAll("input, textarea, select") : [];
        for (let i = 0; i < inside.length; i += 1) {
          const n = inside[i];
          const k = pickKey({ label: labelText(n), attr: attrText(n), hint: "", allowHint: false });
          if (!k || !EDU_KEYS[k]) continue;
          const r = rowContainer(n);
          if (!rows.has(r)) {
            let top = 0;
            try {
              top = r.getBoundingClientRect().top;
            } catch (e) {
              top = 0;
            }
            rows.set(r, top);
          }
        }
        rowList = Array.from(rows.entries()).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
        scopeCache.set(scope, rowList);
      }
      const idx = rowList.indexOf(rowContainer(el2));
      return idx < 0 ? 1 : idx + 1;
    };
    for (let i = 0; i < nodes.length; i += 1) {
      const el2 = nodes[i];
      if (isOurUI(el2) || shouldSkip(el2)) continue;
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
        let key2 = pickKey({
          label: labelText(sample),
          attr: attrText(sample),
          hint: fieldHint(sample),
          allowHint: false
        });
        if (!key2) {
          key2 = pickKey({
            label: visibleText(rowContainer(sample), 80),
            attr: "",
            hint: fieldHint(sample),
            allowHint: true
          });
        }
        if (!key2) continue;
        const want = norm(valueForField(key2, profile, visibleText(rowContainer(sample), 160), 1));
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
      let key = pickKey({ label, attr, hint: fieldHint(el2), allowHint: !label && !attr });
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
      const value = direct ? key.slice(6) : valueForField(key, profile, rowText, EDU_KEYS[key] ? eduRowIndex(el2) : 1);
      if (!value) continue;
      if (options.onlyEmpty && alreadyFilled(el2)) continue;
      if (el2.tagName === "SELECT") {
        const preferEnrolled = key === "degree" && /在读|应届/.test(String(profile.degreeNote || "在读"));
        const idx = bestOptionIndex(el2, value, preferEnrolled);
        if (idx >= 0) {
          const text = String(el2.options[idx].text).trim();
          setVal(el2, el2.options[idx].value);
          st.count += 1;
          st.filled.push((FIELD_NAMES[key] || "自定义") + " → " + text);
          if (options.highlight) highlight(el2);
        } else if (isCustomSelect(el2)) {
          const ok = await fillCustomSelect(el2, value);
          if (ok) {
            st.count += 1;
            st.filled.push(FIELD_NAMES[key] || "自定义");
          } else st.manual.push((FIELD_NAMES[key] || "自定义") + "：下拉框没有合适选项，请手动选");
        } else {
          st.manual.push((FIELD_NAMES[key] || "自定义") + "：下拉框没有合适选项，请手动选");
        }
        continue;
      }
      if (isCustomSelect(el2) && el2.readOnly) {
        const ok = await fillCustomSelect(el2, value);
        if (ok) {
          st.count += 1;
          st.filled.push(FIELD_NAMES[key] || "自定义");
          if (options.highlight) highlight(el2);
        } else {
          st.manual.push((FIELD_NAMES[key] || "自定义") + "：自定义下拉框，请手动选");
        }
        continue;
      }
      setVal(el2, formatValue(el2, value));
      st.count += 1;
      st.filled.push(FIELD_NAMES[key] || "自定义");
      if (options.highlight) highlight(el2);
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
    ".hidden{display:none}"
  ].join("");
  var FORM_GROUPS = [
    ["基本信息", [
      ["name", "姓名", "text"],
      ["englishName", "英文名/拼音", "text"],
      ["gender", "性别", "select", ["", "男", "女"]],
      ["birthday", "出生年月", "text", "如 2003-09"],
      ["nation", "民族", "text"],
      ["politicalStatus", "政治面貌", "select", ["", "中共党员", "中共预备党员", "共青团员", "民主党派", "群众"]],
      ["maritalStatus", "婚姻状况", "select", ["", "未婚", "已婚", "离异"]],
      ["idCard", "身份证号", "text"],
      ["phone", "手机号", "text"],
      ["email", "邮箱", "text"],
      ["wechat", "微信号", "text"],
      ["hometown", "籍贯", "text"],
      ["hukou", "户口所在地", "text"],
      ["currentCity", "现居城市", "text"],
      ["zipcode", "邮编", "text"],
      ["address", "详细地址", "text"]
    ]],
    ["求职意向", [
      ["applyPosition", "意向岗位", "text"],
      ["expectCity", "意向城市", "text"],
      ["expectSalary", "期望薪资", "text"],
      ["availableDate", "到岗时间", "text", "如 2027-07 / 一周内"],
      ["source", "获知渠道", "text", "如 公司官网"],
      ["website", "个人网站/博客", "text"],
      ["github", "GitHub/开源", "text"]
    ]],
    ["教育经历 · 最高学历", [
      ["school", "学校", "text"],
      ["college", "学院", "text"],
      ["major", "专业", "text"],
      ["degree", "学历", "select", ["", "硕士", "博士", "本科", "大专"]],
      ["degreeLevel", "学位", "select", ["", "学士", "硕士", "博士"]],
      ["schoolCity", "学校所在地", "text"],
      ["eduStart", "入学时间", "text", "如 2025-09"],
      ["eduEnd", "毕业时间", "text", "如 2027-07"],
      ["gpa", "GPA/绩点", "text"],
      ["rank", "排名", "text"]
    ]],
    ["教育经历 · 本科", [
      ["bachelorSchool", "学校", "text"],
      ["bachelorCollege", "学院", "text"],
      ["bachelorMajor", "专业", "text"],
      ["bachelorDegreeLevel", "学位", "select", ["", "学士", "硕士", "博士"]],
      ["bachelorStart", "入学时间", "text", "如 2021-09"],
      ["bachelorEnd", "毕业时间", "text", "如 2025-07"],
      ["bachelorGpa", "GPA/绩点", "text"],
      ["bachelorRank", "排名", "text"]
    ]],
    ["工作 / 实习经历", [
      ["company", "公司", "text"],
      ["department", "部门", "text"],
      ["title", "职位", "text"],
      ["workCity", "工作城市", "text"],
      ["workStart", "开始时间", "text", "如 2026-04"],
      ["workEnd", "结束时间", "text", "如 2026-09"],
      ["workDesc", "工作内容描述", "textarea"]
    ]],
    ["其他常用长文本", [
      ["projectDesc", "项目经历描述", "textarea"],
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
  var settings = { onlyEmpty: true, autoConsent: false, highlight: true };
  function initPanel(initialData) {
    data = initialData;
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
        const wrap = el("div", "f" + (type === "textarea" ? " wide" : ""));
        wrap.appendChild(el("label", null, label));
        let inp;
        if (type === "select") {
          inp = el("select");
          (extra || [""]).forEach((o) => {
            const op = el("option", null, o === "" ? "（不填）" : o);
            op.value = o;
            inp.appendChild(op);
          });
          inp.value = draft[key] == null ? "" : String(draft[key]);
          inp.onchange = () => {
            draft[key] = inp.value;
          };
        } else if (type === "textarea") {
          inp = el("textarea");
          inp.value = draft[key] == null ? "" : String(draft[key]);
          inp.oninput = () => {
            draft[key] = inp.value;
          };
        } else {
          inp = el("input");
          inp.type = "text";
          if (extra) inp.placeholder = extra;
          inp.value = draft[key] == null ? "" : String(draft[key]);
          inp.oninput = () => {
            draft[key] = inp.value;
          };
        }
        wrap.appendChild(inp);
        grid.appendChild(wrap);
      });
      bd.appendChild(grid);
    });
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
          const obj = JSON.parse(String(fr.result));
          if (obj && obj.profiles && Object.keys(obj.profiles).length) {
            data = obj;
            if (!data.current || !data.profiles[data.current]) data.current = Object.keys(data.profiles)[0];
          } else if (obj && typeof obj === "object") {
            data.profiles[data.current] = Object.assign({}, data.profiles[data.current], obj);
          } else {
            alert("这个文件里没读到资料");
            return;
          }
          saveData(data);
          lastReport = null;
          render();
        } catch (e) {
          alert("文件读不出来，确认是 UTF-8 编码的 json：" + (e && e.message ? e.message : e));
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
