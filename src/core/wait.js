// 等一个条件成立：优先靠 DOM 变化驱动，另有定时兜底，
// 时间一到就放行，不用固定轮询把时间浪费掉
export function waitFor(predicate, options) {
  const opts = options || {};
  const timeout = opts.timeout == null ? 5000 : opts.timeout;
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
      try { value = predicate(); } catch (e) { value = null; }
      if (value) finish(value);
    };
    timer = setInterval(check, interval);
    deadline = setTimeout(() => finish(null), timeout);
    if (typeof MutationObserver === 'function' && opts.root) {
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
