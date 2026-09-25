(() => {
  'use strict';
  window.LCNImages?.apply(document);
  const menu = document.getElementById('nd-main-menu');
  const toggle = document.querySelector('.nd-detail .detail-menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => { menu.hidden = !menu.hidden; toggle.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
    new ResizeObserver(() => document.documentElement.style.setProperty('--detail-header-height', document.getElementById('header-placeholder').getBoundingClientRect().height + 'px')).observe(document.getElementById('header-placeholder'));
  }
  const links = [...document.querySelectorAll('.nd-detail .side-nav [data-view]')];
  if (!links.length) return;
  const panels = links.map(link => document.getElementById(link.dataset.view));
  function show(hash, scroll = false) {
    const aliases = { '#ablauf': 'termin', '#fuer-wen': 'ueberblick' };
    const target = document.getElementById(aliases[hash] || hash.slice(1));
    const panel = target?.closest('.nd-panel') || panels[0];
    panels.forEach(p => { p.hidden = p !== panel; });
    links.forEach(link => { if (link.dataset.view === panel.id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    if (scroll) (target || document.getElementById('view-content')).scrollIntoView({ block: 'start' });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !document.querySelector('.nd-detail .detail-layout').contains(link)) return;
    event.preventDefault();
    const hash = link.getAttribute('href');
    history.pushState(null, '', hash);
    show(hash, true);
  });
  links.forEach((link, index) => link.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % links.length;
    if (event.key === 'ArrowUp') next = (index + links.length - 1) % links.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = links.length - 1;
    if (next !== undefined) { event.preventDefault(); links[next].click(); links[next].focus(); }
  }));
  show(location.hash);
  window.addEventListener('hashchange', () => show(location.hash));
  window.addEventListener('popstate', () => show(location.hash));
})();
