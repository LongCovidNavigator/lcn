(() => {
    const track = document.querySelector('.home-carousel-track');
    if (!track) return;
    const cards = [...track.querySelectorAll('.home-discover-card')];
    const nav = document.querySelector('.home-section-nav');
    const status = document.querySelector('.home-carousel-status');
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    const positionKey = 'lcn-home-carousel-position';
    let savedPosition = 0;
    try { savedPosition = Math.max(0, Number(sessionStorage.getItem(positionKey)) || 0); } catch (_) {}
    // Old section hashes must not override the last position on arrival.
    if (cards.some(card => '#' + card.id === location.hash)) {
        history.replaceState(history.state, '', location.pathname + location.search);
    }
    function restorePosition() {
        track.scrollTo({left: savedPosition, behavior: 'instant'});
        update();
    }
    function savePosition() {
        try { sessionStorage.setItem(positionKey, String(track.scrollLeft)); } catch (_) {}
    }
    const previous = document.querySelector('.home-carousel-prev');
    const next = document.querySelector('.home-carousel-next');
    function go(index) {
        const target = cards[Math.max(0, Math.min(index, cards.length - 1))];
        track.scrollTo({left: target.offsetLeft - cards[0].offsetLeft, behavior: reduced() ? 'instant' : 'smooth'});
    }
    function step(direction) {
        const max = Math.max(0, track.scrollWidth - track.clientWidth);
        if ((direction < 0 && track.scrollLeft <= 3) || (direction > 0 && track.scrollLeft >= max - 3)) return;
        const distance = cards[1].offsetLeft - cards[0].offsetLeft;
        track.scrollTo({left: Math.max(0, Math.min(track.scrollWidth - track.clientWidth, track.scrollLeft + direction * distance)), behavior: reduced() ? 'instant' : 'smooth'});
    }
    previous.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    track.addEventListener('keydown', event => {
        if (event.target !== track) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); return; }
        const targets = {Home: 0, End: cards.length - 1};
        if (event.key in targets) { event.preventDefault(); go(targets[event.key]); }
    });
    function update() {
        const max = track.scrollWidth - track.clientWidth;
        current = track.scrollLeft >= max - 3 ? cards.length - 1 : cards.reduce((best, card, i) => Math.abs(card.offsetLeft - cards[0].offsetLeft - track.scrollLeft) < Math.abs(cards[best].offsetLeft - cards[0].offsetLeft - track.scrollLeft) ? i : best, 0);
        previous.disabled = track.scrollLeft <= 3;
        next.disabled = track.scrollLeft >= max - 3;
        status.textContent = `${current + 1} / ${cards.length}`;
        const group = current < 2 ? 'empfehlung' : current === 2 ? 'hausarzt' : current < 5 ? 'suche' : 'ergaenzung';
        nav?.querySelectorAll('a').forEach(link => {
            if (link.hash === '#' + group) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }
    function openHash() {
        const index = cards.findIndex(card => '#' + card.id === location.hash);
        if (index >= 0) go(index);
    }
    nav?.addEventListener('click', event => {
        const link = event.target.closest('a');
        const index = cards.findIndex(card => '#' + card.id === link?.hash);
        if (index < 0) return;
        event.preventDefault();
        history.pushState(null, '', link.hash);
        go(index);
        document.querySelector('.home-discover').scrollIntoView({behavior:reduced() ? 'instant' : 'smooth', block:'start'});
    });
    track.addEventListener('scroll', () => { update(); savePosition(); }, {passive:true});
    track.addEventListener('focusin', event => {
        const card = event.target.closest('.home-discover-card');
        if (card) go(cards.indexOf(card));
    });
    addEventListener('hashchange', openHash);
    addEventListener('resize', update);
    restorePosition();
    addEventListener('load', restorePosition, {once:true});
    addEventListener('pagehide', savePosition);
})();
