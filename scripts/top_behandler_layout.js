(function () {
    const viewSwitch = document.querySelector('.featured-page-view-switch');
    const list = document.getElementById('featured-experts-list');
    if (!viewSwitch || !list) return;

    function tableMarkup(doctors, heading, rankOffset) {
        return `<section class="featured-ranking-group is-rest">
            <h3>${heading}</h3>
            <div class="featured-experts-table-wrap"><table class="featured-experts-table">
                <thead><tr><th scope="col">Platz</th><th scope="col">Ärzt:in</th><th scope="col">Erfahrung <span class="featured-expert-table-header-note">(n = Votes)</span></th><th scope="col">Standort</th><th scope="col">Entfernung</th><th scope="col">Versorgung</th><th scope="col">Kontakt</th></tr></thead>
                <tbody>${window.buildFeaturedExpertTableRowsHtml(doctors, rankOffset, false)}</tbody>
            </table></div>
        </section>`;
    }

    function installTableRenderer() {
        if (typeof window.buildFeaturedExpertTableRowsHtml !== 'function' || typeof window.buildFeaturedExpertCardsHtml !== 'function') return false;
        window.buildFeaturedExpertTableHtml = function (doctors) {
            return `<section class="featured-ranking-group is-top"><h3>Top 3 Ärzt:innen</h3><div class="featured-ranking-card-grid">${window.buildFeaturedExpertCardsHtml(doctors.slice(0, 3), 0)}</div></section>`
                + tableMarkup(doctors.slice(3), 'Weitere Ärzt:innen', 3);
        };
        return true;
    }

    function moveViewSwitch() {
        const restHeading = list.querySelector('.featured-ranking-group.is-rest > h3');
        if (!restHeading) return;
        let row = restHeading.parentElement.querySelector(':scope > .featured-ranking-heading-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'featured-ranking-heading-row';
            restHeading.before(row);
            row.append(restHeading);
        }
        row.append(viewSwitch);
    }

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'styles/top_behandler_layout.css?v=3';
    document.head.append(style);

    installTableRenderer();
    const observer = new MutationObserver(function () {
        installTableRenderer();
        moveViewSwitch();
    });
    observer.observe(list, {childList:true, subtree:true});
    moveViewSwitch();
})();
