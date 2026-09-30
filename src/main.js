// 入口：判断页面是否像申请表，挂上按钮与菜单命令
import { IS_TOP, UI_ID } from './core/env.js';
import { deepQueryAll, visible } from './core/dom.js';
import { loadData } from './core/storage.js';
import { initMessaging } from './core/messaging.js';
import { initPanel, build, forceShow, fillCurrentPage } from './ui/panel.js';

initMessaging();

function looksLikeForm() {
  const nodes = deepQueryAll('input, textarea');
  let n = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const t = (node.type || '').toLowerCase();
    if (t === 'text' || t === 'email' || t === 'tel' || node.tagName === 'TEXTAREA') {
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
    if (looksLikeForm()) { build(); return; }
    tries += 1;
    if (tries < 6) setTimeout(tick, 1800);
  };
  tick();
  try {
    GM_registerMenuCommand('简历自动填充：打开面板', forceShow);
    GM_registerMenuCommand('简历自动填充：立即填一遍', () => { forceShow(); fillCurrentPage(); });
  } catch (e) { /* 忽略 */ }
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && String(e.key).toLowerCase() === 'f') {
      e.preventDefault();
      forceShow();
    }
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();
