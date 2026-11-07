/* Keep online results together while preserving the selected order within each list. */
window.LCNSearchOnlineGroups = (() => {
    const tables = new WeakMap();

    function partition(items, isOnline) {
        const online = [], other = [];
        items.forEach((item, index) => (isOnline(item) ? online : other).push({item, index}));
        return [online, other];
    }

    function renderTables(body, items, limit, isOnline, render, labels) {
        const table = body.parentElement;
        const [online, other] = partition(items, isOnline);
        let onlineTable = tables.get(table);
        if (!online.length) {
            resetTable(body);
            body.innerHTML = other.slice(0, limit).map(({item, index}) => render(item, index)).join("");
            return;
        }

        if (!onlineTable) {
            onlineTable = table.cloneNode(false);
            onlineTable.createCaption().textContent = labels[0];
            onlineTable.createTBody();
            table.before(onlineTable);
            tables.set(table, onlineTable);
        }
        const head = table.tHead.cloneNode(true);
        head.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
        const focusedKey = onlineTable.tHead?.contains(document.activeElement) && document.activeElement.dataset.tableSortKey;
        onlineTable.tHead?.remove();
        onlineTable.caption.after(head);
        if (focusedKey) head.querySelectorAll("[data-table-sort-key]").forEach(button => {
            if (button.dataset.tableSortKey === focusedKey) button.focus({preventScroll:true});
        });

        const onlineShown = online.slice(0, limit);
        const otherShown = other.slice(0, limit - onlineShown.length);
        onlineTable.tBodies[0].innerHTML = onlineShown.map(({item, index}) => render(item, index)).join("");
        table.createCaption().textContent = labels[1];
        table.hidden = !otherShown.length;
        body.innerHTML = otherShown.map(({item, index}) => render(item, index)).join("");
    }

    function resetTable(body) {
        const table = body.parentElement;
        tables.get(table)?.remove();
        tables.delete(table);
        table.deleteCaption();
        table.hidden = false;
    }

    function renderCards(items, limit, isOnline, render, labels) {
        const [online, other] = partition(items, isOnline);
        const onlineShown = online.slice(0, limit);
        const otherShown = other.slice(0, limit - onlineShown.length);
        const renderGroup = (group, label) => group.length
            ? (label ? `<h3 class="lcn-online-results-heading">${label}</h3>` : "")
                + group.map(({item, index}) => render(item, index)).join("")
            : "";
        return renderGroup(onlineShown, labels[0]) + renderGroup(otherShown, online.length ? labels[1] : "");
    }

    return {renderTables, resetTable, renderCards};
})();
