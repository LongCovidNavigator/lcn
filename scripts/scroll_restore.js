(() => {
  'use strict';

  const key = 'lcn:reload-scroll';
  let position;
  if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      if (saved?.url === location.href && Number.isFinite(saved.top)) position = saved;
    } catch {
      // Native scroll restoration remains available if storage is blocked.
    }
  }

  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        url: location.href,
        top: position?.url === location.href ? position.top : window.scrollY
      }));
    } catch {
      // Storage may be disabled in this browser.
    }
  });

  if (!position) return;

  const listeners = new AbortController();
  const options = { capture: true, passive: true, signal: listeners.signal };
  const scrollingKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Tab', ' '];
  let frame = 0;
  let loaded = document.readyState === 'complete';
  const observer = new ResizeObserver(schedule);
  const timeout = window.setTimeout(stop, 10000);

  function stop() {
    position = undefined;
    observer.disconnect();
    listeners.abort();
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (document.querySelector('[data-scroll-restore-pending]')) return;
      window.scrollTo({ top: position.top, behavior: 'instant' });
      // Search results can arrive after load and make the saved position reachable.
      if (loaded && Math.abs(window.scrollY - position.top) < 1) stop();
    });
  }

  observer.observe(document.body);
  window.addEventListener('load', () => {
    loaded = true;
    schedule();
  }, options);
  window.addEventListener('lcn:scroll-ready', schedule, options);
  window.addEventListener('pagehide', stop, { signal: listeners.signal });
  window.addEventListener('hashchange', stop, options);
  for (const event of ['wheel', 'touchmove', 'pointerdown']) {
    window.addEventListener(event, stop, options);
  }
  window.addEventListener('keydown', event => {
    if (scrollingKeys.includes(event.key)) stop();
  }, options);
  schedule();
})();
