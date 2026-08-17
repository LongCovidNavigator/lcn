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
