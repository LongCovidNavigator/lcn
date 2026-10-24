// One browser preference for all doctor and treatment profiles.
(() => {
  'use strict';
  if (window.LCNDummy) return;
  const key = 'lcn_dummy_data_enabled';
  function get() {
    try { const saved = localStorage.getItem(key); if (saved !== null) return saved === '1'; } catch (_) {}
    return new URLSearchParams(location.search).get('demo') === '1';
  }
  function set(enabled) {
    try { localStorage.setItem(key, enabled ? '1' : '0'); } catch (_) {}
    window.dispatchEvent(new Event('lcn-dummy-change'));
  }
  // A demo URL may initialize the preference once; saved choices always win.
  try { if (localStorage.getItem(key) === null) localStorage.setItem(key, get() ? '1' : '0'); } catch (_) {}
  window.LCNDummy = {key, get, set};
})();
