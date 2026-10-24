(() => {
    const navigation = document.querySelector('.home-section-nav');
    if (!navigation) return;
    const links = [...navigation.querySelectorAll('a[href^="#"]')].filter(link => link.hash !== '#start');
    const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    let scheduled = false;
    function update() {
        scheduled = false;
        const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
        const threshold = atBottom ? innerHeight / 2 : (innerWidth >= 1440 ? 100 : navigation.getBoundingClientRect().height + 24);
        let active = null;
        for (const section of sections) {
            if (section.getBoundingClientRect().top <= threshold) active = section;
        }
        for (const link of links) {
            if (active && link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        }
    }
    function schedule() {
        if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    }
    addEventListener('scroll', schedule, {passive:true});
    addEventListener('resize', schedule);
    addEventListener('load', schedule);
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.querySelector('.home-page'));
    update();
})();
