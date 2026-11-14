// Load the same persisted dummy preference on every page using the shared header.
(() => {
    function syncDummyToggle() {
        document.querySelectorAll('[data-lcn-dummy-toggle]').forEach(button => {
            const enabled = window.LCNDummy?.get() || false;
            button.hidden = button.disabled = !window.LCNDummy?.available
                || document.documentElement.dataset.lcnSiteRole !== 'admin';
            button.setAttribute('aria-pressed', String(enabled));
            const label = 'Dummy-Daten: ' + (enabled ? 'an' : 'aus');
            if (button.textContent !== label) button.textContent = label;
        });
    }
    if (!window.LCNDummy) {
        let script = document.querySelector('script[src*="scripts/dummy_preferences.js"]');
        if (!script) {
            script = document.createElement('script');
            script.src = new URL('dummy_preferences.js?v=local-only', document.currentScript.src).href;
            document.head.append(script);
        }
        script.addEventListener('load', () => {
            syncDummyToggle();
            if (window.LCNDummy?.get()) window.dispatchEvent(new Event('lcn-dummy-change'));
        }, {once:true});
    }
    document.addEventListener('click', event => {
        if (event.target.closest('[data-lcn-dummy-toggle]') && window.LCNDummy) window.LCNDummy.set(!window.LCNDummy.get());
    });
    window.addEventListener('lcn-dummy-change', syncDummyToggle);
    window.addEventListener('storage', event => { if (event.key === 'lcn_dummy_data_enabled' || event.key === null) syncDummyToggle(); });
    new MutationObserver(syncDummyToggle).observe(document.documentElement, {childList:true, subtree:true});
    syncDummyToggle();
})();

(function () {
    const dummySelector = '[data-lcn-dummy-toggle], #doctor-demo-toggle, #nd-demo-header-toggle';
    const cookieName = 'lcn_local_view';
    let userRequest;
    let user;

    function updateRoleControls() {
        const dummy = document.querySelector(dummySelector);
        if (!dummy && !document.querySelector('[data-admin-only]')) return;
        if (!userRequest) {
            userRequest = fetch('api/current_user.php', {credentials:'same-origin', cache:'no-store'})
                .then(response => response.ok ? response.json() : null)
                .then(data => { user = data; updateRoleControls(); })
                .catch(() => {});
        }
        if (!user) return;
        const admin = user.role === 'admin';
        document.documentElement.dataset.lcnSiteRole = user.role;
        document.querySelectorAll('[data-lcn-dummy-toggle]').forEach(button => {
            button.hidden = button.disabled = !admin || !window.LCNDummy?.available;
        });
        document.querySelectorAll('[data-admin-only]').forEach(element => { element.hidden = !admin; });
        if (!user.local_role_preview || !dummy || dummy.closest('.lcn-local-view-controls')) return;
        const header = dummy.closest('.lcn-header');
        const profile = dummy.closest('#header-placeholder .profile');
        if (!header && !profile) return;

        const group = document.createElement('div');
        group.className = 'lcn-role-toggle';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Lokale Ansicht');
        [['standard', 'Standardansicht'], ['admin', 'Admin-Ansicht']].forEach(([mode, label]) => {
            const selected = (mode === 'admin') === admin;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.setAttribute('aria-pressed', String(selected));
            button.addEventListener('click', () => {
                if (selected) return;
                document.cookie = cookieName + '=' + mode + '; Path=/; Max-Age=31536000; SameSite=Lax';
                if (mode === 'standard' && /\/(freigaben|feedback_admin|symptome|symptom_detail)\.php$/.test(location.pathname)) location.assign('index.html');
                else location.reload();
            });
            group.append(button);
        });
        const controls = document.createElement('div');
        controls.className = 'lcn-local-view-controls';
        controls.append(group, dummy);
        if (header) header.insertBefore(controls, header.querySelector('.lcn-menu-toggle'));
        else profile.insertBefore(controls, profile.querySelector('.profile-copy'));
    }
    window.addEventListener('pageshow', event => {
        if (!event.persisted || !user?.local_role_preview) return;
        const adminCookie = document.cookie.split(';').some(cookie => cookie.trim() === cookieName + '=admin');
        if (adminCookie !== (user.role === 'admin')) location.reload();
    });
    updateRoleControls();
    new MutationObserver(updateRoleControls).observe(document.documentElement, {childList:true, subtree:true});
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
            fetch('components/header.html?v=two-add-links-20261105').then(response => {
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


// Shared, independent product-feedback entry point on all pages with navigation.
(()=>{if(document.querySelector('script[data-lcn-feedback-loader]'))return;const script=document.createElement('script');script.dataset.lcnFeedbackLoader='';script.src='scripts/feedback_context.js?v=f582b5a910';script.defer=true;document.head.append(script);})();
