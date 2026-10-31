(() => {
    const navigation = document.querySelector('.home-section-nav');
    if (!navigation) return;
    const teasers = {
        empfehlung: ['Empfehlung', 'Therapien und Behandler im Fokus'],
        suche: ['Suche', 'Entdecke Therapien und passende Behandler.'],
        ergaenzung: ['Ergänzung', 'Teile eine Behandlung oder Anlaufstelle, die noch fehlt.']
    };
    for (const [id, [title, teaser]] of Object.entries(teasers)) {
        const section = document.getElementById(id);
        if (!section) continue;
        const details = document.createElement('details');
        details.className = 'home-chapter-disclosure';
        details.open = id === 'empfehlung';
        const summary = document.createElement('summary');
        const heading = document.createElement('strong');
        heading.textContent = title;
        const description = document.createElement('span');
        description.textContent = teaser;
        const icons = {
            empfehlung: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
            hausarzt: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
            suche: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>',
            ergaenzung: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>'
        };
        const icon = document.createElement('span');
        icon.className = 'home-chapter-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[id]}</svg>`;
        const text = document.createElement('span');
        text.className = 'home-chapter-label';
        text.append(heading, description);
        summary.append(icon, text);
        const body = document.createElement('div');
        body.className = 'home-chapter-body';
        body.append(...section.childNodes);
        details.append(summary, body);
        section.append(details);
        details.addEventListener('toggle', () => {
            if (details.open) requestAnimationFrame(() => {
                if (id === 'hausarzt') window.dispatchEvent(new Event('resize'));
            });
            schedule();
        });
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('.home-ranking-toggle');
        if (!button) return;
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        const rows = button.closest('.home-ranking-content').querySelectorAll('.home-ranking-additional');
        rows.forEach(row => { row.hidden = !expanded; });
        button.setAttribute('aria-expanded', String(expanded));
        button.textContent = expanded ? 'Weniger anzeigen ↑' : `Weitere ${rows.length} anzeigen ↓`;
    });
    const links = [...navigation.querySelectorAll('a[href^="#"]')].filter(link => link.hash !== '#start');
    const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    function openTarget() {
        const section = document.getElementById(location.hash.slice(1));
        const details = section?.querySelector(':scope > details');
        if (details) details.open = true;
    }
    navigation.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link) return;
        const section = document.getElementById(link.hash.slice(1));
        const details = section?.querySelector(':scope > details');
        if (details) details.open = true;
        if (section) {
            event.preventDefault();
            history.pushState(null, '', link.hash);
            section.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        }
    });
    let scheduled = false;
    let previousActive = null;
    function update() {
        scheduled = false;
        const height = navigation.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--home-nav-height', `${height + 16}px`);
        const threshold = scrollY + innerHeight >= document.documentElement.scrollHeight - 4 ? innerHeight * 0.65 : height + 36;
        let active = sections[0];
        for (const section of sections) {
            if (section.getBoundingClientRect().top <= threshold) active = section;
        }
        for (const link of links) {
            if (active && link.hash === '#' + active.id) {
                link.setAttribute('aria-current', 'location');
                if (previousActive !== active && navigation.scrollWidth > navigation.clientWidth) {
                    navigation.scrollTo({left:link.offsetLeft - navigation.clientWidth / 2 + link.offsetWidth / 2, behavior:'smooth'});
                }
            } else link.removeAttribute('aria-current');
        }
        previousActive = active;
    }
    function schedule() {
        if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    }
    addEventListener('scroll', schedule, {passive:true});
    addEventListener('resize', schedule);
    addEventListener('load', schedule);
    addEventListener('hashchange', () => { openTarget(); schedule(); });
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.querySelector('.home-page'));
    openTarget();
    update();
})();
