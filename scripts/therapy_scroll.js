// The rail follows the viewport rather than the bottom edge of the content card.
(() => {
  const rail = document.querySelector('body:is(.nd-detail.ux-page, .doctor-detail-live) .side-nav .nav-items');
  if (!rail) return;
  const sidebar = rail.closest('.side-nav');
  const header = document.getElementById('header-placeholder');
  const desktop = matchMedia('(min-width:1101px)');
  function place() {
    if (!desktop.matches) return;
    const box = sidebar.getBoundingClientRect();
    const style = getComputedStyle(sidebar);
    const left = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const right = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
    rail.style.setProperty('--therapy-nav-left', `${box.left + left}px`);
    rail.style.setProperty('--therapy-nav-width', `${box.width - left - right}px`);
    rail.style.setProperty('--therapy-nav-top', `${Math.max(header.getBoundingClientRect().bottom + 8, box.top + parseFloat(style.paddingTop))}px`);
  }
  new ResizeObserver(place).observe(sidebar);
  new ResizeObserver(place).observe(header);
  window.addEventListener('scroll', place, {passive:true});
  window.addEventListener('resize', place);
  desktop.addEventListener('change', place);
  place();
})();
