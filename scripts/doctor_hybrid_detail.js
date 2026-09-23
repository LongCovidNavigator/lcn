// Render researched information in the existing prototype cards.
// Missing values stay unknown; community experience is never inferred from research.
function renderHybridDoctorStructure(research) {
    const entity = research.entity;
    const present = value => value !== null && value !== undefined && String(value).trim() !== '';
    const answer = value => value === 'ja' ? 'Ja' : value === 'nein' ? 'Nein' : value;
    const get = id => document.getElementById(id);
    const facts = (id, rows) => {
        const element = get(id);
        const available = rows.map(([label, value]) => [label, value ?? '']);
        if (!element) return;
        renderStructuredFactList(element, available);

    };

    document.body.classList.add('doctor-hybrid-page');
    document.querySelectorAll('.doctor-detail-guided-section, .doctor-detail-info-card, .doctor-detail-new-card-grid').forEach(element => { element.hidden = false; });
    const profile = document.querySelector('.doctor-detail-features-section');
    const access = document.querySelector('.doctor-detail-accessibility-overview');
    document.querySelector('.doctor-detail-location-section .doctor-detail-question-intro p').textContent = 'Terminform, Standorte, Ausstattung und Rücksichtnahme im Überblick.';
    if (profile && access) access.before(profile);
    setText('doctor-detail-subtitle', [entity.organisationsname, [currentDoctorDetail.loc_plz, currentDoctorDetail.loc_city].filter(Boolean).join(' ')].filter(Boolean).join(' · '));

    for (const [id, values] of [
        ['doctor-detail-specialties', research.specialty],
        ['doctor-detail-qualifications', research.qualifications],
        ['doctor-detail-specializations', research.specializations]
    ]) {
        renderTermGroup(id, values || [], '');

    }

    // The columns describe payment for each insurance group, not a general yes/no flag.
    get('doctor-detail-care').hidden = true;
    const billing = [
        ['Sprechstunde', 'sprechstunde'],
        ['Eingriffe / Behandlungen', 'eingriffe'],
        ['Verordnungen / Rezepte', 'verordnungen_und_rezepte']
    ];
    get('doctor-detail-access-billing').innerHTML = billing.length ? `<div class="doctor-hybrid-billing"><table><caption>Abrechnung nach Versicherungsgruppe</caption><thead><tr><th>Leistung</th><th>GKV-versichert</th><th>PKV-versichert</th></tr></thead><tbody>${billing.map(([label, key]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(entity[key + '_gkv'] ?? '')}</td><td>${escapeHtml(entity[key + '_pkv'] ?? '')}</td></tr>`).join('')}</tbody></table></div>` : '';
    get('doctor-detail-access-billing').insertAdjacentHTML('beforeend', `<div><dt>Kassensitz</dt><dd>${escapeHtml(answer(entity.kassensitz) ?? '')}</dd></div>`);

    const costRows = [];
    const costs = research.costs?.length ? research.costs : [{}];
    for (const cost of costs) {
        const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cost.waehrung }).format(Number(value));
        for (const [label, fromKey, toKey, commentKey] of [
            ['Ersttermin', 'ersttermin_und_erstsprechstunde_kosten', 'ersttermin_und_erstsprechstunde_kosten_bis', 'ersttermin_und_erstsprechstunde_kommentar'],
            ['Folgetermin', 'folgetermin_und_folgesprechstunde_kosten', 'folgetermin_und_folgesprechstunde_kosten_bis', 'folgetermin_und_folgesprechstunde_kommentar'],
            ['Typische Gesamtkosten', 'typische_gesamtkosten', 'typische_gesamtkosten_bis', 'typische_gesamtkosten_kommentar']
        ]) {
            const from = cost[fromKey], to = cost[toKey];
            let price = present(from) ? money(from) : '';
            if (present(to)) price += (present(from) ? ' – ' : 'Bis ') + money(to);
            costRows.push([label + ((costs.length > 1) ? ` (${cost.land})` : ''), price, cost[commentKey]]);
        }
    }
    get('doctor-detail-access-costs').innerHTML = costRows.map(([label, price, comment]) => `<div><dt>${escapeHtml(label)}</dt><dd>${price ? `<strong>${escapeHtml(price)}</strong>` : ''}</dd></div><div><dt>${escapeHtml(label)} – Kommentar</dt><dd>${comment ? `<p>${escapeHtml(comment)}</p>` : ''}</dd></div>`).join('');

    facts('doctor-detail-access-appointments', [
        ['Wartezeit bis Ersttermin', entity.wartezeit_bis_ersttermin],
        ['Warteliste', answer(entity.warteliste_vorhanden)]
    ]);
    get('doctor-detail-access-appointments').insertAdjacentHTML('beforeend', '<div><dt>Warteliste Link</dt><dd id="doctor-hybrid-waitlist-link"></dd></div>');
    if (present(entity.warteliste_link) && /^https?:\/\//i.test(entity.warteliste_link)) {
        get('doctor-hybrid-waitlist-link').innerHTML = `<a href="${escapeHtml(entity.warteliste_link)}" target="_blank" rel="noopener noreferrer">Zur Warteliste</a>`;
    }

    get('doctor-detail-appointment-matrix').innerHTML = [['Ersttermin', 'ersttermin'], ['Folgetermin', 'folgetermin']].map(([label, key]) => `<tr><th>${label}</th>${['vor_ort', 'video', 'telefon'].map(form => {
        const value = entity[key + '_' + form];
        return `<td class="${value === 'ja' ? 'is-yes' : value === 'nein' ? 'is-no' : 'is-unknown'}">${escapeHtml(answer(value) ?? '')}</td>`;
    }).join('')}</tr>`).join('');
    get('doctor-detail-home-visits').innerHTML = `<dl class="doctor-detail-fact-list"><div><dt>Hausbesuche</dt><dd>${escapeHtml(answer(entity.hausbesuche) ?? '')}</dd></div><div><dt>Kommentar</dt><dd>${escapeHtml(entity.hausbesuche_kommentar ?? '')}</dd></div></dl>`;
    // Field catalogue from Rechercheschema v0.10. User contributions have no
    // backing values yet: keep their labels visible with empty value cells.
    const userFields = {
        'doctor-detail-onsite-consideration': ['PEM und Belastungsgrenzen während des Termins berücksichtigt', 'Pausen möglich', 'Termin an geringe Belastbarkeit anpassbar'],
        'doctor-detail-onsite-waiting': ['Typische Wartezeit vor Ort', 'Ruhiger und reizarmer Wartebereich', 'Warten im Liegen möglich'],
        'doctor-detail-onsite-accessibility': ['Rollstuhlgerecht', 'Stufenlos und Aufzug', 'Liegen möglich', 'Begleitperson möglich'],
        'doctor-detail-experience-doctor': ['Nimmt Beschwerden ernst', 'Nimmt sich Zeit', 'Hört zu', 'Erklärt nachvollziehbar', 'Respektvoller Umgang'],
        'doctor-detail-experience-work': ['Gründlich', 'Berücksichtigt Vorbefunde', 'Gemeinsames Entscheiden'],
        'doctor-detail-experience-practice': ['Wohlgefühlt', 'Respektvoller Umgang', 'Gender-Erfahrungen', 'Queer und LGBTQ+'],
        'doctor-detail-expertise': ['Long Covid', 'ME/CFS', 'Post-Vac', 'POTS und Dysautonomie', 'MCAS', 'Belastungsintoleranz und PEM', 'Small-Fiber-Neuropathie'],
        'doctor-detail-help-services': ['Bescheinigungen und Atteste', 'Sozialmedizinische Unterstützung', 'Verlaufskontrolle und Nachbetreuung', 'Folgerezept-Service', 'Befundbesprechung', 'Unterstützung bei Anträgen'],
        'doctor-detail-help-medication': ['Reguläre Verordnungen', 'Off-Label-Therapien', 'Individuelle Therapieversuche'],
        'doctor-detail-help-diagnoses': ['ME/CFS (G93.3)', 'Long Covid', 'POTS und Dysautonomie', 'MCAS', 'Impfschaden', 'Small-Fiber-Neuropathie']
    };
    Object.entries(userFields).forEach(([id, labels]) => facts(id, labels.map(label => [label, ''])));

    const locations = research.locations || [];
    let extra = get('doctor-hybrid-other-locations');
    if (!extra) {
        extra = document.createElement('div');
        extra.id = 'doctor-hybrid-other-locations';
        document.querySelector('.doctor-detail-location-address').append(extra);
    }
    extra.innerHTML = locations.filter(location => Number(location.loc_id) !== Number(currentDoctorDetail.loc_id)).map(location => {
        // Older location rows use '1' for a publicly displayed street address.
        const street = ['full', '1'].includes(String(location.loc_address_visibility)) ? [location.loc_street, location.loc_housenumber].filter(Boolean).join(' ') : '';
        return `<div class="doctor-detail-location-block"><strong>${escapeHtml(location.loc_label || 'Weiterer Standort')}</strong><p>${escapeHtml([street, [location.loc_plz, location.loc_city].filter(Boolean).join(' '), location.loc_country].filter(Boolean).join(', '))}</p></div>`;
    }).join('');

    let number = 0;
    document.querySelectorAll('.doctor-detail-guided-section').forEach(section => {
        if (!section.hidden) { const badge = section.querySelector('.doctor-detail-question-number'); if (badge) badge.textContent = ++number; }
    });
}
