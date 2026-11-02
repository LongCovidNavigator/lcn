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
