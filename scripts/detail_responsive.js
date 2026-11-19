// Keep the full question accessible while using compact chapter names on touch layouts.
(() => {
  const compact = matchMedia('(max-width: 1100px)');
  const touch = matchMedia('(pointer: coarse)');
  const labels = {ueberblick:'Überblick',termin:'Belastung',zugang:'Zugang & Kosten',wirkung:'Erfahrungen',alternativen:'Alternativen',dashboard:'Dashboard'};
  const links = [...document.querySelectorAll('.side-nav a[data-view]')].map(link => {
    const strong = link.querySelector('strong');
    if (!strong) return null;
    const original = strong.textContent;
    link.setAttribute('aria-label', original);
    return {link,strong,original};
  }).filter(Boolean);
  function update() {
    links.forEach(({link,strong,original}) => {strong.textContent = compact.matches ? labels[link.dataset.view] || original : original;});
    reveal();
  }
  function reveal() {
    if (!compact.matches && !touch.matches) return;
    requestAnimationFrame(() => {
      const active = document.querySelector('.side-nav a[aria-current]');
      if (!active) return;
      const rail = active.closest('.nav-items');
      const bounds = active.getBoundingClientRect(), frame = rail.getBoundingClientRect();
      if (compact.matches) {
        if (bounds.left < frame.left) rail.scrollLeft -= frame.left - bounds.left;
        else if (bounds.right > frame.right) rail.scrollLeft += bounds.right - frame.right;
      } else {
        if (bounds.top < frame.top) rail.scrollTop -= frame.top - bounds.top;
        else if (bounds.bottom > frame.bottom) rail.scrollTop += bounds.bottom - frame.bottom;
      }
    });
  }
  compact.addEventListener('change',update);
  document.addEventListener('lcn-treatment-view-changed', reveal);
  window.addEventListener('lcn-doctor-rendered', reveal);
  window.addEventListener('hashchange',reveal);
  window.addEventListener('resize', reveal);
  update();
})();

// Clamp dynamically rendered heading tooltips to the visible page width.
(() => {
  function fitTooltip(host){
    const tooltip=host?.querySelector(':scope > p');
    if(!tooltip)return;
    tooltip.style.transform='none';
    const bounds=tooltip.getBoundingClientRect();
    const width=document.documentElement.clientWidth;
    const offset=bounds.left<12?12-bounds.left:bounds.right>width-12?width-12-bounds.right:0;
    if(offset)tooltip.style.transform='translateX('+offset+'px)';
  }
  document.addEventListener('pointerover',event=>fitTooltip(event.target.closest('.ux-heading-info')));
  document.addEventListener('focusin',event=>fitTooltip(event.target.closest('.ux-heading-info')));
  window.addEventListener('resize',()=>document.querySelectorAll('.ux-heading-info').forEach(fitTooltip));
})();
