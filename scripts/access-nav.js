(function () {
    let requested = false;
    async function revealAdminNavigation() {
        if (requested) return;
        const targets = document.querySelectorAll('[data-admin-only]');
        if (!targets.length) return;
        requested = true;
        try {
            const response = await fetch('api/current_user.php', {credentials:'same-origin', cache:'no-store'});
            const data = await response.json();
            if (data.role === 'admin') targets.forEach(element => { element.hidden = false; });
        } catch (_) { /* Server-side access control remains authoritative. */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealAdminNavigation);
    else revealAdminNavigation();
    new MutationObserver(revealAdminNavigation).observe(document.documentElement, {childList:true, subtree:true});
})();

// Event delegation also covers headers inserted after page load.
(() => {
    if (window.lcnNavigationReady) return;
    window.lcnNavigationReady = true;
    const navigationSelector = '.lcn-nav, .home-nav, .detail-main-menu';
    const closeDropdowns = (root, except) => root.querySelectorAll('details[open]').forEach(details => {
        if (details !== except) details.open = false;
    });
    const closeHeader = header => {
        closeDropdowns(header);
        header.querySelector('.lcn-nav')?.classList.remove('is-open');
        const button = header.querySelector('.lcn-menu-toggle');
        button?.setAttribute('aria-expanded', 'false');
        button?.setAttribute('aria-label', 'Hauptnavigation öffnen');
    };
    document.addEventListener('click', event => {
        const button = event.target.closest('.lcn-menu-toggle');
        if (button) {
            const header = button.closest('.lcn-header');
            const opened = header.querySelector('.lcn-nav').classList.toggle('is-open');
            button.setAttribute('aria-expanded', String(opened));
            button.setAttribute('aria-label', opened ? 'Hauptnavigation schließen' : 'Hauptnavigation öffnen');
            if (!opened) closeDropdowns(header);
            return;
        }
        const navigation = event.target.closest(navigationSelector);
        const summary = event.target.closest('summary');
        if (navigation && summary) closeDropdowns(navigation, summary.closest('details'));
        document.querySelectorAll(navigationSelector).forEach(root => {
            if (!root.contains(event.target) || event.target.closest('a')) closeDropdowns(root);
        });
        document.querySelectorAll('.lcn-header').forEach(header => {
            if (!header.contains(event.target) || event.target.closest('a')) closeHeader(header);
        });
    });
    document.addEventListener('toggle', event => {
        if (event.target.matches('details[open]')) {
            const navigation = event.target.closest(navigationSelector);
            if (navigation) closeDropdowns(navigation, event.target);
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const opened = document.querySelector(navigationSelector.split(', ').map(selector => selector + ' details[open]').join(', '));
        if (opened) {
            closeDropdowns(opened.closest(navigationSelector));
            opened.querySelector('summary')?.focus();
        } else {
            const header = document.querySelector('.lcn-header:has(.lcn-nav.is-open)');
            if (header) { closeHeader(header); header.querySelector('.lcn-menu-toggle').focus(); }
        }
    });
    const initialize = () => {
        const placeholder = document.querySelector('[data-lcn-header]');
        if (placeholder && !placeholder.dataset.loading) {
            placeholder.dataset.loading = 'true';
            fetch('components/header.html?v=menu-icon-20261016').then(response => {
                if (!response.ok) throw new Error('Header konnte nicht geladen werden.');
                return response.text();
            }).then(html => { placeholder.innerHTML = html; }).catch(() => {
                placeholder.dataset.loading = 'failed';
                placeholder.innerHTML = '<a href="index.html">Long Covid Navigator</a>';
            });
        }
        const page = location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.lcn-nav a').forEach(link => {
            if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
    new MutationObserver(initialize).observe(document.documentElement, {childList:true, subtree:true});
})();
