// Keep the page title in the shared header, including asynchronously loaded headers.
(() => {
    const host = document.getElementById('header-placeholder');
    const title = document.body.dataset.searchTitle;
    if (!host || !title) return;
    function syncTitle() {
        const brand = host.querySelector('.lcn-brand');
        if (!brand || host.querySelector('#search-page-title')) return;
        const heading = document.createElement('h1');
        heading.id = 'search-page-title';
        heading.textContent = title;
        brand.after(heading);
    }
    new MutationObserver(syncTitle).observe(host, {childList:true, subtree:true});
    syncTitle();
})();
