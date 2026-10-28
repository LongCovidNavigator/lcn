(() => {
  'use strict';
  window.LCNImages?.apply(document);
  const menu = document.getElementById('nd-main-menu');
  const toggle = document.querySelector('.nd-detail .detail-menu-toggle');
  if (toggle && menu) {
    menu.classList.add('detail-main-menu');
    fetch('components/header.html?v=chapters-20261024').then(response => {
      if (!response.ok) throw new Error('Navigation konnte nicht geladen werden');
      return response.text();
    }).then(html => {
      const list = new DOMParser().parseFromString(html, 'text/html').querySelector('.main-nav > ul');
      if (!list) return;
      list.querySelectorAll('[class]').forEach(node => node.removeAttribute('class'));
      menu.replaceChildren(list);
    }).catch(() => {});
    document.addEventListener('click', event => {
      if ((!menu.contains(event.target) && !toggle.contains(event.target)) || event.target.closest('#nd-main-menu a')) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
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
    if (scroll) {
      const context = document.querySelector('.ux-detail #view-content');
      (context || target || document.getElementById('view-content')).scrollIntoView({ block: 'start' });
    }
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || !document.querySelector('.nd-detail .detail-layout').contains(link)) return;
    const hash = link.getAttribute('href');
    // Map controls also use href="#"; only route actual content links.
    if (!hash || hash === '#') return;
    const aliases = { '#ablauf': 'termin', '#fuer-wen': 'ueberblick' };
    const target = document.getElementById(aliases[hash] || hash.slice(1));
    if (!target?.closest('.nd-panel')) return;
    event.preventDefault();
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
