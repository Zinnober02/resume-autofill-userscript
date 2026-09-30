// 测试用的浏览器环境：用 jsdom 加载打包好的油猴脚本
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const userscriptPath = path.join(root, 'dist/resume-autofill.user.js');

export const RUN_MSG = '__resume_autofill_run__';
export const RES_MSG = '__resume_autofill_result__';

// 加载页面与脚本；GM_* 用内存里的键值对顶替
// 资料结构要求几个数组都在，这里给测试用的资料补上空数组
export function storageWith(profile) {
  const full = Object.assign(
    { educations: [], works: [], certificates: [], patents: [], papers: [], awards: [], family: [], activities: [], projects: [], extra: [] },
    profile,
  );
  return { v: 1, current: '默认', profiles: { '默认': full } };
}

export async function createPage(html, scriptPath, options) {
  const code = await readFile(scriptPath || userscriptPath, 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://jobs.example.com/apply',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom 不做排版，这里给每个元素一个非零矩形，让可见性判断与排序贴近真实页面
  let layoutSeq = 0;
  const tops = new WeakMap();
  window.Element.prototype.getBoundingClientRect = function () {
    if (!tops.has(this)) tops.set(this, (layoutSeq += 30));
    const top = tops.get(this);
    return { x: 0, y: top, top, left: 0, right: 120, bottom: top + 24, width: 120, height: 24, toJSON() { return this; } };
  };
  const store = new Map();
  if (options && options.storage) store.set('ra_data_v1', options.storage);
  window.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  window.GM_setValue = (key, value) => { store.set(key, value); };
  window.GM_registerMenuCommand = () => {};
  // jsdom 不实现下载，这里记录 createObjectURL 与 a.click 的调用
  const blobs = [];
  const downloads = [];
  window.URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:test/' + blobs.length; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ download: this.download, href: this.href });
  };
  window.eval(code);
  await new Promise((r) => setTimeout(r, 0));
  return { dom, window, store, blobs, downloads };
}

// 界面挂在 shadow DOM 里，测试统一从这里取
export function shadowOf(window) {
  const host = window.document.getElementById('resume-autofill-root');
  if (!host) throw new Error('页面上没有插入界面节点');
  return host.shadowRoot;
}

export function buttonByText(shadow, text) {
  const list = Array.from(shadow.querySelectorAll('button'));
  const hit = list.find((b) => b.textContent.trim() === text);
  if (!hit) throw new Error('面板上找不到按钮：' + text);
  return hit;
}

// 用脚本自己的消息协议触发一次填充，等它回报结果
export function runFill(window, profile, options) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('等待填充结果超时')), 5000);
    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d || d.type !== RES_MSG) return;
      clearTimeout(timer);
      resolve(d);
    });
    window.postMessage({ type: RUN_MSG, profile, options }, '*');
  });
}

export function field(dom, selector) {
  const el = dom.window.document.querySelector(selector);
  if (!el) throw new Error('页面上找不到控件：' + selector);
  return el;
}
