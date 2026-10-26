/* Apply the persisted theme before first paint, so a light-theme visitor does
 * not get a dark flash. This lives in its own file rather than inline in
 * index.html because the page ships a CSP with `script-src 'self'`: an inline
 * block would be blocked, and allowing 'unsafe-inline' to keep it would defeat
 * the policy. A classic external script in <head> still blocks parsing, so it
 * runs early enough. */
(function () {
  try {
    if (localStorage.getItem('ghscope:theme') === 'light') {
      document.documentElement.dataset.theme = 'light';
    }
  } catch {
    /* storage disabled: the default dark theme applies */
  }
})();
