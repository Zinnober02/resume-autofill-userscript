// 网页面板：填表按钮、资料编辑、导入导出
import { IS_TOP, UI_ID } from '../core/env.js';
import { sleep } from '../core/dom.js';
import { saveData } from '../core/storage.js';
import { runFill } from '../core/filler.js';
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
].join('');

const FORM_GROUPS = [
  ['基本信息', [
    ['name', '姓名', 'text'],
    ['englishName', '英文名/拼音', 'text'],
    ['gender', '性别', 'select', ['', '男', '女']],
    ['birthday', '出生年月', 'text', '如 2003-09'],
    ['nation', '民族', 'text'],
    ['politicalStatus', '政治面貌', 'select', ['', '中共党员', '中共预备党员', '共青团员', '民主党派', '群众']],
    ['maritalStatus', '婚姻状况', 'select', ['', '未婚', '已婚', '离异']],
    ['idCard', '身份证号', 'text'],
    ['phone', '手机号', 'text'],
    ['email', '邮箱', 'text'],
    ['wechat', '微信号', 'text'],
    ['hometown', '籍贯', 'text'],
    ['hukou', '户口所在地', 'text'],
    ['currentCity', '现居城市', 'text'],
    ['zipcode', '邮编', 'text'],
    ['address', '详细地址', 'text'],
  ]],
  ['求职意向', [
    ['applyPosition', '意向岗位', 'text'],
    ['expectCity', '意向城市', 'text'],
    ['expectSalary', '期望薪资', 'text'],
    ['availableDate', '到岗时间', 'text', '如 2027-07 / 一周内'],
    ['source', '获知渠道', 'text', '如 公司官网'],
    ['website', '个人网站/博客', 'text'],
    ['github', 'GitHub/开源', 'text'],
  ]],
  ['教育经历 · 最高学历', [
    ['school', '学校', 'text'],
    ['college', '学院', 'text'],
    ['major', '专业', 'text'],
    ['degree', '学历', 'select', ['', '硕士', '博士', '本科', '大专']],
    ['degreeLevel', '学位', 'select', ['', '学士', '硕士', '博士']],
    ['schoolCity', '学校所在地', 'text'],
    ['eduStart', '入学时间', 'text', '如 2025-09'],
    ['eduEnd', '毕业时间', 'text', '如 2027-07'],
    ['gpa', 'GPA/绩点', 'text'],
    ['rank', '排名', 'text'],
  ]],
  ['教育经历 · 本科', [
    ['bachelorSchool', '学校', 'text'],
    ['bachelorCollege', '学院', 'text'],
    ['bachelorMajor', '专业', 'text'],
    ['bachelorDegreeLevel', '学位', 'select', ['', '学士', '硕士', '博士']],
    ['bachelorStart', '入学时间', 'text', '如 2021-09'],
    ['bachelorEnd', '毕业时间', 'text', '如 2025-07'],
    ['bachelorGpa', 'GPA/绩点', 'text'],
    ['bachelorRank', '排名', 'text'],
  ]],
  ['工作 / 实习经历', [
    ['company', '公司', 'text'],
    ['department', '部门', 'text'],
    ['title', '职位', 'text'],
    ['workCity', '工作城市', 'text'],
    ['workStart', '开始时间', 'text', '如 2026-04'],
    ['workEnd', '结束时间', 'text', '如 2026-09'],
    ['workDesc', '工作内容描述', 'textarea'],
  ]],
  ['其他常用长文本', [
    ['projectDesc', '项目经历描述', 'textarea'],
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
const settings = { onlyEmpty: true, autoConsent: false, highlight: true };

// 由入口在读到资料之后调用
export function initPanel(initialData) {
  data = initialData;
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
      const wrap = el('div', 'f' + (type === 'textarea' ? ' wide' : ''));
      wrap.appendChild(el('label', null, label));
      let inp;
      if (type === 'select') {
        inp = el('select');
        (extra || ['']).forEach((o) => {
          const op = el('option', null, o === '' ? '（不填）' : o);
          op.value = o;
          inp.appendChild(op);
        });
        inp.value = draft[key] == null ? '' : String(draft[key]);
        inp.onchange = () => { draft[key] = inp.value; };
      } else if (type === 'textarea') {
        inp = el('textarea');
        inp.value = draft[key] == null ? '' : String(draft[key]);
        inp.oninput = () => { draft[key] = inp.value; };
      } else {
        inp = el('input');
        inp.type = 'text';
        if (extra) inp.placeholder = extra;
        inp.value = draft[key] == null ? '' : String(draft[key]);
        inp.oninput = () => { draft[key] = inp.value; };
      }
      wrap.appendChild(inp);
      grid.appendChild(wrap);
    });
    bd.appendChild(grid);
  });

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
        const obj = JSON.parse(String(fr.result));
        if (obj && obj.profiles && Object.keys(obj.profiles).length) {
          data = obj;
          if (!data.current || !data.profiles[data.current]) data.current = Object.keys(data.profiles)[0];
        } else if (obj && typeof obj === 'object') {
          data.profiles[data.current] = Object.assign({}, data.profiles[data.current], obj);
        } else {
          alert('这个文件里没读到资料');
          return;
        }
        saveData(data);
        lastReport = null;
        render();
      } catch (e) {
        alert('文件读不出来，确认是 UTF-8 编码的 json：' + (e && e.message ? e.message : e));
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

export function forceShow() {
  if (!document.getElementById(UI_ID)) build();
  view = 'panel';
  render();
}
