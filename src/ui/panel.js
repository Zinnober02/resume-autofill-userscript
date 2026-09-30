// 网页面板：填表按钮、资料编辑、导入导出
import { IS_TOP, UI_ID } from '../core/env.js';
import { sleep } from '../core/dom.js';
import { saveData, assertData } from '../core/storage.js';
import { runFill } from '../core/filler.js';
import { addMissingBlocks } from '../core/block-adder.js';
import { watchNewBlocks } from '../core/watcher.js';
import {
  EDU_ITEM_FORM, WORK_ITEM_FORM, CERT_ITEM_FORM, PATENT_ITEM_FORM,
  PAPER_ITEM_FORM, AWARD_ITEM_FORM, FAMILY_ITEM_FORM, ACTIVITY_ITEM_FORM, PROJECT_ITEM_FORM,
} from '../core/profile-schema.js';
import { GROUP_ARRAYS } from '../core/value.js';
import { REGIONS } from '../core/regions.js';
import { splitAddress } from '../core/address.js';
import { RUN_MSG, RES_MSG, FRAME_ID, relayToChildren } from '../core/messaging.js';

const CSS = [
  '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}',
  '.pill{position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:27px;border:0;cursor:pointer;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:15px;font-weight:600;box-shadow:0 6px 20px rgba(37,99,235,.45);z-index:2147483647}',
  '.pill:hover{transform:translateY(-1px)}',
  '.mask{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(15,23,42,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:18px}',
  '.card{background:#fff;color:#0f172a;border-radius:14px;width:780px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}',
  '.hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;background:#fff;z-index:2}',
  '.hd b{font-size:15px}',
  '.bd{padding:16px 18px}',
  '.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
  '.btn{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}',
  '.btn:hover{background:#f1f5f9}',
  '.btn.primary{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}',
  '.btn.primary:hover{background:#1d4ed8}',
  '.btn.ghost{border-color:transparent;color:#64748b}',
  '.btn:disabled{opacity:.6;cursor:default}',
  'select.btn{padding:7px 8px}',
  '.status{font-size:13px;color:#475569;margin:8px 0;line-height:1.6}',
  '.ok{color:#15803d;font-weight:600}',
  '.warn{color:#b45309;font-weight:600}',
  'h4{margin:18px 0 8px;font-size:13px;color:#334155;border-left:3px solid #2563eb;padding-left:8px}',
  '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
  '.f{display:flex;flex-direction:column;gap:4px}',
  '.f.wide{grid-column:span 3}',
  '.f label{font-size:12px;color:#64748b}',
  '.f input,.f select,.f textarea{border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:13px;width:100%;background:#fff;color:#0f172a;font-family:inherit}',
  '.f textarea{min-height:78px;resize:vertical;line-height:1.55}',
  '.list{font-size:12px;color:#475569;line-height:1.75;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:6px;max-height:170px;overflow:auto;white-space:pre-wrap}',
  '.tip{font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.6}',
  '.extra{display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;margin-bottom:6px}',
  '.extra input{border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:12px;width:100%}',
  '.x{border:0;background:#fee2e2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:15px}',
  '.hidden{display:none}',
  '.block{border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:10px;background:#f8fafc}',
  '.region{display:flex;gap:6px;flex-wrap:wrap}',
  '.region select,.region input{flex:1 1 90px;min-width:80px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;font-size:13px;background:#fff;color:#0f172a}',
  '.block-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#64748b;font-weight:600}',
].join('');

const FORM_GROUPS = [
  ['基本信息', [
    ['name', '姓名', 'text'],
    ['englishName', '英文名/拼音', 'text'],
    ['gender', '性别', 'select', ['', '男', '女']],
    ['birthday', '出生日期', 'date'],
    ['nation', '民族', 'text'],
    ['politicalStatus', '政治面貌', 'select', ['', '中共党员', '中共预备党员', '共青团员', '民主党派', '群众']],
    ['maritalStatus', '婚姻状况', 'select', ['', '未婚', '已婚', '离异']],
    ['idType', '证件类型', 'select', ['', '身份证', '护照', '军官证', '香港身份证', '澳门身份证', '台湾身份证', '台胞证', '其他']],
    ['idCard', '身份证号', 'text'],
    ['phoneCountry', '手机号国家 / 地区', 'select', ['', '中国大陆', '中国香港', '中国澳门', '中国台湾', '其他']],
    ['phone', '手机号', 'text'],
    ['email', '邮箱', 'text'],
    ['wechat', '微信号', 'text'],
    ['hometown', '籍贯', 'region'],
    ['hukou', '户口所在地', 'region'],
    ['hukouType', '户口类型', 'text', '如 家庭户口 / 学校集体户口'],
    ['currentCity', '现居城市', 'region'],
    ['zipcode', '邮编', 'text'],
    ['address', '详细地址', 'text'],
    ['health', '健康状况', 'select', ['', '健康', '良好', '有病史']],
    ['gaokaoOrigin', '高考生源地', 'region'],
    ['isFreshGraduate', '是否应届毕业生', 'select', ['', '是', '否']],
  ]],
  ['求职意向', [
    ['applyPosition', '意向岗位', 'text'],
    ['expectCity', '意向城市', 'text'],
    ['expectSalary', '期望薪资', 'text'],
    ['availableDate', '到岗时间', 'date'],
    ['jobType', '期望工作性质', 'select', ['', '全职', '兼职', '实习']],
    ['adjust', '是否服从调剂', 'select', ['', '是', '否']],
    ['source', '获知渠道', 'text', '如 公司官网'],
    ['referralCode', '内推码', 'text'],
    ['website', '个人网站/博客', 'text'],
    ['github', 'GitHub/开源', 'text'],
  ]],
  ['语言、技能与爱好', [
    ['englishLevel', '英语水平', 'select', ['', '普通', '良好', '精通', '熟练']],
    ['otherLanguages', '其他外语水平及成绩', 'text'],
    ['itSkills', 'IT 技能掌握程度', 'text'],
    ['hobbies', '个人爱好', 'text'],
  ]],
  ['其他常用长文本', [
    ['selfEvaluation', '自我评价', 'textarea'],
    ['skills', '专业技能', 'textarea'],
  ]],
  ['紧急联系人', [
    ['emergencyName', '姓名', 'text'],
    ['emergencyRelation', '与本人关系', 'text'],
    ['emergencyPhone', '电话', 'text'],
  ]],
];

let shadow = null;
let app = null;
let data = null;
let draft = null;
let view = 'main';
let lastReport = null;
const settings = {
  onlyEmpty: true,
  autoConsent: false,
  highlight: true,
  fillDatePickers: true,
  autoFillNewBlocks: true,
  addMissingBlocks: false,
};
let filling = false;
let stopWatch = null;

// 由入口在读到资料之后调用
export function initPanel(initialData) {
  data = initialData;
}

// 省 / 市 / 区 三级联动，选完拼成「浙江省杭州市西湖区」这样的整串
function regionPicker(value, setValue) {
  const parsed = splitAddress(value);
  const box = el('div', 'region');
  const makeSelect = (placeholder) => {
    const s = el('select');
    const empty = el('option', null, placeholder);
    empty.value = '';
    s.appendChild(empty);
    return s;
  };
  const provSel = makeSelect('省');
  const citySel = makeSelect('市');
  const detail = el('input');
  detail.type = 'text';
  detail.placeholder = '详细地址（可选）';
  detail.value = parsed.detail || '';
  // 区县不做下拉，直接填，避免数据里对不上
  const areaInput = el('input');
  areaInput.type = 'text';
  areaInput.placeholder = '区 / 县';
  areaInput.value = parsed.district || '';

  const codeOf = (map, name) => Object.keys(map).find((code) => map[code] === name) || '';
  const fillSelect = (sel, map, placeholder, current) => {
    sel.innerHTML = '';
    const empty = el('option', null, placeholder);
    empty.value = '';
    sel.appendChild(empty);
    Object.keys(map).forEach((code) => {
      const option = el('option', null, map[code]);
      option.value = code;
      sel.appendChild(option);
    });
    sel.value = codeOf(map, current) || '';
  };
  const emit = () => {
    const province = provSel.value ? REGIONS['86'][provSel.value] : '';
    const city = citySel.value ? (REGIONS[provSel.value] || {})[citySel.value] || '' : '';
    setValue([province, city].join('') + areaInput.value.trim() + detail.value.trim());
  };
  const provinces = REGIONS['86'] || {};
  fillSelect(provSel, provinces, '省', parsed.province);
  fillSelect(citySel, REGIONS[provSel.value] || {}, '市', parsed.city);
  provSel.onchange = () => {
    fillSelect(citySel, REGIONS[provSel.value] || {}, '市', '');
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

// 编辑资料时的控件：文本框、下拉、长文本、日期、省市区
function makeFieldControl(type, extra, value, setValue) {
  if (type === 'region') return regionPicker(value, setValue);
  if (type === 'select') {
    const inp = el('select');
    (extra || ['']).forEach((o) => {
      const op = el('option', null, o === '' ? '（不填）' : o);
      op.value = o;
      inp.appendChild(op);
    });
    inp.value = value == null ? '' : String(value);
    inp.onchange = () => setValue(inp.value);
    return inp;
  }
  if (type === 'textarea') {
    const inp = el('textarea');
    inp.value = value == null ? '' : String(value);
    inp.oninput = () => setValue(inp.value);
    return inp;
  }
  if (type === 'date') {
    const inp = el('input');
    inp.type = 'date';
    inp.value = value == null ? '' : String(value);
    inp.oninput = () => setValue(inp.value);
    return inp;
  }
  const inp = el('input');
  inp.type = 'text';
  if (extra) inp.placeholder = extra;
  inp.value = value == null ? '' : String(value);
  inp.oninput = () => setValue(inp.value);
  return inp;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function build() {
  if (!IS_TOP || document.getElementById(UI_ID)) return;
  const host = document.createElement('div');
  host.id = UI_ID;
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);
  app = el('div');
  shadow.appendChild(app);
  document.documentElement.appendChild(host);
  render();
}

function render() {
  if (!app) return;
  app.innerHTML = '';
  if (view === 'main') renderPill();
  else renderPanel();
}

function renderPill() {
  const b = el('button', 'pill', '填表');
  b.title = '简历自动填充（Alt+Shift+F）';
  b.onclick = () => { view = 'panel'; render(); };
  app.appendChild(b);
}

function closePanel() { view = 'main'; render(); }

function renderPanel() {
  const mask = el('div', 'mask');
  mask.onclick = (e) => { if (e.target === mask) closePanel(); };
  const card = el('div', 'card');
  mask.appendChild(card);
  app.appendChild(mask);

  const hd = el('div', 'hd');
  hd.appendChild(el('b', null, view === 'edit' ? '编辑资料' : '简历自动填充'));
  const right = el('div', 'row');
  if (view === 'edit') {
    const back = el('button', 'btn', '保存并返回');
    back.onclick = () => { saveDraft(); view = 'panel'; render(); };
    right.appendChild(back);
  }
  const x = el('button', 'btn ghost', '✕');
  x.onclick = closePanel;
  right.appendChild(x);
  hd.appendChild(right);
  card.appendChild(hd);

  const bd = el('div', 'bd');
  card.appendChild(bd);
  if (view === 'edit') renderEditor(bd); else renderMain(bd);
}

function renderMain(bd) {
  const names = Object.keys(data.profiles);

  const row1 = el('div', 'row');
  row1.appendChild(el('span', 'tip', '资料方案'));
  const sel = el('select', 'btn');
  names.forEach((n) => { const o = el('option', null, n); o.value = n; sel.appendChild(o); });
  sel.value = data.current;
  sel.onchange = () => { data.current = sel.value; saveData(data); lastReport = null; render(); };
  row1.appendChild(sel);

  const bNew = el('button', 'btn', '复制一份');
  bNew.title = '以当前方案为模板，建一套新资料（比如投后端岗用）';
  bNew.onclick = () => {
    let n = '';
    try { n = (prompt('新方案的名字：', data.current + ' 副本') || '').trim(); } catch (e) { n = ''; }
    if (!n) return;
    if (data.profiles[n]) { alert('这个名字已经存在了'); return; }
    data.profiles[n] = JSON.parse(JSON.stringify(data.profiles[data.current] || {}));
    data.current = n;
    saveData(data);
    lastReport = null;
    render();
  };
  row1.appendChild(bNew);

  const bRename = el('button', 'btn', '重命名');
  bRename.onclick = () => {
    let n = '';
    try { n = (prompt('改成什么名字：', data.current) || '').trim(); } catch (e) { n = ''; }
    if (!n || n === data.current) return;
    if (data.profiles[n]) { alert('这个名字已经存在了'); return; }
    data.profiles[n] = data.profiles[data.current];
    delete data.profiles[data.current];
    data.current = n;
    saveData(data);
    render();
  };
  row1.appendChild(bRename);

  const bDel = el('button', 'btn', '删除');
  bDel.onclick = () => {
    if (Object.keys(data.profiles).length <= 1) { alert('至少要留一套资料'); return; }
    let ok = true;
    try { ok = confirm('确定删除方案「' + data.current + '」？'); } catch (e) { ok = true; }
    if (!ok) return;
    delete data.profiles[data.current];
    data.current = Object.keys(data.profiles)[0];
    saveData(data);
    render();
  };
  row1.appendChild(bDel);
  bd.appendChild(row1);
  if (profileIsEmpty(data.profiles[data.current] || {})) {
    const empty = el('div', 'status warn');
    empty.style.marginTop = '12px';
    empty.textContent = '这套资料还是空的：点下面「载入资料文件」选同目录的「我的资料.json」，或点「编辑资料」手动填一份。';
    bd.appendChild(empty);
  }
  const fillBtn = el('button', 'btn primary', '一键填充本页表单');
  fillBtn.style.cssText = 'margin-top:14px;padding:10px 18px;font-size:14px;width:100%';
  fillBtn.onclick = () => { doFill(fillBtn); };
  bd.appendChild(fillBtn);

  const opts = el('div');
  opts.style.marginTop = '10px';
  const mkOpt = (label, key) => {
    const wrap = el('label', 'status');
    wrap.style.display = 'block';
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!settings[key];
    cb.onchange = () => { settings[key] = cb.checked; };
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(' ' + label));
    return wrap;
  };
  opts.appendChild(mkOpt('只填空白字段（不覆盖我已经填好的内容）', 'onlyEmpty'));
  opts.appendChild(mkOpt('自动勾选「我已阅读并同意」这类条款', 'autoConsent'));
  opts.appendChild(mkOpt('日期选择器自动点开弹层选日期', 'fillDatePickers'));
  opts.appendChild(mkOpt('页面上新出现的编辑框自动填（点「添加」之后出现的那些）', 'autoFillNewBlocks'));
  opts.appendChild(mkOpt('资料里有几段经历就自动点「添加」补几段', 'addMissingBlocks'));
  bd.appendChild(opts);

  if (lastReport) {
    const box = el('div');
    const s1 = el('div', 'status');
    s1.innerHTML = '<span class="ok">已填好 ' + lastReport.count + ' 项</span>';
    box.appendChild(s1);
    if (lastReport.filled.length) box.appendChild(el('div', 'list', lastReport.filled.join('　·　')));
    if (lastReport.manual.length) {
      box.appendChild(el('div', 'status warn', '需要你手动处理 ' + lastReport.manual.length + ' 项'));
      box.appendChild(el('div', 'list', lastReport.manual.join('\n')));
    }
    if (lastReport.unknown.length) {
      box.appendChild(el('div', 'status warn', '没认出来的字段 ' + lastReport.unknown.length + ' 个'));
      box.appendChild(el('div', 'list', lastReport.unknown.join('　·　')));
      box.appendChild(el('div', 'tip', '如果这些字段你想自动填，点下面的「编辑资料」→ 最底部「补充规则」，照着写一条就行。'));
    }
    bd.appendChild(box);
  }

  const foot = el('div', 'row');
  foot.style.marginTop = '16px';
  const bEdit = el('button', 'btn', '编辑资料');
  bEdit.onclick = () => { draft = JSON.parse(JSON.stringify(data.profiles[data.current] || {})); view = 'edit'; render(); };
  foot.appendChild(bEdit);

  const bLoad = el('button', 'btn', '载入资料文件');
  bLoad.title = '选择「我的资料.json」，用它覆盖当前方案';
  bLoad.onclick = importFile;
  foot.appendChild(bLoad);

  const bSave = el('button', 'btn', '导出资料文件');
  bSave.title = '把全部方案存成 我的资料.json';
  bSave.onclick = exportFile;
  foot.appendChild(bSave);
  bd.appendChild(foot);

  bd.appendChild(el('div', 'tip', '资料只存在你自己的浏览器里，不会上传到任何地方。'));
}

function renderEditor(bd) {
  FORM_GROUPS.forEach((group) => {
    bd.appendChild(el('h4', null, group[0]));
    const grid = el('div', 'grid');
    group[1].forEach((f) => {
      const key = f[0];
      const label = f[1];
      const type = f[2];
      const extra = f[3];
      const wrap = el('div', 'f' + (type === 'textarea' || type === 'region' ? ' wide' : ''));
      wrap.appendChild(el('label', null, label));
      wrap.appendChild(makeFieldControl(type, extra, draft[key], (v) => { draft[key] = v; }));
      grid.appendChild(wrap);
    });
    bd.appendChild(grid);
  });

  renderBlocks(bd, 'educations', '教育经历', '一段一张卡片，按网页上的顺序排：网页上第一段教育经历填这里的第一张卡片。点「+ 加一段」可以再加。', EDU_ITEM_FORM);
  renderBlocks(bd, 'works', '工作 / 实习经历', '一段一张卡片，顺序同上。', WORK_ITEM_FORM);
  renderBlocks(bd, 'certificates', '证书', '一张卡片一项证书。', CERT_ITEM_FORM);
  renderBlocks(bd, 'patents', '专利', '一张卡片一项专利。', PATENT_ITEM_FORM);
  renderBlocks(bd, 'papers', '论文', '一张卡片一篇论文。', PAPER_ITEM_FORM);
  renderBlocks(bd, 'awards', '奖励与荣誉', '一张卡片一项奖励。', AWARD_ITEM_FORM);
  renderBlocks(bd, 'projects', '项目经历', '一张卡片一个项目。', PROJECT_ITEM_FORM);
  renderBlocks(bd, 'activities', '社团与活动', '一张卡片一项活动经历。', ACTIVITY_ITEM_FORM);
  renderBlocks(bd, 'family', '家庭关系', '一张卡片一位家庭成员。', FAMILY_ITEM_FORM);

  bd.appendChild(el('h4', null, '补充规则（认不出来的字段写这里）'));
  const extraBox = el('div');
  bd.appendChild(extraBox);
  renderExtras(extraBox);
  bd.appendChild(el('div', 'tip', '左边写网页上那个字段旁边的字，右边写要填的内容。比如左边写「期望岗位」，右边写「AI应用工程师」。'));

  const foot = el('div', 'row');
  foot.style.marginTop = '18px';
  const bSave = el('button', 'btn primary', '保存并返回');
  bSave.onclick = () => { saveDraft(); view = 'panel'; render(); };
  foot.appendChild(bSave);
  const bReset = el('button', 'btn', '放弃本次修改');
  bReset.onclick = () => { view = 'panel'; render(); };
  foot.appendChild(bReset);
  bd.appendChild(foot);
}

function renderExtras(container) {
  container.innerHTML = '';
  if (!draft.extra) draft.extra = [];
  const list = draft.extra;
  list.forEach((item, i) => {
    const row = el('div', 'extra');
    const a = el('input');
    a.placeholder = '网页上那个字段的文字';
    a.value = item.match || '';
    a.oninput = () => { item.match = a.value; };
    const b = el('input');
    b.placeholder = '要填进去的内容';
    b.value = item.value || '';
    b.oninput = () => { item.value = b.value; };
    const x = el('button', 'x', '×');
    x.onclick = () => { list.splice(i, 1); renderExtras(container); };
    row.appendChild(a);
    row.appendChild(b);
    row.appendChild(x);
    container.appendChild(row);
  });
  const add = el('button', 'btn', '+ 加一条');
  add.onclick = () => { list.push({ match: '', value: '' }); renderExtras(container); };
  container.appendChild(add);
}

// 多段经历：一段一个卡片，可以随时加一段或删一段
function renderBlocks(bd, key, title, tip, form) {
  if (!Array.isArray(draft[key])) draft[key] = [];
  bd.appendChild(el('h4', null, title));
  bd.appendChild(el('div', 'tip', tip));
  const box = el('div');
  box.style.marginTop = '8px';
  bd.appendChild(box);
  renderBlockList(box, key, form);
}

function renderBlockList(box, key, form) {
  box.innerHTML = '';
  const list = draft[key];
  list.forEach((item, index) => {
    const block = el('div', 'block');
    const hd = el('div', 'block-hd');
    hd.appendChild(el('span', null, '第 ' + (index + 1) + ' 段'));
    const del = el('button', 'x', '×');
    del.onclick = () => { list.splice(index, 1); renderBlockList(box, key, form); };
    hd.appendChild(del);
    block.appendChild(hd);
    const grid = el('div', 'grid');
    form.forEach((f) => {
      const field = f[0];
      const label = f[1];
      const type = f[2];
      const extra = f[3];
      const wrap = el('div', 'f' + (type === 'textarea' ? ' wide' : ''));
      wrap.appendChild(el('label', null, label));
      wrap.appendChild(makeFieldControl(type, extra, item[field], (v) => { item[field] = v; }));
      grid.appendChild(wrap);
    });
    block.appendChild(grid);
    box.appendChild(block);
  });
  const add = el('button', 'btn', '+ 加一段');
  add.onclick = () => { list.push({}); renderBlockList(box, key, form); };
  box.appendChild(add);
}

function saveDraft() {
  if (!draft) return;
  data.profiles[data.current] = draft;
  saveData(data);
  lastReport = null;
}

// 资料还空着的时候，别让人一脸茫然地点了没反应
function profileIsEmpty(p) {
  return !String(p.name || '').trim() && !String(p.phone || '').trim() && !String(p.email || '').trim();
}

async function doFill(btn) {
  const profile = data.profiles[data.current] || {};
  if (profileIsEmpty(profile)) {
    alert('这套资料还是空的：请先点「载入资料文件」选同目录的「我的资料.json」，或者点「编辑资料」手动填一份。');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '正在填…'; }
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
  window.addEventListener('message', onMsg);
  try {
    const mine = await runFill(profile, settings);
    got.push({ id: FRAME_ID, count: mine.count, filled: mine.filled, manual: mine.manual, unknown: mine.unknown });
    relayToChildren({ type: RUN_MSG, profile, options: settings });
    await sleep(1700);
  } catch (e) {
    got.push({ count: 0, filled: [], manual: ['填充出错：' + (e && e.message ? e.message : e)], unknown: [] });
  } finally {
    window.removeEventListener('message', onMsg);
    filling = false;
  }
  const uniq = (arr) => {
    const seen = {};
    const out = [];
    arr.forEach((v) => { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  };
  lastReport = {
    count: got.reduce((a, b) => a + (b.count || 0), 0),
    filled: uniq([].concat.apply([], got.map((g) => g.filled || []))),
    manual: uniq([].concat.apply([], got.map((g) => g.manual || []))),
    unknown: uniq([].concat.apply([], got.map((g) => g.unknown || []))),
  };
  if (btn) { btn.disabled = false; }
  render();
}

// 菜单命令「立即填一遍」用
export function fillCurrentPage() {
  return doFill(null);
}

function importFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
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
        alert('资料文件读不进去：' + (e && e.message ? e.message : e));
      }
    };
    fr.readAsText(f, 'utf-8');
  };
  inp.click();
}

function exportFile() {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '我的资料.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

// 页面上新出现的编辑框（点「添加」出现的、弹窗里的）自动填一次
export function startAutoFill() {
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
        unknown: st.unknown.slice(0, 20),
      };
      if (app) render();
    }).finally(() => { filling = false; });
  });
}

export function forceShow() {
  if (!document.getElementById(UI_ID)) build();
  view = 'panel';
  render();
}
