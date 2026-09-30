// 跨框架调度：招聘官网常把申请表放在 iframe 里，主页面上的按钮要能指挥子框架一起填
import { IS_TOP } from './env.js';
import { runFill } from './filler.js';

export const RUN_MSG = '__resume_autofill_run__';
export const RES_MSG = '__resume_autofill_result__';
export const FRAME_ID = Math.random().toString(36).slice(2);

export function relayToChildren(msg) {
  const kids = window.frames;
  for (let i = 0; i < kids.length; i += 1) {
    try { kids[i].postMessage(msg, '*'); } catch (e) { /* 跨域忽略 */ }
  }
}

export function initMessaging() {
  window.addEventListener('message', (ev) => {
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
        unknown: st.unknown.slice(0, 20),
      };
      try {
        if (IS_TOP) window.postMessage(payload, '*');
        else window.top.postMessage(payload, '*');
      } catch (e) { /* 忽略 */ }
    });
  });
}
