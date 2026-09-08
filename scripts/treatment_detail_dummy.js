(function () {
    'use strict';

    const scenario = new URLSearchParams(location.search).get('scenario') || 'complete';
    const activeScenario = ['complete', 'research', 'voting', 'hybrid'].includes(scenario) ? scenario : 'complete';
    const fixture = new URLSearchParams(location.search).get('fixture') || '';
    const status = document.getElementById('tdd-status');
    const content = document.getElementById('tdd-content');

    document.querySelectorAll('[data-scenario-link]').forEach(link => {
        const url = new URL(link.href, location.href);
        if (fixture) url.searchParams.set('fixture', fixture);
        link.href = url;
        const active = link.dataset.scenarioLink === activeScenario;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
    });

    fetch(`api/treatment_detail_dummy.php?scenario=${encodeURIComponent(activeScenario)}&fixture=${encodeURIComponent(fixture)}`, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Testdaten konnten nicht geladen werden.');
            return response.json();
        })
        .then(render)
        .catch(error => {
            status.classList.add('is-error');
            status.textContent = error.message;
        });

    function render(payload) {
        const t = payload.treatment;
        const experience = t.experience;
        const isVotingOnly = payload.meta.scenario === 'voting';
        const isHybridOnly = payload.meta.scenario === 'hybrid';
        content.innerHTML = `
            <header class="tdd-hero">
                <div class="tdd-avatar">${escape(t.short_name)}</div>
                <div class="tdd-hero-copy">
                    <span class="tdd-eyebrow">Therapie-Steckbrief · Testdaten</span>
                    <h1>${escape(t.name)}</h1>
                    <p>${isVotingOnly ? 'Nur aggregierte Community-Angaben' : (isHybridOnly ? 'Nur hybride Angaben' : `${escape(t.type)} · ${escape(t.subcategory)}`)}</p>
                    <div class="tdd-tags"><span>${escape(t.short_name)}</span>${!isVotingOnly && t.application ? `<span>${escape(t.application)}</span>` : ''}</div>
                </div>
                <div class="tdd-hero-facts">
                    <div><small>Anbieter</small><strong>${isVotingOnly ? '—' : (t.providers.length || '—')}</strong></div>
                    <div><small>Bewertungen</small><strong>${isHybridOnly ? '—' : (experience ? experience.total : '—')}</strong></div>
                </div>
            </header>
            <div class="tdd-scenario-note"><strong>Gezeigter Datenstand:</strong> ${escape(payload.meta.scenario_labels[payload.meta.scenario])}</div>

            ${payload.meta.scenario === 'voting' ? votingOnlySections(experience) : (payload.meta.scenario === 'hybrid' ? hybridOnlySections(t) : (payload.meta.scenario === 'research' ? researchOnlySections(t) : standardSections(t, experience)))}

            <aside class="tdd-disclaimer"><strong>Wichtig:</strong> Diese vollständig isolierte Testansicht enthält fiktive Beispieldaten. Sie ist keine medizinische Empfehlung und ersetzt keine ärztliche Beratung.</aside>
        `;
        status.hidden = true;
        content.hidden = false;
        initializeProviderArea(t.providers);
    }

    function standardSections(t, experience) {
        return `
            ${section(1, 'Wie zugänglich ist die Behandlung für mich?', 'Voraussetzungen, Status und finanzielle Orientierung.', accessHtml(t))}
            ${section(2, 'Kann ich die Behandlung gesundheitlich bewältigen?', 'Aufwand, Setting und mögliche Belastungen.', feasibilityHtml(t, experience))}
            ${section(3, 'Welche Erfahrungen gibt es mit der Behandlung?', 'Aggregierte Angaben von Betroffenen.', experienceHtml(experience), !experience)}
            ${section(4, 'Was zeichnet die Behandlung fachlich aus?', 'Einordnung, Wirkstoff und redaktionelle Quellen.', professionalHtml(t))}
            ${section(5, 'Wie kann mir die Behandlung helfen?', 'Beschwerden, zu denen Erfahrungen oder Hinweise vorliegen.', symptomsHtml(t.symptoms), !t.symptoms.length)}
            ${section(6, 'Welche verwandten oder alternativen Behandlungen gibt es?', 'Weitere Möglichkeiten fachlich einordnen und direkt erkunden.', relationshipsHtml(t.relationships), relationshipsEmpty(t.relationships))}
            ${section(7, 'Wer bietet diese Behandlung an?', 'Beispielhafte Anbieter analog zur Arzt-Detailseite.', providersHtml(t.providers), !t.providers.length)}`;
    }

    function researchOnlySections(t) {
        return `
            ${section(1, 'Wie zugänglich ist die Behandlung für mich?', 'Redaktionell recherchierte Voraussetzungen und Statusangaben.', `${accessResearchHtml(t)}${missingFieldsHtml(['Kosten'])}`)}
            ${section(2, 'Kann ich die Behandlung gesundheitlich bewältigen?', 'Diese Angaben werden hybrid oder durch Abstimmungen erhoben.', missingFieldsHtml(['Durchführungssetting', 'Behandlungsumfang', 'Praktische Bewältigbarkeit', 'Crash-/PEM-Risiko']), true)}
            ${section(3, 'Welche Erfahrungen gibt es mit der Behandlung?', 'Diese Angaben stammen aus Abstimmungen.', missingFieldsHtml(['Gesamtbewertung', 'Gamechanger', 'Zeit bis zur wahrgenommenen Veränderung']), true)}
            ${section(4, 'Was zeichnet die Behandlung fachlich aus?', 'Redaktionelle Einordnung und geprüfte Quellen.', researchProfessionalHtml(t))}
            ${section(5, 'Wie kann mir die Behandlung helfen?', 'Symptomzuordnungen werden hybrid erhoben.', missingFieldsHtml(['Symptome / Beschwerden']), true)}
            ${section(6, 'Welche verwandten oder alternativen Behandlungen gibt es?', 'Treatment-Beziehungen werden hybrid gepflegt.', missingFieldsHtml(['Verwandte Behandlungen', 'Alternative Präparate', 'Alternative Behandlungen / Ansätze']), true)}
            ${section(7, 'Wer bietet diese Behandlung an?', 'Anbieter werden recherchiert und durch Vorschläge ergänzt.', missingFieldsHtml(['Anbieterkarte', 'Anbieterliste']), true)}`;
    }

    function accessResearchHtml(t) {
        return `<div class="tdd-scale-grid">${scaleCard('Zugang', ['Frei erhältlich', 'Ärztliche Verordnung', 'Nur Studie'], 'Ärztliche Verordnung', 'Redaktionell recherchiert')}${scaleCard('Zulassung für Long COVID / ME/CFS', ['Nein', 'Ja'], t.approved_for_condition ? 'Ja' : 'Nein', 'Redaktionell recherchiert')}${scaleCard('Off-Label-Status', ['Kein Off-Label', 'Off-Label'], t.off_label ? 'Off-Label' : 'Kein Off-Label', 'Redaktionell recherchiert')}</div>${studiesHtml(t.studies, t.research_status)}${reimbursementHtml(t)}`;
    }

    function researchProfessionalHtml(t) {
        return `<article class="tdd-card tdd-description"><h3>Allgemeine Beschreibung</h3><p>${escape(t.description)}</p><dl><div><dt>Typ</dt><dd>${escape(t.type)}</dd></div><div><dt>Unterkategorie</dt><dd>${escape(t.subcategory)}</dd></div><div><dt>Applikationsform</dt><dd><span class="tdd-muted">In diesem Modus nicht befüllt</span></dd></div></dl></article><div class="tdd-split">${groupCard('Medikamenteninformationen', [['Wirkstoff', t.medication.active_ingredient], ['Handels-/Markenname', t.medication.brand], ['Medikamentenklasse', t.medication.class]])}<div>${groupCard('Klassifikation', [['ATC', t.classification.atc], ['ICHI', t.classification.ichi]])}<article class="tdd-card"><h3>Alternative Bezeichnungen</h3><div class="tdd-tags">${t.aliases.map(alias => `<span>${escape(alias)}</span>`).join('')}</div></article></div></div>${missingFieldsHtml(['Dosierung'])}<article class="tdd-card"><div class="tdd-card-title"><h3>Quellen und weiterführende Links</h3><span>Geprüft: ${escape(t.reviewed_at)}</span></div><ul class="tdd-sources">${t.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ↗</a></li>`).join('')}</ul></article>`;
    }

    function votingOnlySections(experience) {
        return `
            ${section(1, 'Wie zugänglich ist die Behandlung für mich?', 'Voraussetzungen, Status und finanzielle Orientierung.', missingFieldsHtml(['Zugang', 'Zulassung', 'Off-Label-Status', 'Forschungsstatus', 'Kosten', 'Kostenübernahme']), true)}
            ${section(2, 'Kann ich die Behandlung gesundheitlich bewältigen?', 'Nutzerangabe zum Belastungsrisiko.', `${scaleCard('Crash-/PEM-Risiko', ['Keines', 'Niedrig', 'Mittel', 'Hoch'], experience.pem_risk, 'Aus Angaben von Betroffenen')}${missingFieldsHtml(['Durchführungssetting', 'Behandlungsumfang', 'Praktische Bewältigbarkeit'])}`)}
            ${section(3, 'Welche Erfahrungen gibt es mit der Behandlung?', 'Aggregierte Angaben von Betroffenen.', experienceHtml(experience))}
            ${section(4, 'Was zeichnet die Behandlung fachlich aus?', 'Einordnung, Wirkstoff und redaktionelle Quellen.', missingFieldsHtml(['Allgemeine Beschreibung', 'Typ / Unterkategorie', 'Applikationsform', 'Medikamenteninformationen', 'Klassifikation', 'Alternative Bezeichnungen', 'Quellen / Prüfdatum']), true)}
            ${section(5, 'Wie kann mir die Behandlung helfen?', 'Beschwerden, zu denen Erfahrungen oder Hinweise vorliegen.', missingFieldsHtml(['Symptome / Beschwerden']), true)}
            ${section(6, 'Welche verwandten oder alternativen Behandlungen gibt es?', 'Dieser hybride Bereich gehört nicht zu den reinen Abstimmungsdaten.', missingFieldsHtml(['Verwandte Behandlungen', 'Alternative Präparate', 'Alternative Behandlungen / Ansätze']), true)}
            ${section(7, 'Wer bietet diese Behandlung an?', 'Anbieterinformationen gehören nicht zu den Abstimmungsdaten.', missingFieldsHtml(['Anbieterkarte', 'Anbieterliste']), true)}`;
    }

    function hybridOnlySections(t) {
        return `
            ${section(1, 'Wie zugänglich ist die Behandlung für mich?', 'Hybride Angaben zu Kosten und Übernahme.', `${missingFieldsHtml(['Zugang', 'Zulassung', 'Off-Label-Status', 'Forschungsstatus'])}<div class="tdd-split">${groupCard('Kosten', [['Pro Monat', t.costs.unit], ['Typischer Zeitraum', t.costs.typical_count], ['Gesamtkosten', t.costs.total], ['Laufende Kosten', t.costs.ongoing]])}${scaleCard('Kostenübernahme', ['GKV möglich', 'PKV / Selbstzahler', 'Nur Selbstzahler'], t.reimbursement, 'Hybrid aus Recherche und Erfahrungen')}</div>`)}
            ${section(2, 'Kann ich die Behandlung gesundheitlich bewältigen?', 'Hybride Angaben zu Setting, Umfang und praktischer Bewältigbarkeit.', `${hybridFeasibilityHtml(t)}${missingFieldsHtml(['Crash-/PEM-Risiko'])}`)}
            ${section(3, 'Welche Erfahrungen gibt es mit der Behandlung?', 'Reine Abstimmungswerte sind in diesem Modus ausgeblendet.', missingFieldsHtml(['Gesamtbewertung', 'Gamechanger', 'Zeit bis zur wahrgenommenen Veränderung']), true)}
            ${section(4, 'Was zeichnet die Behandlung fachlich aus?', 'Hybride Angaben zu Anwendung und Dosierung.', `${groupCard('Anwendung', [['Applikationsform', t.application], ['Dosierung', t.medication.dosage]])}${missingFieldsHtml(['Allgemeine Beschreibung', 'Typ / Unterkategorie', 'Wirkstoff / Handelsname / Medikamentenklasse', 'Klassifikation', 'Alternative Bezeichnungen', 'Quellen / Prüfdatum'])}`)}
            ${section(5, 'Wie kann mir die Behandlung helfen?', 'Hybrid zugeordnete Beschwerden.', symptomsHtml(t.symptoms))}
            ${section(6, 'Welche verwandten oder alternativen Behandlungen gibt es?', 'Hybrid gepflegte Treatment-Verknüpfungen.', relationshipsHtml(t.relationships))}
            ${section(7, 'Wer bietet diese Behandlung an?', 'Hybrid aus recherchierten und vorgeschlagenen Anbietern.', providersHtml(t.providers))}`;
    }

    function hybridFeasibilityHtml(t) {
        return `<div class="tdd-card-grid is-two">${scaleCard('Durchführungssetting', ['Zu Hause', 'Hausbesuch', 'Ambulant', 'Stationär'], normalizeSetting(t.setting), 'Hybrid aus Recherche und Erfahrungen')}</div><div class="tdd-split">${groupCard('Behandlungsumfang', [['Dauer pro Einnahme', t.scope.duration], ['Häufigkeit', t.scope.frequency], ['Anzahl', t.scope.count], ['Gesamtdauer', t.scope.total_duration]])}<article class="tdd-card"><h3>Praktische Bewältigbarkeit</h3><ul class="tdd-checks">${t.accessibility.map(item => `<li><span class="${item.value ? 'yes' : 'no'}">${item.value ? 'Ja' : 'Nein'}</span>${escape(item.label)}</li>`).join('')}</ul></article></div>`;
    }

    function missingFieldsHtml(labels) {
        return `<div class="tdd-missing-grid">${labels.map(label => `<article class="tdd-missing-field"><h3>${escape(label)}</h3><p><span aria-hidden="true">—</span> In diesem Modus nicht befüllt</p></article>`).join('')}</div>`;
    }

    function section(number, title, subtitle, html, empty = false) {
        return `<section class="tdd-section ${empty ? 'is-empty' : ''} ${number === 7 ? 'is-provider-section' : ''}">
            <aside class="tdd-section-heading"><span>${number}</span><div><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></div></aside>
            <div class="tdd-section-body">${html}</div>
        </section>`;
    }

    function accessHtml(t) {
        return `<div class="tdd-scale-grid">
            ${scaleCard('Zugang', ['Frei erhältlich', 'Ärztliche Verordnung', 'Nur Studie'], 'Ärztliche Verordnung', 'Von leicht bis stark eingeschränkt')}
            ${scaleCard('Zulassung für Long COVID / ME/CFS', ['Nein', 'Ja'], t.approved_for_condition ? 'Ja' : 'Nein', 'Zulassung für die konkrete Indikation')}
            ${scaleCard('Off-Label-Status', ['Kein Off-Label', 'Off-Label'], t.off_label ? 'Off-Label' : 'Kein Off-Label', 'Nur relevant bei Arzneimitteln')}
        </div>
        ${studiesHtml(t.studies, t.research_status)}
        <div class="tdd-split">
            ${groupCard('Kosten', t.costs ? [['Pro Monat', t.costs.unit], ['Typischer Zeitraum', t.costs.typical_count], ['Gesamtkosten', t.costs.total], ['Laufende Kosten', t.costs.ongoing]] : null)}
            ${reimbursementHtml(t)}
        </div>`;
    }

    function studiesHtml(studies, fallbackStatus) {
        if (!studies?.length) return fallbackStatus ? `<div class="tdd-study-section">${scaleCard('Forschungsstatus', ['Phase I', 'Phase II', 'Phase III', 'Zugelassen'], fallbackStatus, 'Forschungsstand')}</div>` : '';
        return `<section class="tdd-study-section"><div class="tdd-card-title"><h3>Studien</h3><span>${studies.length} recherchierte Einträge</span></div><div class="tdd-study-grid">${studies.map(study => `<article class="tdd-card tdd-study-card"><div><span>${escape(study.kind || 'Studie')}</span>${study.phase ? `<strong>${escape(study.phase)}</strong>` : '<strong>Keine Studienphase angegeben</strong>'}</div><h4>${escape(study.name)}</h4>${study.url ? `<a href="${escape(study.url)}" target="_blank" rel="noopener noreferrer">Studie öffnen ↗</a>` : ''}</article>`).join('')}</div></section>`;
    }

    function reimbursementHtml(t) {
        const details = t.reimbursement_details;
        if (!details) return scaleCard('Kostenübernahme', ['GKV möglich', 'PKV / Selbstzahler', 'Nur Selbstzahler'], t.reimbursement, 'Von breiter Erstattung bis vollständig privat');
        return `<section class="tdd-reimbursement"><div class="tdd-card-title"><h3>Kostenübernahme</h3><span>GKV und PKV getrennt</span></div><div class="tdd-reimbursement-grid">${['gkv', 'pkv'].map(key => { const item = details[key]; const label = key.toUpperCase(); return `<article class="tdd-card tdd-reimbursement-card"><div class="tdd-reimbursement-status"><span>${label}</span><strong class="is-${String(item.status).toLowerCase() === 'ja' ? 'yes' : 'no'}">${escape(item.status)}</strong></div><small>${escape(item.certainty || '')}</small><p>${escape(item.note || '')}</p>${item.url ? `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">Quelle öffnen ↗</a>` : ''}</article>`; }).join('')}</div></section>`;
    }

    function feasibilityHtml(t, experience) {
        return `<div class="tdd-card-grid is-two">
            ${scaleCard('Durchführungssetting', ['Zu Hause', 'Hausbesuch', 'Ambulant', 'Stationär'], normalizeSetting(t.setting), 'Von wenig bis viel organisatorischem Aufwand')}
            ${experience ? scaleCard('Crash-/PEM-Risiko', ['Keines', 'Niedrig', 'Mittel', 'Hoch'], experience.pem_risk, 'Aus Angaben von Betroffenen') : factCard('Crash-/PEM-Risiko', null)}
        </div>
        <div class="tdd-split">
            ${groupCard('Behandlungsumfang', t.scope ? [['Dauer pro Einnahme', t.scope.duration], ['Häufigkeit', t.scope.frequency], ['Anzahl', t.scope.count], ['Gesamtdauer', t.scope.total_duration]] : null)}
            <article class="tdd-card"><h3>Praktische Bewältigbarkeit</h3>${t.accessibility.length ? `<ul class="tdd-checks">${t.accessibility.map(item => `<li><span class="${item.value ? 'yes' : 'no'}">${item.value ? 'Ja' : 'Nein'}</span>${escape(item.label)}</li>`).join('')}</ul>` : empty('Noch keine belastbaren Angaben vorhanden.')}</article>
        </div>`;
    }

    function experienceHtml(x) {
        if (!x) return empty('Für diese Ansicht werden bewusst keine Abstimmungs- und Erfahrungsdaten gezeigt.');
        return `<div class="tdd-rating-layout">
            <article class="tdd-card"><h3>Gesamtbewertung <small>n=${x.total}</small></h3><div class="tdd-ratings">
                ${rating('Positiv', x.ratings.positive, 'positive')}${rating('Neutral', x.ratings.neutral, 'neutral')}${rating('Negativ', x.ratings.negative, 'negative')}
            </div></article>
            <article class="tdd-card tdd-gamechanger"><span>${x.gamechanger} %</span><div><h3>Gamechanger</h3><p>bezeichneten die Behandlung als entscheidend für ihre Verbesserung.</p></div></article>
        </div>
        <article class="tdd-card"><h3>Zeit bis zur wahrgenommenen Veränderung</h3><div class="tdd-bars">${x.onset.map(row => `<div><span>${escape(row.label)}</span><i><b style="width:${row.value}%"></b></i><strong>${row.value} %</strong></div>`).join('')}</div></article>`;
    }

    function professionalHtml(t) {
        return `<article class="tdd-card tdd-description"><h3>Allgemeine Beschreibung</h3><p>${escape(t.description)}</p><dl><div><dt>Typ</dt><dd>${escape(t.type)}</dd></div><div><dt>Unterkategorie</dt><dd>${escape(t.subcategory)}</dd></div><div><dt>Applikationsform</dt><dd>${value(t.application)}</dd></div></dl></article>
        <div class="tdd-split">
            ${groupCard('Medikamenteninformationen', [['Wirkstoff', t.medication.active_ingredient], ['Handels-/Markenname', t.medication.brand], ['Medikamentenklasse', t.medication.class], ['Dosierung', t.medication.dosage]])}
            <div>
                ${groupCard('Klassifikation', [['ATC', t.classification.atc], ['ICHI', t.classification.ichi]])}
                <article class="tdd-card"><h3>Alternative Bezeichnungen</h3><div class="tdd-tags">${t.aliases.map(alias => `<span>${escape(alias)}</span>`).join('')}</div></article>
            </div>
        </div>
        <article class="tdd-card"><div class="tdd-card-title"><h3>Quellen und weiterführende Links</h3><span>Geprüft: ${escape(t.reviewed_at)}</span></div><ul class="tdd-sources">${t.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ↗</a></li>`).join('')}</ul></article>`;
    }

    function symptomsHtml(symptoms) {
        return symptoms.length ? `<div class="tdd-symptoms">${symptoms.map(s => `<span>${escape(s)}</span>`).join('')}</div>` : empty('Für diese Ansicht werden noch keine hybriden Symptomzuordnungen gezeigt.');
    }

    function relationshipsEmpty(relationships) {
        return !relationships || (!relationships.related_treatments.items.length && !relationships.alternative_products.length && !relationships.alternative_treatments.length);
    }

    function relationshipsHtml(relationships) {
        if (relationshipsEmpty(relationships)) return empty('In diesem Datenstand werden keine hybriden Treatment-Verknüpfungen gezeigt.');
        const related = relationships.related_treatments;
        return `<div class="tdd-relationship-groups">
            <article class="tdd-relationship-group is-alternatives">
                <div class="tdd-relationship-heading"><div><span>Andere Möglichkeiten</span><h3>Alternative Behandlungen / Ansätze</h3></div><small>Fachlich recherchierte Beziehungen</small></div>
                <ul class="tdd-relationship-list is-counter-list">${relationshipList(relationships.alternative_treatments, item => item.relation, item => item.recommendations, relationships)}</ul>
            </article>
            <article class="tdd-relationship-group is-products">
                <div class="tdd-relationship-heading"><div><span>Medikamentöse Alternativen</span><h3>Alternative Präparate / Wirkstoffe</h3></div><small>Fachlich recherchierte Beziehungen</small></div>
                <ul class="tdd-relationship-list">${relationshipList(relationships.alternative_products, item => item.type, () => null, relationships)}</ul>
            </article>
            <article class="tdd-relationship-group is-related">
                <div class="tdd-relationship-heading"><div><span>Fachliche Nähe</span><h3>Verwandte Behandlungen</h3></div><small>Gehört zu: <strong>${escape(related.classification)}</strong></small></div>
                <ul class="tdd-relationship-list">${relationshipList(related.items, item => item.type || 'Verwandt', () => null, relationships)}</ul>
            </article>
        </div>`;
    }

    function relationshipList(items, labelFor, recommendationsFor = () => null, relationships = {}) {
        const current = { name: relationships.current_name || 'LDN', positive_rating: relationships.current_rating ?? 68, is_current: true };
        return [...items, current]
            .sort((a, b) => (b.positive_rating ?? -1) - (a.positive_rating ?? -1))
            .map(item => item.is_current ? currentRelationshipRow(item) : relationshipCard(item, labelFor(item), recommendationsFor(item)))
            .join('');
    }

    function currentRelationshipRow(item) {
        return `<li class="is-current"><div class="tdd-relationship-card is-current" aria-current="true"><span><strong>${escape(item.name)}</strong><small>Aktuell ausgewählt</small></span>${ratingMarkup(item.positive_rating)}<i>Aktuell</i></div></li>`;
    }

    function relationshipCard(item, label, recommendations = null) {
        const href = `treatment_detail_dummy.php?scenario=complete&dummy_treatment=${encodeURIComponent(item.slug)}`;
        return `<li><a class="tdd-relationship-card" href="${href}"><span><strong>${escape(item.name)}</strong><small>${escape(label)}${recommendations === null ? '' : ` · ${recommendations} Empfehlungen`}</small></span>${ratingMarkup(item.positive_rating)}<i aria-hidden="true">›</i></a></li>`;
    }

    function ratingMarkup(ratingValue) {
        return ratingValue === null || ratingValue === undefined
            ? '<b>—<small>keine Communitybewertung</small></b>'
            : `<b>${ratingValue} %<small>positiv</small></b>`;
    }

    function providersHtml(providers) {
        if (!providers.length) return empty('In diesem Datenstand sind noch keine Anbieter hinterlegt.');
        const mappedProviders = providers.filter(provider => Number.isFinite(provider.lat) && Number.isFinite(provider.lng));
        return `${mappedProviders.length ? `<section id="treatment-detail-provider-map-panel" class="treatment-detail-provider-map-panel" aria-label="Anbieterkarte">
            <div class="treatment-detail-provider-map-header"><span>Standorte auf der Karte</span><span class="treatment-detail-provider-map-count">${providers.length} Dummy-Standorte</span></div>
            <div id="tdd-provider-map" class="treatment-detail-provider-map"></div>
        </section>` : ''}
        <div class="treatment-detail-provider-list">
            <div class="treatment-detail-provider-controls" aria-label="Anbieteransicht und Sortierung">
                <div class="treatment-detail-provider-controls-grid">
                    <section class="treatment-detail-provider-control-card"><h3>Anbieteransicht</h3><div class="treatment-detail-provider-view-switch"><button type="button" class="treatment-detail-provider-view-button is-active" data-tdd-provider-view="cards">Kacheln</button><button type="button" class="treatment-detail-provider-view-button" data-tdd-provider-view="table">Tabelle</button></div></section>
                    <section class="treatment-detail-provider-control-card"><h3>Sortierung</h3><div class="treatment-detail-provider-sort-switch"><button type="button" class="treatment-detail-provider-sort-button is-active">Alphabetisch</button><button type="button" class="treatment-detail-provider-sort-button" disabled>Bewertung positiv</button><button type="button" class="treatment-detail-provider-sort-button" disabled>Entfernung</button></div></section>
                    ${mappedProviders.length ? '<section class="treatment-detail-provider-control-card treatment-detail-provider-control-card-location"><h3>Standort / Entfernung</h3><p>Für Anbieter mit recherchierten Koordinaten.</p></section>' : '<section class="treatment-detail-provider-control-card treatment-detail-provider-control-card-location"><h3>Standortdaten</h3><p>In diesem Modul nicht vollständig recherchiert; deshalb keine Entfernungen.</p></section>'}
                </div>
            </div>
            <div class="treatment-detail-provider-list-inner treatment-detail-provider-view-cards" data-tdd-provider-cards>
                <section class="treatment-detail-provider-group"><div class="treatment-detail-provider-group-header"><h3>Recherchierte Anbieter</h3><span>${providers.length}</span></div><p class="treatment-detail-provider-group-note">Anbieterbeziehungen aus Modul 04; fehlende Standort-, Kontakt- und Bewertungsdaten werden nicht ergänzt.</p><div class="treatment-detail-provider-card-grid">${providers.map((p, i) => providerCard(p, i)).join('')}</div></section>
            </div>
            <div class="treatment-detail-provider-list-inner treatment-detail-provider-view-list" data-tdd-provider-table hidden>
                <section class="treatment-detail-provider-group"><div class="treatment-detail-provider-group-header"><h3>Alle Anbieter</h3><span>${providers.length}</span></div>${providerTable(providers)}</section>
            </div>
        </div>`;
    }

    function providerCard(p, index) {
        const total = [p.pro, p.neutral, p.contra].every(Number.isFinite) ? p.pro + p.neutral + p.contra : 0;
        const percent = value => Math.round(value / total * 100);
        const ratingBlock = total ? `<div class="treatment-detail-provider-rating"><div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-positive"><strong>${percent(p.pro)}%</strong><span>positiv</span></div><div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-neutral"><strong>${percent(p.neutral)}%</strong><span>neutral</span></div><div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-negative"><strong>${percent(p.contra)}%</strong><span>negativ</span></div><div class="treatment-detail-provider-rating-total">n = ${total}</div></div>` : '<p class="tdd-muted">Keine Communitybewertung im Recherchemodul</p>';
        return `<article class="treatment-detail-provider-card"><div class="treatment-detail-provider-card-topline"><span class="treatment-detail-provider-rank-badge">#${index + 1}</span><span>${escape(p.kind || 'Anbieter')}</span></div><div class="treatment-detail-provider-card-header"><div><h3><span class="treatment-detail-provider-name-link">${escape(p.name)}</span></h3><p>${p.location ? escape([p.postal_code, p.location].filter(Boolean).join(' ')) : 'Standort nicht im Modul recherchiert'}</p></div></div>${ratingBlock}<div class="treatment-detail-provider-card-body"><p>${escape(p.detail || '')}</p><div class="treatment-detail-provider-meta">${(p.care || []).map(c => `<span class="treatment-detail-care-badge treatment-detail-care-badge-positive">${escape(c)}</span>`).join('')}</div><div class="treatment-detail-provider-contact">${(p.contact || []).map(c => `<span>${escape(c)}</span>`).join('')}</div></div></article>`;
    }

    function providerTable(providers) {
        const rows = providers.map((p, i) => { const total=[p.pro,p.neutral,p.contra].every(Number.isFinite)?p.pro+p.neutral+p.contra:0; const hasMap=Number.isFinite(p.lat)&&Number.isFinite(p.lng); return `<tr><td class="treatment-detail-provider-rank-cell" data-label="Rang"><span class="treatment-detail-provider-rank-badge">#${i+1}</span></td><td data-label="Anbieter"><strong>${escape(p.name)}</strong><small>${escape(p.kind || '')}</small></td><td data-label="Standort">${p.location ? escape([p.postal_code,p.location].filter(Boolean).join(' ')) : '—'}</td><td data-label="Karte"><span class="treatment-detail-map-status">${hasMap?'Ja':'Nein'}</span></td><td data-label="Entfernung">—</td><td data-label="Bewertung">${total?`n=${total}`:'—'}</td><td data-label="Versorgung"><div class="treatment-detail-provider-meta">${(p.care||[]).map(c=>`<span class="treatment-detail-care-badge treatment-detail-care-badge-positive">${escape(c)}</span>`).join('')}</div></td><td data-label="Kontakt"><div class="treatment-detail-provider-contact">${(p.contact||[]).map(c=>`<span>${escape(c)}</span>`).join('')}</div></td></tr>`; }).join('');
        const compactRows = providers.map((p, i) => `<tr><td>${i+1}</td><td><strong class="treatment-detail-provider-name-link">${escape(p.name)}</strong></td><td>—</td><td><small>${p.location ? escape([p.postal_code,p.location].filter(Boolean).join(' ')) : 'nicht recherchiert'}</small></td></tr>`).join('');
        return `<div class="treatment-detail-provider-table-wrap"><table class="treatment-detail-provider-table treatment-detail-provider-table-detailed"><thead><tr><th>Rang</th><th>Anbieter</th><th>Standort</th><th>Karte</th><th>Entfernung</th><th>Bewertung</th><th>Versorgung</th><th>Kontakt</th></tr></thead><tbody>${rows}</tbody></table><table class="treatment-detail-provider-compact-table"><thead><tr><th>#</th><th>Anbieter</th><th>Positiv</th><th>Standort</th></tr></thead><tbody>${compactRows}</tbody></table></div>`;
    }

    function initializeProviderArea(providers) {
        document.querySelectorAll('[data-tdd-provider-view]').forEach(button => button.addEventListener('click', () => {
            const table = button.dataset.tddProviderView === 'table';
            document.querySelector('[data-tdd-provider-cards]').hidden = table;
            document.querySelector('[data-tdd-provider-table]').hidden = !table;
            document.querySelectorAll('[data-tdd-provider-view]').forEach(item => item.classList.toggle('is-active', item === button));
        }));
        const mapElement = document.getElementById('tdd-provider-map');
        const mappedProviders = providers.filter(provider => Number.isFinite(provider.lat) && Number.isFinite(provider.lng));
        if (!mapElement || !window.L || !mappedProviders.length) return;
        const map = window.L.map(mapElement, { scrollWheelZoom: false });
        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles © Esri' }).addTo(map);
        const bounds = [];
        mappedProviders.forEach(p => { const point=[p.lat,p.lng]; bounds.push(point); window.L.marker(point).addTo(map).bindPopup(`<strong>${escape(p.name)}</strong><br>${escape(p.postal_code)} ${escape(p.location)}`); });
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    }

    function factCard(label, raw, tone = 'plain', note = '') {
        return `<article class="tdd-card tdd-fact is-${tone}"><h3>${escape(label)}</h3>${raw ? `<strong>${escape(raw)}</strong>${note ? `<p>${escape(note)}</p>` : ''}` : empty('Noch keine Angabe')}</article>`;
    }

    function scaleCard(title, options, current, hint = '') {
        const selectedIndex = options.indexOf(current);
        const progress = options.length > 1 && selectedIndex >= 0 ? (selectedIndex / (options.length - 1)) * 100 : 0;
        return `<article class="tdd-card tdd-scale-card">
            <div class="tdd-scale-heading"><h3>${escape(title)}</h3>${hint ? `<span>${escape(hint)}</span>` : ''}</div>
            ${current ? `<strong class="tdd-scale-current">${escape(current)}</strong>` : empty('Noch keine Angabe')}
            <div class="tdd-scale" style="--tdd-progress:${progress}%;--tdd-count:${options.length}">
                <div class="tdd-scale-line"><i></i></div>
                <ol>${options.map((option, index) => `<li class="${option === current ? 'is-current' : ''} ${index < selectedIndex ? 'is-before' : ''}"><b aria-hidden="true"></b><span>${escape(option)}</span></li>`).join('')}</ol>
            </div>
        </article>`;
    }

    function normalizeSetting(raw) {
        if (!raw) return null;
        if (raw.toLowerCase().includes('zu hause')) return 'Zu Hause';
        if (raw.toLowerCase().includes('hausbesuch')) return 'Hausbesuch';
        if (raw.toLowerCase().includes('ambulant')) return 'Ambulant';
        if (raw.toLowerCase().includes('stationär')) return 'Stationär';
        return raw;
    }

    function groupCard(title, rows) {
        const usable = rows ? rows.filter(([, raw]) => raw) : [];
        return `<article class="tdd-card"><h3>${escape(title)}</h3>${usable.length ? `<dl class="tdd-list">${usable.map(([label, raw]) => `<div><dt>${escape(label)}</dt><dd>${escape(raw)}</dd></div>`).join('')}</dl>` : empty('Noch keine belastbaren Angaben vorhanden.')}</article>`;
    }

    function rating(label, amount, css) { return `<div class="is-${css}"><strong>${amount} %</strong><span>${escape(label)}</span><i><b style="width:${amount}%"></b></i></div>`; }
    function empty(message) { return `<p class="tdd-empty">${escape(message)}</p>`; }
    function value(raw) { return raw ? escape(raw) : '<span class="tdd-muted">Noch keine Angabe</span>'; }
    function escape(raw) { const e = document.createElement('div'); e.textContent = raw == null ? '' : String(raw); return e.innerHTML; }
}());
