// 顶层框架判断与界面节点 id
export const IS_TOP = (function () { try { return window.top === window.self; } catch (e) { return false; } })();

export const UI_ID = 'resume-autofill-root';
