// Table folding is shared by both search pages and preserves mounted results.
document.querySelectorAll('[data-lcn-table-toggle]').forEach(button => {
    const content = document.getElementById(button.getAttribute('aria-controls'));
    if (!content) return;
    button.addEventListener('click', () => {
        content.hidden = !content.hidden;
        button.setAttribute('aria-expanded', String(!content.hidden));
        button.querySelector('.lcn-search-table-chevron').textContent = content.hidden ? '⌄' : '⌃';
    });
});

// Keep each search page's filter panel state across reloads and navigation.
for (const prefix of ['doctor', 'treatment']) {
    const button = document.getElementById(`${prefix}-navigation-toggle-button`);
    const content = document.getElementById(`${prefix}-navigation-content`);
    if (!button || !content) continue;

    const storageKey = `lcn_filter_panel_expanded_${prefix}`;
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved === 'true' || saved === 'false') {
            const collapsed = saved === 'false';
            content.classList.toggle('is-collapsed', collapsed);
            button.classList.toggle('is-collapsed', collapsed);
            button.setAttribute('aria-expanded', saved);
        }
    } catch (_) {}

    new MutationObserver(() => {
        try {
            localStorage.setItem(storageKey, button.getAttribute('aria-expanded'));
        } catch (_) {}
    }).observe(button, {attributes: true, attributeFilter: ['aria-expanded']});
}
