(() => {
  'use strict';
  const content = document.getElementById('view-content');
  if (!content) return;
  const doctor = document.body.dataset.doctorPage === 'live';
  if (!doctor) {
    const welcome = content.querySelector('[data-therapy-welcome]');
    if (welcome) mountTherapyGuide(welcome);
    return;
  }
  const preference = 'lcn_experience_guide_disabled';
  const params = new URLSearchParams(location.search);
  const profile = params.has('submission_id') ? 'submission:' + params.get('submission_id') : 'practice:' + params.get('id');
  const progressKey = 'lcn_experience_guide_progress:' + profile;
  const rating = '[data-choice="effect"]';
  const steps = [
    ['termin', '[data-choice="adaptation"]', 'Belastung rund um den Termin', 'Wie hast du das Warten und den Termin erlebt? Deine Einschätzung hilft anderen, ihren Besuch zu planen.', /^adaptation$/],
    ['termin', '.appointment-variant[data-variant="3"]', 'Terminform', 'Welche Terminformen waren für deinen Erst- oder Folgetermin möglich? Ergänze gern mehrere Angaben.', /^appointment-/, 'appointments'],
    ['zugang', '[data-choice^="costs-"]', 'Kosten', 'Wie viel hast du selbst bezahlt? Eine ungefähre Angabe hilft anderen bei der Planung.', /^costs-/],
    ['wirkung', '[data-doctor-symptom-help]', 'Symptome', 'Bei welchen Symptomen hat dir die Behandlung geholfen? Du kannst mehrere auswählen.', /^symptom-help-/, 'manual'],
    ['ueberblick', '#treatment-section', 'Therapien der Praxis', 'Stimmen die zugeordneten Therapien mit deiner Erfahrung überein? Du kannst Einträge ergänzen oder eine Korrektur melden.']
  ];

  let step = -1;
  let saved = false;
  let prompted = false;
  let offered = false;
  let dismissed = false;
  let disabled = false;
  try { disabled = localStorage.getItem(preference) === '1'; } catch {}

  function restoreProgress() {
    try {
      const progress = JSON.parse(sessionStorage.getItem(progressKey));
      if (!progress || disabled) return;
      step = Number.isInteger(progress.step) && steps[progress.step] ? progress.step : -1;
      saved = step >= 0 && progress.saved === true;
      prompted = step >= 0 && progress.prompted === true;
      offered = progress.offered === true;
      dismissed = step < 0 && progress.dismissed === true;
    } catch {}
  }

  function saveProgress() {
    try {
      sessionStorage.setItem(progressKey, JSON.stringify({step, saved, prompted, offered, dismissed}));
    } catch {}
  }

  restoreProgress();

  function make(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(label, action, primary = false) {
    const control = make('button', label, primary ? 'experience-guide-primary' : '');
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }

  function scrollTo(target) {
    const heading = target?.querySelector('h2,h3') || target;
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({preventScroll: true});
    const headerOffset = parseFloat(getComputedStyle(content).scrollMarginTop) || 0;
    window.scrollBy({top: target.getBoundingClientRect().top - headerOffset, behavior: 'instant'});
  }

  function cardFor(selector) {
    return selector && content.querySelector(selector)?.closest('.card');
  }

  function illustrated(panel, eyebrow, title, ...body) {
    panel.classList.add('experience-guide');
    const copy = make('div', '', 'experience-guide-copy');
    const image = make('img', '', 'experience-guide-art');
    image.src = 'assets/images/homepage/banner-detail-' + (doctor ? 'provider-vote' : 'therapy-vote-cards') + '.webp';
    image.alt = '';
    image.width = 800;
    image.height = 720;
    copy.append(make('small', eyebrow, 'experience-guide-eyebrow'), title, ...body);
    panel.append(copy, image);
  }

  function mountTherapyGuide(welcome) {
    const views = [...document.querySelectorAll('.side-nav [data-view]')]
      .filter(link => link.dataset.view !== 'dashboard');
    const storageKey = 'lcn_therapy_guide:' + content.closest('[data-treatment-id]').dataset.treatmentId;
    const topics = {
      effect: [
        {"intro": "Unter Community-Bewertung fassen wir zusammen, wie sich der Gesamtzustand der Betroffenen bei Anwendung der ausgewählten Therapie verändert hat. Du kannst zwischen vier Antworten wählen:", "options": ["Verschlechterung: Die Behandlung hatte einen negativen Effekt auf deine Gesundheit.", "Neutral: Dein Gesamtzustand ist gleich geblieben.", "Verbesserung: Du hast einen positiven Effekt auf deinen Gesamtzustand gespürt.", "Heilung: Die Therapie hat bei dir zu einer Genesung geführt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Therapie besser einzuschätzen."},
        'Die Abbildung zeigt, wie andere die Wirkung erlebt haben. Beachte auch, wie viele Angaben vorliegen.'
      ],
      gamechanger: [
        {"intro": "Als Gamechanger bezeichnen wir eine Therapie, die deinen Genesungsprozess entscheidend vorangetrieben hat. Du kannst zwischen zwei Antworten wählen:", "options": ["Ja: Die ausgewählte Therapie hat deinen Genesungsprozess entscheidend vorangetrieben.", "Nein: Die ausgewählte Therapie hat deinen Genesungsprozess leider nicht entscheidend vorangetrieben."], "closing": "Klicke in der Abbildung auf die passende Antwort. Damit hilfst du anderen, die Bedeutung der Therapie für den Genesungsprozess einzuschätzen."},
        'Hier siehst du, bei wie vielen Teilnehmenden die Therapie den Genesungsprozess entscheidend vorangetrieben hat.'
      ],
      symptoms: [
        {"intro": "Hier sammeln wir, welche Symptome bei Betroffenen durch die ausgewählte Therapie gelindert wurden. Du hast folgende Möglichkeiten:", "options": ["Symptome auswählen: Klicke auf die passenden Symptome in der Auflistung unten, um deine Erfahrung zu ergänzen.", "Weitere Symptome ergänzen: Ergänze Symptome, die durch die Therapie gelindert wurden und noch nicht aufgelistet sind."], "closing": "Damit hilfst du anderen mit ähnlichen Symptomen, die Therapie besser einzuschätzen."},
        'Die Liste zeigt, bei welchen Symptomen die ausgewählte Therapie laut Community helfen kann. Eine Person kann mehrere Symptome angeben.'
      ],
      setting: [
        {"intro": "Das Durchführungssetting beschreibt, wo und in welchem Rahmen du die ausgewählte Therapie angewendet hast. Damit erfassen wir, wie komplex oder aufwendig die Durchführung der Behandlung für Betroffene ist. Zur Auswahl stehen:", "options": ["Selbstständig zu Hause: Du wendest die Therapie eigenständig zu Hause an, ohne zusätzlichen Reiseaufwand oder die Hilfe einer Behandlerin oder eines Behandlers.", "Hausbesuch: Du benötigst Unterstützung durch Fachpersonal, kannst die Behandlung aber zu Hause durchführen.", "Ambulant: Du hast einzelne Termine vor Ort, zum Beispiel in einer Praxis.", "Stationär: Du hältst dich zur Behandlung für einen längeren Zeitraum in einer Einrichtung auf."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Durchführung der Therapie zu planen."},
        'Hier siehst du, wo andere die Therapie gemacht haben, zum Beispiel zu Hause oder in einer Praxis.'
      ],
      pem: [
        {"intro": "Hier geht es um deine Einschätzung aus eigener Erfahrung: Wie hoch hältst du das Risiko, dass die ausgewählte Behandlung bei anderen Betroffenen zu einer Zustandsverschlechterung führt? Zur Auswahl stehen:", "options": ["Keines: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung nicht vorhanden ist.", "Niedrig: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung gering ist.", "Mittel: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung mittel ist.", "Hoch: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung hoch ist."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die mögliche Belastung durch die Therapie besser einzuordnen."},
        'Hier siehst du, wie andere das Risiko einer Verschlechterung nach Belastung einschätzen.'
      ],
      access: [
        {"intro": "Hier erfassen wir die Zugänglichkeit der ausgewählten Therapie: Wie hoch ist der Aufwand für Betroffene, Zugang zu dieser Therapie zu erhalten? Vier Zugangswege im Vergleich:", "options": ["Selbstmanagement / eigenständig umsetzbar: Du kannst die Maßnahme selbst umsetzen. Du benötigst weder eine Behandlerin oder einen Behandler noch eine ärztliche Verordnung. Der Zugang ist mit geringem Aufwand verbunden.", "Frei erhältlich / private Behandler:innen: Du kaufst das Mittel selbst oder vereinbarst die Behandlung direkt mit privaten Behandler:innen. Eine ärztliche Verordnung ist nicht nötig. Der Zugang ist mit mittlerem Aufwand verbunden.", "Ärztliche Verordnung oder Rezept erforderlich: Du benötigst eine ärztliche Verordnung oder ein Rezept, um die Therapie zu erhalten. Der Zugang ist mit hohem Aufwand verbunden.", "Nur im Rahmen einer Studie möglich: Du kannst die Behandlung nur erhalten, wenn du zur Teilnahme an einer entsprechenden Studie zugelassen wirst. Der Zugang ist mit sehr hohem Aufwand verbunden."], "closing": "Klicke in der Abbildung auf den Zugangsweg, der deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, einen passenden Weg zur Therapie zu finden."},
        'Hier siehst du, wie andere Zugang zur Therapie bekommen haben, etwa mit einer Verordnung oder ohne Rezept.'
      ],
      unit_cost: [
        {"intro": "Hier erfassen wir, was du pro Therapieeinheit selbst bezahlt hast – zum Beispiel pro Anwendung, Behandlung, Packung oder Ampulle. Ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Falls sich die Kosten nicht pro Einheit angeben lassen, wähle „Nicht anwendbar“ und trage stattdessen die Gesamtkosten ein.", "options": ["Nicht anwendbar: Eine Kostenangabe pro Einheit passt nicht zu dieser Therapie.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Betrag pro Einheit. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die eigenen Kosten besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Hier siehst du die Kosten pro Behandlung oder Einheit. Wähle das Versicherungssystem, das zu dir passt.'
      ],
      total_cost: [
        {"intro": "Hier erfassen wir, was du bisher insgesamt selbst für die Therapie bezahlt hast. Zähle alle bisherigen Anwendungen und Ausgaben zusammen und ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Ist die Therapie noch nicht abgeschlossen, schätze die Gesamtkosten. Bei einer fortlaufenden Therapie kannst du „Nicht anwendbar“ wählen und stattdessen die Kosten pro Einheit angeben.", "options": ["Nicht anwendbar: Eine Angabe zu Gesamtkosten lässt sich auf diese Therapie nicht anwenden.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Gesamtbetrag. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Kosten eines Therapieverlaufs besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Hier siehst du, was andere für den gesamten Therapieverlauf bezahlt haben.'
      ]
    };
    const encouragement = {
      symptome: ['Bei welchen Symptomen hat dir die Therapie geholfen? Wähle die passenden Symptome aus oder suche weitere. Du entscheidest, was du beitragen möchtest.', 'Bei welchen Symptomen hilft die Therapie? Hier siehst du, bei welchen Beschwerden die Community Verbesserungen berichtet.'],
      wirkung: ['Was du erlebt hast, kann anderen helfen, ihre Fragen an die Therapie zu finden. Jede Angabe zählt.',
        'Ob eine Therapie zu dir passt, ist eine persönliche Frage. Die Erfahrungen anderer können dir helfen, genauer hinzuschauen.'],
      termin: ['Deine Erfahrung mit Durchführung und Belastung hilft anderen, ihren Alltag rund um die Therapie zu planen.',
        'Schau dir an, wie die Therapie abläuft und welche Belastung andere erlebt haben. So kannst du besser einschätzen, was du dafür einplanen möchtest.'],
      zugang: ['Dein Weg zur Therapie und deine ungefähren Kosten geben anderen eine Vorstellung davon, womit sie rechnen können.',
        'Wenn du weißt, wie der Zugang funktioniert und welche Kosten möglich sind, kannst du deinen nächsten Schritt besser planen.'],
      anreise: ['Du hast schon etwas beigetragen? Danke dafür. Hier kannst du bei Bedarf noch nach Behandler:innen schauen.',
        'Wenn du die Therapie weiter erkunden möchtest, kannst du hier nach Behandler:innen in deiner Nähe schauen.'],
      alternativen: ['Danke, dass du dir Zeit für die Community genommen hast. Hier kannst du zum Abschluss noch verwandte Behandlungen ansehen.',
        'Vielleicht findest du hier eine weitere Behandlung, über die du dich informieren möchtest. Schau dir mögliche Alternativen und verwandte Therapien an.']
    };
    let mode = '';
    let minimized = false;
    let providerContributed = false;
    let relationshipContributions = {};
    let finishedSections = {};
    let panel;
    let guide;
    let entries = [];
    let completion;
    let sharing;

    function restore() {
      try {
        const state = JSON.parse(sessionStorage.getItem(storageKey));
        mode = ['review', 'explore', 'symptoms', 'providers', 'alternatives'].includes(state?.mode) ? state.mode : '';
        minimized = state?.minimized === true;
        providerContributed = state?.providerContributed === true;
        relationshipContributions = state?.relationshipContributions || {};
        finishedSections = state?.finishedSections || {};
      } catch {}
    }

    function save() {
      try { sessionStorage.setItem(storageKey, JSON.stringify({mode, minimized, providerContributed, relationshipContributions, finishedSections})); } catch {}
    }

    function refreshInsuranceHelp(scope = content) {
      const country = window.LCNCost?.get().country || 'DE';
      const countryName = {DE:'Deutschland',AT:'Österreich',CH:'die Schweiz'}[country] || 'Deutschland';
      const abroad = 'Aus dem Ausland: Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört.';
      const options = {
        DE:['GKV: Du bist gesetzlich krankenversichert.','PKV: Du bist privat krankenversichert.',abroad],
        AT:['Kassenarzt: Die Behandlung erfolgt bei einer Ärztin oder einem Arzt mit Kassenvertrag.','Wahlarzt: Die Behandlung erfolgt bei einer Ärztin oder einem Arzt ohne Kassenvertrag.',abroad],
        CH:['Grundversicherung: Die Behandlung wird über die obligatorische Krankenpflegeversicherung eingeordnet.','Zusatzversicherung: Die Behandlung wird über eine freiwillige Zusatzversicherung eingeordnet.',abroad]
      };
      scope.querySelectorAll('[data-guide-insurance-intro]').forEach(node => node.textContent = 'Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für ' + countryName + ' stehen zur Auswahl:');
      scope.querySelectorAll('[data-guide-insurance-list]').forEach(list => {
        list.replaceChildren(...(options[country] || options.DE).map(option => {
          const at=option.indexOf(': '),item=make('li');
          item.append(make('strong',option.slice(0,at)+':'),make('span',option.slice(at+2)));return item;
        }));
      });
    }
    document.addEventListener('lcn-cost-preferences-changed', () => refreshInsuranceHelp());

    function openView(link) {
      if (link.getAttribute('aria-current') !== 'page') link.click();
      scrollTo(guide);
    }

    function therapyDialog(title, message, label, proceed) {
      const dialog = make('dialog');
      dialog.setAttribute('aria-label', title);
      const actions = make('div', '', 'experience-guide-actions');
      actions.append(button(label, () => {
        dialog.close();
        proceed();
      }, true), button('Hier bleiben', () => dialog.close()));
      illustrated(dialog, 'Therapie-Begleitung', make('h2', title), make('p', message), actions);
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove(), {once: true});
      dialog.showModal();
    }

    function shareTherapy(alternatives = false, providers = false) {
      const block = make('div', '', 'therapy-guide-sharing');
      const message = make('p');
      const url = new URL(location.pathname, location.origin);
      if (window.LCNDummy?.available || ['lcn.localhost.test', 'localhost.test'].includes(url.hostname)) {
        url.href = 'https://long-covid-navigator.de/therapie_detail.php';
      }
      url.searchParams.set('treatment_id', content.closest('[data-treatment-id]').dataset.treatmentId);
      url.searchParams.set('anliegen', 'erfahrung');
      if (alternatives) url.hash = 'alternativen';
      if (providers) url.hash = 'anreise';
      const text = providers
        ? 'Kennst du Behandler:innen für diese Therapie aus eigener Erfahrung? Schau dir die Einträge im Long Covid Navigator an, bestätige oder korrigiere Angaben und ergänze fehlende Behandler:innen. Teile deine Behandlungserfahrung im jeweiligen Praxiseintrag.'
        : alternatives
        ? 'Hast du diese Therapie oder eine Alternative dazu ausprobiert? Schau dir die Alternativen, Einordnungen und Kombinationen im Long Covid Navigator an. Bestätige passende Einträge, widersprich unpassenden Zuordnungen oder ergänze, was du kennst.'
        : 'Kennst du diese Therapie aus eigener Erfahrung? Teile sie im Long Covid Navigator.';
      const actions = make('div', '', 'experience-guide-actions');
      const status = make('p');
      status.setAttribute('role', 'status');
      const fallback = make('input');
      fallback.type = 'url';
      fallback.readOnly = true;
      fallback.hidden = true;
      fallback.value = url.href;
      fallback.setAttribute('aria-label', 'Link zur Therapie');
      const email = make('a', 'Per E-Mail');
      email.href = 'mailto:?subject=' + encodeURIComponent(providers ? 'Behandler:innen und Erfahrungen ergänzen' : alternatives ? 'Wissen zu Therapiealternativen ergänzen' : 'Erfahrungen mit dieser Therapie') +
        '&body=' + encodeURIComponent(text + '\n\n' + url.href);
      const whatsapp = make('a', 'Per WhatsApp');
      whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url.href);
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener noreferrer';
      const copy = button('Link kopieren', async () => {
        try {
          await navigator.clipboard.writeText(url.href);
          status.textContent = 'Link kopiert.';
        } catch {
          fallback.hidden = false;
          fallback.select();
          status.textContent = 'Du kannst den markierten Link kopieren.';
        }
      });
      if (navigator.share) actions.append(button('Teilen', async () => {
        try { await navigator.share({title: document.title, text, url: url.href}); }
        catch (error) { if (error.name !== 'AbortError') copy.focus(); }
      }));
      actions.append(copy, email, whatsapp);
      block.append(message, actions, fallback, status);
      return {block, message, alternatives, providers};
    }

    function refreshTopics() {
      refreshEntryAvailability();
      entries.forEach(({card, example}) => {
        if (!example) return;
        const demo = window.LCNDummy?.get();
        const count = Number(card.dataset.displayAnswerCount);
        const symptoms = JSON.parse(card.dataset.guideSymptoms || '[]');
        const prefix = demo ? 'Mit Beispieldaten: ' : '';
        example.textContent = symptoms.length
          ? prefix + 'Die meisten Stimmen in der Liste entfallen auf ' + symptoms
            .map(({name, count}) => name + ' (' + count + (count === 1 ? ' Stimme)' : ' Stimmen)')).join(' und ') + '.'
          : count ? prefix + 'Aktuell siehst du ' + count + (count === 1 ? ' Angabe.' : ' Angaben.') : '';
        example.hidden = !example.textContent;
      });
      updateProgress();
      if (sharing) {
        const count = experienceCount(panel);
        sharing.block.hidden = !sharing.alternatives && !sharing.providers && count >= 10;
        if(sharing.toggle) sharing.toggle.hidden = !sharing.alternatives && !sharing.providers && count >= 10;
        sharing.message.textContent = sharing.providers
          ? 'Kennst du jemanden, der diese Therapie schon bei einer Behandler:in gemacht hat? Leite diese Seite weiter und lade die Person ein, Angaben zu bestätigen oder zu korrigieren, fehlende Behandler:innen zu ergänzen und ihre Erfahrung im jeweiligen Praxiseintrag zu teilen.'
          : sharing.alternatives
          ? 'Kennst du jemanden, der diese Therapie oder eine der Alternativen schon ausprobiert hat? Leite diese Seite weiter und lade die Person ein, Einträge zu bestätigen, ihnen zu widersprechen oder fehlendes Wissen zu ergänzen.'
          : count === 0
          ? 'Kennst du jemanden, der diese Therapie ausprobiert hat? Lade die Person ein, ihre Erfahrung zu teilen. Das hilft dir und anderen bei der Orientierung.'
          : 'Kennst du jemanden, der diese Therapie ausprobiert hat? Jede weitere Erfahrung hilft, die Therapie besser einzuschätzen.';
      }
      content.querySelectorAll('.therapy-guide-data-status').forEach(node => {
        const count = experienceCount(node.closest('.nd-panel'));
        node.dataset.level = count >= 10 ? 'full' : count ? 'few' : 'none';
        node.textContent = count >= 10 ? 'Gesamtauswertung verfügbar · Bitte beachte die Anzahl der Angaben je Thema.'
          : count ? 'Einzelne Erfahrungen · Noch keine Gesamtauswertung.' : 'Noch keine Erfahrungen';
      });
      entries.forEach(({card, disclosure}) => {
        if (disclosure) disclosure.hidden = mode !== 'review' && !card.dataset.guideContribution && cardCount(card) === 0;
      });
    }

    function answered(card) {
      if(card.dataset.guideContribution === 'provider') return providerContributed;
      if(card.dataset.guideContribution) return relationshipContributions[card.dataset.guideContribution] === true;
      return !!card.querySelector('[data-option][aria-pressed="true"], [data-symptom-id][aria-pressed="true"]');
    }

    function updateProgress() {
      entries.forEach(({card, disclosure}) => {
        const done = answered(card);
        disclosure?.classList.toggle('is-complete', mode === 'review' && done);
        const summary = disclosure?.querySelector('summary');
        if (summary) summary.setAttribute('aria-label', summary.textContent + (mode === 'review' ? (done ? ' – Angabe gespeichert' : ' – noch offen') : ''));
      });
      views.forEach(link => {
        const cards = [...document.getElementById(link.dataset.view).querySelectorAll('[data-question], .ux-symptom-help')];
        const done = finishedSections[link.dataset.view] === true || (link.dataset.view === 'anreise' && providerContributed) || (link.dataset.view === 'alternativen' && Object.values(relationshipContributions).some(Boolean)) || (cards.length > 0 && cards.every(answered));
        link.classList.toggle('therapy-section-complete', done);
        const number = link.querySelector('.nav-number');
        number?.setAttribute('aria-label', finishedSections[link.dataset.view] ? 'Für dich abgeschlossen' : done ? 'Beitrag gespeichert' : '');
      });
      if (completion) {
        const count = entries.filter(({card}) => answered(card)).length;
        completion.textContent = count === entries.length
          ? 'Danke! Deine Angaben sind gespeichert.' : count + ' von ' + entries.length + ' Themen ausgefüllt';
        completion.classList.toggle('is-complete', count === entries.length);
      }
    }

    function disableOrientation(dialog) {
      dialog?.close();
      minimized = true;
      save();
      paint(true);
    }

    function refreshEntryAvailability(scope = document) {
      const loaded = !!content.querySelector('[data-question][data-real-answer-count]');
      const count = experienceCount();
      scope.querySelectorAll('[data-therapy-experience-availability]').forEach(node => {
        node.hidden = !loaded;
        node.textContent = !loaded ? '' : count === 0 ? 'Keine Angaben vorhanden' : count < 10 ? 'Bisher wenige Angaben' : 'Zahlreiche Angaben vorhanden';
        node.dataset.level = count === 0 ? 'none' : count < 10 ? 'few' : 'many';
      });
    }

    function cardCount(card) {
      if (window.LCNDummy?.get()) {
        return Math.max(Number(card.dataset.displayAnswerCount) || 0,
          ...JSON.parse(card.dataset.guideSymptoms || '[]').map(item => Number(item.count) || 0));
      }
      return Number(card.dataset.realAnswerCount) || 0;
    }

    function experienceCount(scope = content) {
      return Math.max(0, ...[...scope.querySelectorAll('[data-question], .ux-symptom-help')].map(cardCount));
    }

    function hasInformation(link) {
      const section = document.getElementById(link.dataset.view);
      if (link.dataset.view === 'alternativen') return !!section.querySelector('.ux-feedback-relation');
      if (link.dataset.view === 'anreise') return true;
      return experienceCount(section) > 0;
    }

    function nextView() {
      const remaining = views.slice(views.findIndex(link => link.dataset.view === panel.id) + 1);
      return remaining.find(link => link.dataset.view !== 'dashboard');
    }

    function viewName(link) {
      return link.querySelector('strong').textContent.replaceAll('­', '');
    }

    function paint(force = false) {
      const active = content.querySelector('.nd-panel:not([hidden])');
      if (!active || (!force && panel === active)) return;
      guide?.remove();
      content.querySelectorAll('[data-question], .ux-symptom-help').forEach(card => {
        card.hidden = mode === 'explore' && cardCount(card) === 0;
      });
      panel = active;
      entries = [];
      completion = sharing = null;

      updateProgress();
      if (panel.id !== 'ueberblick' && panel.id !== 'dashboard' && minimized) {
        guide = make('section', '', 'therapy-guide-collapsed');
        guide.setAttribute('aria-label', 'Orientierung ausgeschaltet');
        guide.append(button('Orientierung zurückholen', enableOrientation));
        panel.prepend(guide);
        return;
      }
      if (panel.id === 'dashboard' || (panel.id !== 'ueberblick' && !mode)) {
        guide = null;
        return;
      }

      guide = make('section');
      const actions = make('div', '', 'experience-guide-actions');
      const close = button(minimized ? 'Orientierung wieder einschalten' : 'Ich brauche keine Orientierung', () => {
        if (minimized) enableOrientation();
        else disableOrientation();
      });
      close.classList.add('therapy-guide-dismiss');


      if (panel.id === 'ueberblick') {
        actions.classList.add('therapy-guide-choices');
        addChoices(actions);
        guide.classList.add('experience-guide-banner', 'therapy-guide-personal');
        close.textContent = minimized ? 'Orientierung wieder einschalten' : 'Ohne Begleitung weiter';
        const compass = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        compass.setAttribute('viewBox', '0 0 24 24');
        compass.setAttribute('aria-hidden', 'true');
        compass.innerHTML = '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" fill="none" stroke="currentColor" stroke-width="1.5"/>';
        close.prepend(compass);
        const footer = make('div', '', 'therapy-guide-personal-footer');
        footer.append(close, make('p', 'Du kannst die Orientierung jederzeit wieder öffnen.', 'therapy-guide-return-hint'));
        illustrated(guide, '', make('h2', 'Was führt dich hierher?'),
          make('p', 'Scrolle zu deinem Anliegen und öffne es. Von dort begleiten wir dich durch die passenden Bereiche.', 'therapy-guide-intro'),
          actions, footer);
        guide.querySelector('.experience-guide-eyebrow')?.remove();
        welcome.append(guide);
        return;
      }

      guide.classList.add('therapy-guide-note');
      const heading = make('h2', panel.getAttribute('aria-label'));
      const review = mode === 'review';
      if (!review) guide.classList.add('therapy-guide-reading');
      const body = [make('p', review ? (panel.querySelector('[data-question], .ux-symptom-help') ? 'Klicke in den Abbildungen oder Listen auf das, was deiner bisherigen Erfahrung entspricht. Jede Angabe hilft anderen.' : encouragement[panel.id][0]) : encouragement[panel.id][1])];
      if (review && panel.id === 'symptome') body[0].textContent = 'Klicke auf die Symptome, die sich bei dir durch diese Therapie verbessert haben, oder ergänze entsprechende Symptome.';
      if (!review && panel.querySelector('[data-question], .ux-symptom-help')) body.push(make('p', '', 'therapy-guide-data-status')); 
      const cards = panel.querySelectorAll('[data-question], .ux-symptom-help');
      if (cards.length) {

        if (!review) {
          sharing = shareTherapy();
          sharing.toggle = make('details', '', 'therapy-guide-invitation');
          sharing.toggle.append(make('summary', 'Jemanden zur Erfahrung einladen'), sharing.block);
        }
      } else if (panel.id === 'anreise' && !review) {
        body[0].textContent = 'Du suchst Behandler:innen für diese Therapie? Hier findest du eingetragene Praxen auf einer Karte und in einer Ergebnisliste. Öffne die Hinweise, um die Suche einzugrenzen, den Anreiseaufwand einzuordnen und die Angaben zu einer Praxis näher anzusehen.';
        const help = [
          ['Standort, Karte und Filter', 'Gib eine Adresse, Postleitzahl oder einen Ort ein und übernimm den Standort. Im Modus „Radius“ kannst du den Suchradius aktivieren und in Kilometern einstellen; im Modus „Ort“ wählst du eine Stadt aus. Einträge ohne Koordinaten können in der Liste berücksichtigt werden, auch wenn sie nicht auf der Karte erscheinen. Die Trefferzahl zeigt, wie viele Behandler:innen zu den aktuellen Filtern passen.'],
          ['Anreiseaufwand verstehen', 'Die hervorgehobene Stufe ordnet die nächstgelegene behandelnde Person im aktuellen Filter nach Entfernung ein. Die Kilometerangabe ist die Luftlinie; die Zeitangaben sind grobe Orientierung und keine berechnete Reiseroute. „Online-Behandlung“ bedeutet hier, dass Erst- und Folgetermin online möglich sind. Unter „Wie wird eingeordnet?“ findest du weitere Erläuterungen.'],
          ['Praxiseinträge und Erfahrungen lesen', 'Wechsle zwischen Kacheln und Tabelle, suche nach Name oder Ort und sortiere nach Name oder Entfernung. Ein Online-Hinweis steht direkt unter dem Namen und wird nur angezeigt, wenn Erst- und Folgetermin online möglich sind. Öffne einen Praxiseintrag, um die dort vorhandenen Angaben und Erfahrungen zu lesen. Achte bei Bewertungen auch auf die Anzahl der Angaben.'],
          ['Angaben bestätigen, korrigieren oder ergänzen', 'Kennst du eine der Praxen aus eigener Erfahrung? Öffne ihren Eintrag und bestätige passende Angaben oder widersprich mit den dort angebotenen Rückmeldungen. Ergänze deine Erfahrung dort, wo du etwas beitragen kannst. Fehlt eine Praxis, nutze „Behandler:innen hinzufügen“.']
        ];
        help.forEach(([title, text]) => {
          const disclosure = make('details');
          disclosure.append(make('summary', title), make('p', text));
          body.push(disclosure);
        });
        sharing = shareTherapy(false, true);
        body.push(sharing.block);
      }
      cards.forEach(card => {
        const topic = topics[card.dataset.question || 'symptoms'];
        if (!topic) return;
        const title = card.querySelector('h3').firstChild.textContent.trim();
        const disclosure = make('details');
        disclosure.append(make('summary', title));
        if (review) {
          const list = make('ul', '', 'therapy-guide-options');
          if (card.dataset.question === 'access') list.classList.add('therapy-guide-access-options');
          topic[0].options.forEach(option => {
            const item = make('li');
            const separator = option.indexOf(': ');
            const label = separator >= 0 ? option.slice(0, separator)
              : option.startsWith('Wähle ') ? 'Symptome auswählen' : 'Weitere Symptome suchen';
            const explanation = separator >= 0 ? option.slice(separator + 1).trim() : option;
            const description = make('span', explanation);
            if (card.dataset.question === 'gamechanger' && label === 'Nein') {
              const parts = explanation.split(' nicht ');
              description.replaceChildren(document.createTextNode(parts[0] + ' '), make('u', 'nicht'), document.createTextNode(' ' + parts[1]));
            }
            if (card.dataset.question === 'pem') {
              const emphasis = {Keines: 'nicht vorhanden', Niedrig: 'gering', Mittel: 'mittel', Hoch: 'hoch'}[label];
              if (emphasis) {
                const parts = explanation.split(' ' + emphasis + ' ');
                description.replaceChildren(document.createTextNode(parts[0] + ' '), make('u', emphasis), document.createTextNode(' ' + parts[1]));
              }
            }
            const heading = make('strong', label + ':');
            if (card.dataset.question === 'access') {
              heading.textContent = label;
              const number = make('span', String(list.children.length + 1), 'therapy-guide-access-number');
              item.append(number);
              const level = ['Geringer Aufwand', 'Mittlerer Aufwand', 'Hoher Aufwand', 'Sehr hoher Aufwand'][list.children.length];
              description.textContent = explanation.replace(/ Der Zugang ist mit (?:geringem|mittlerem|hohem|sehr hohem) Aufwand verbunden\./, '');
              const badge = make('span', level, 'therapy-guide-access-level');
              const bars = make('span', '', 'therapy-guide-access-meter');bars.setAttribute('aria-hidden','true');
              for(let i=0;i<4;i++){const bar=make('i');if(i<=list.children.length)bar.classList.add('is-filled');bars.append(bar);}
              badge.prepend(bars);item.append(badge);
            }
            item.append(heading, description);
            list.append(item);
          });
          disclosure.append(make('p', topic[0].intro));
          if (topic[0].insuranceOptions) {
            const insuranceList = make('ul', '', 'therapy-guide-options');
            insuranceList.dataset.guideInsuranceList = '';
            const insuranceIntro = make('p');insuranceIntro.dataset.guideInsuranceIntro = '';
            disclosure.append(insuranceIntro, insuranceList, make('p', topic[0].optionsIntro));
            refreshInsuranceHelp(disclosure);
          }
          disclosure.append(list, make('p', topic[0].closing));
        } else disclosure.append(make('p', topic[1]));
        const example = review ? null : make('p');
        if (example) disclosure.append(example);
        body.push(disclosure);
        entries.push({card, example, disclosure});
      });
      if(panel.id === 'alternativen' || (review && panel.id === 'anreise')) {
        const readingHelp = {
          alternative: 'Hier findest du andere Behandlungen, die die Community für einen ähnlichen Einsatz als Alternative zur ausgewählten Therapie eingetragen hat. Die aktuelle Therapie steht links, die Alternativen rechts daneben; scrolle seitlich, um weitere zu sehen. Die Angaben unter dem Namen zeigen die Einordnung der Therapie. Klicke auf einen verlinkten Namen, um den jeweiligen Eintrag näher anzusehen. Eine Zuordnung bedeutet nicht, dass die Therapien gleich wirksam oder für jede Person austauschbar sind. Noch ungeprüfte Vorschläge sind gekennzeichnet.',
          classification: 'Hier siehst du, wie die ausgewählte Therapie eingeordnet ist: von übergeordneten Gruppen über zugehörige Therapien oder Verfahren bis zu genaueren Einträgen. So kannst du verwandte Ansätze und konkrete Varianten entdecken. Wähle einen Eintrag in der mittleren Spalte aus, um die dazugehörigen Einträge rechts zu sehen. Eine gemeinsame Gruppe bedeutet noch nicht, dass die Therapien austauschbar sind.',
          combination: 'Hier findest du gezielte Kombinationen und ihre Bestandteile. Die Behandlungen sollen im Zusammenspiel einen zusätzlichen oder anderen Effekt erzielen oder zusammen eine eigenständige Therapie bilden. Es geht also um mehr als die gleichzeitige Anwendung. Eine Kombination ist keine einzelne Ersatztherapie; die Zuordnung allein sagt noch nichts darüber aus, wie wirksam sie ist.'
        };
        const prompts = panel.id === 'anreise' ? [
          ['provider', '.nd-provider-map', 'Behandler:innen und Erfahrungen', 'Hier erfassen wir, wo Betroffene Hilfe erhalten und die ausgewählte Therapie in Anspruch nehmen können. Wähle einen Ort aus, um auf der Karte Behandler:innen in der Nähe zu finden. Die Liste zeigt dir außerdem Alternativen, wenn du mit deiner bisherigen Behandler:in nicht zufrieden bist und die Therapie weiterführen möchtest. Deine Erfahrung mit der Behandlung kannst du im jeweiligen Eintrag teilen.']
        ] : [
          ['alternative', '.ux-alternative-section', 'Alternative Therapien', 'Hier tragen wir das Community-Wissen zu Therapiealternativen zusammen. Ergänze frei, was du für eine Alternative hältst – aus eigener Erfahrung, von anderen Betroffenen oder vom Hörensagen. Eigene Behandlungserfahrung ist nicht nötig. Genauso wichtig: Bestätige bestehende Einträge, die du ebenfalls als Alternative ansiehst.'],
          ['classification', '[data-relationship-stages]', 'Gruppen und genauere Verfahren', 'Hilf mit, diesen Eintrag im Therapiespektrum einzuordnen und zu konkretisieren. Ergänze fehlende Zuordnungen oder bestätige bestehende Zu- und Einordnungen.'],
          ['combination', '[data-combination-section]', 'Therapiekombinationen', 'Welche Behandlungen ergeben zusammen mehr als ihre einzelnen Bestandteile? Gesucht sind gezielte Kombinationen, die einen zusätzlichen oder anderen Effekt erzielen sollen, den Genesungsprozess unterstützen oder zusammen eine eigenständige Therapie bilden. Entscheidend ist dieses Zusammenspiel, nicht allein die gleichzeitige Anwendung. Ergänze Kombinationen und ihre Bestandteile, die du kennst, oder bestätige bestehende Einträge. Eigene Behandlungserfahrung ist dafür nicht nötig.']
        ];
        if(panel.id === 'alternativen') body[0].textContent = review
          ? 'Prüfe die vorhandenen Alternativen, Einordnungen und Kombinationen. Bestätige passende Einträge oder ergänze fehlende über die Schaltflächen im jeweiligen Bereich. Eigene Behandlungserfahrung ist dafür nicht nötig.'
          : 'Du suchst nach Therapiealternativen? Hier findest du mögliche Alternativen, verwandte und genauer beschriebene Verfahren sowie gezielte Therapiekombinationen. Öffne die Hinweise, um zu erfahren, wie du die einzelnen Bereiche lesen kannst.';
        if(panel.id === 'anreise') body[0].textContent = 'Suche in der Liste nach deiner Behandler:in. Fehlt er oder sie, kannst du den Eintrag unter „Behandler:innen hinzufügen“ ergänzen.';
        prompts.forEach(([key, selector, title, text]) => {
          const target = panel.querySelector(selector);
          if(!target)return;
          target.dataset.guideContribution = key;
          const disclosure = make('details');
          if(key === 'classification') {
            title = target.querySelector('h3')?.firstChild?.textContent.trim() || title;
          }
          disclosure.append(make('summary', title), make('p', !review && readingHelp[key] ? readingHelp[key] : text));
          if(key === 'classification') {
            const explanations = {
              'Zugeordnete Gruppen': 'In welche übergeordneten Gruppen gehört der Eintrag?',
              'Therapie / Verfahren': 'Welche konkreten Therapien oder Verfahren gehören dazu?',
              'Detailliertere Verfahren': 'Welche genaueren Verfahren konkretisieren die Therapie?',
              'Medikamentengruppe': 'Zu welchen Medikamentengruppen gehört der Eintrag?',
              'Wirkstoffe': 'Welche Wirkstoffe sind zugeordnet?',
              'Handelsnamen': 'Unter welchen Handelsnamen werden die Wirkstoffe angeboten?',
              'Übergeordnete Substanz': 'Welcher übergeordneten Substanz ist der Eintrag zugeordnet?',
              'Anwendungsform': 'In welcher Form wird die Substanz angewendet?',
              'Weitere Anwendungsformen': 'Welche weiteren Anwendungsformen gehören dazu?',
              'Stoffvariante': 'Welche Variante der übergeordneten Substanz ist gemeint?',
              'Varianten und Anwendungsformen': 'Welche Stoffvarianten oder Anwendungsformen konkretisieren den Eintrag?'
            };
            const list = make('ul', '', 'therapy-guide-options');
            target.querySelectorAll('.ux-stage-column > h4').forEach(column => {
              const label = column.textContent.trim();
              const item = make('li');
              item.append(make('strong', label + ':'), make('span', explanations[label] || 'Welche zugehörigen Einträge kennst du?'));
              list.append(item);
            });
            disclosure.append(list);
          }
          const instructions = {
            alternative: 'So machst du mit: Scrolle die Alternativen ganz nach rechts und klicke auf das Plus-Feld, um eine weitere Therapie hinzuzufügen. Mit ✓ bestätigst du einen Eintrag als Alternative, mit × widersprichst du dieser Zuordnung.',
            classification: 'So machst du mit: Klicke auf die Plus-Felder in der jeweiligen Spalte, um eine Gruppe zuzuordnen oder weitere Einträge zu ergänzen. Wähle einen Eintrag in der mittleren Spalte aus, um die dazugehörigen genaueren Einträge rechts zu sehen und zu ergänzen. Mit ✓ bestätigst du eine Zuordnung, mit × widersprichst du ihr.',
            combination: 'So machst du mit: Über die Schaltflächen unter den Kombinationen kannst du diese Therapie einer bestehenden Kombination zuordnen oder eine neue Kombination erstellen. Weitere Bestandteile ergänzt du über das Plus-Feld bei der jeweiligen Kombination. Mit ✓ bestätigst du die Kombination oder die Zuordnung eines Bestandteils, mit × widersprichst du der jeweiligen Aussage.'
          };
          if(instructions[key])disclosure.append(make('p', instructions[key]));
          body.push(disclosure);
          entries.push({card:target, disclosure});
        });
        if(panel.id === 'alternativen' && !review) {
          body.push(make('p', 'So liest du die Rückmeldungen: Die Zahlen neben ✓ und × zeigen, wie viele Personen eine Zuordnung bestätigen oder ihr widersprechen. Sie bewerten die Zuordnung, nicht die Wirksamkeit der Therapie. Wenn du Erfahrung oder Wissen dazu hast, bestätige passende Einträge mit ✓, widersprich mit × oder ergänze fehlende Alternativen, Zuordnungen und Kombinationen über die jeweiligen Plus-Felder und Schaltflächen.'));
          sharing = shareTherapy(true);
          body.push(sharing.block);
        }
      }
      if(sharing?.toggle) body.push(sharing.toggle);
      const next = nextView();
      const nextLabel = next && 'Weiter zu „' + viewName(next) + '“ →';
      const finish = () => {
        finishedSections[panel.id] = true;
        save();updateProgress();
        const thanks = make('dialog');
        thanks.setAttribute('aria-label', 'Danke, dass du dabei bist');
        const thanksActions = make('div', '', 'experience-guide-actions');
        thanksActions.append(button('Hier bleiben', () => thanks.close(), true), button('Anderes Anliegen wählen', () => {thanks.close();showOrientation();}));
        illustrated(thanks, 'Für heute geschafft', make('h2', 'Danke, dass du dabei bist!'),
          make('p', 'Schön, dass du dir Zeit genommen hast, dich hier umzusehen und dein Wissen zu teilen. So wächst unser gemeinsames Wissen – und andere Betroffene finden leichter ihren Weg.'),
          make('p', 'Du musst nicht alles ausfüllen. Für heute darf es genug sein. Du kannst jederzeit zurückkommen, etwas ergänzen oder einfach weiterlesen.'), thanksActions);
        document.body.append(thanks);
        thanks.addEventListener('close', () => thanks.remove(), {once:true});
        thanks.showModal();
      };
      const nextButton = next ? button(nextLabel, () => {
        if(review){finishedSections[panel.id] = true;save();updateProgress();}
        openView(next);
      }, true) : null;
      nextButton?.classList.add('therapy-guide-next');
      const previous = views[views.findIndex(link => link.dataset.view === panel.id) - 1];
      const backButton = previous ? button('← Zurück zu „' + viewName(previous) + '“', () => openView(previous)) : null;
      backButton?.classList.add('therapy-guide-back');
      const changeIntent = button('Ich bin hier fertig', finish);
      changeIntent.classList.add('therapy-guide-change-intent');
      if (review && entries.length) {
        completion = make('p', '', 'therapy-guide-progress');
        completion.setAttribute('role', 'status');
        body.push(completion);
      }
      const secondaryActions = make('div', '', 'therapy-guide-secondary-actions');
      secondaryActions.append(changeIntent, close);
      actions.classList.add('therapy-guide-navigation');
      const navigationPair = make('div', '', 'therapy-guide-navigation-pair');
      if(backButton)navigationPair.append(backButton);
      if(backButton && nextButton){const divider=make('span', '', 'therapy-guide-navigation-divider');divider.setAttribute('aria-hidden','true');navigationPair.append(divider);}
      if(nextButton)navigationPair.append(nextButton);
      actions.append(navigationPair, secondaryActions);
      illustrated(guide, review ? (panel.id === 'alternativen' ? 'Community-Wissen' : 'Deine Erfahrung zählt') : 'Erfahrungen verstehen', heading, ...body, actions);
      panel.prepend(guide);
      refreshTopics();
    }

    const choices = [
      ['review', 'Meine Erfahrung teilen', 'Berichte Schritt für Schritt, wie es dir mit der Therapie ging. Du entscheidest, welche Fragen du beantworten möchtest.', 'wirkung', 'Erfahrung teilen'],
      ['providers', 'Behandler:innen finden (Karte)', 'Suche auf der Karte nach Behandler:innen, die diese Therapie anbieten. Wähle einen Ort aus, um Behandler:innen in der Nähe zu finden.', 'anreise', 'Behandler:innen suchen'],
      ['symptoms', 'Bei welchem Symptom hilft die Therapie?', 'Sieh nach, bei welchen Symptomen die ausgewählte Therapie laut Community helfen kann.', 'symptome', 'Symptome ansehen'],
      ['explore', 'Erfahrungsberichte der Community ansehen', 'Sieh dir die Erfahrungsberichte der Community zu Themen wie Wirkung, Belastung und Kosten an. Wir führen dich als Nächstes Schritt für Schritt durch alle vorhandenen Angaben der Community.', 'wirkung', 'Erfahrungen ansehen'],
      ['alternatives', 'Therapiealternativen', 'Entdecke weitere Alternativen zur ausgewählten Therapie. Nutze das breite Wissen der Community und finde Inspiration für deinen Therapieplan.', 'alternativen', 'Alternativen ansehen']
    ];

    let wheelSerial = 0;
    function addChoices(host, dialog) {
      host.classList.add('therapy-intent-carousel', 'therapy-intent-wheel');
      const instance = 'therapy-wheel-' + (++wheelSerial);
      const rowHeight = 52;
      const wrapIndex = index => ((index % choices.length) + choices.length) % choices.length;
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const track = make('div', '', 'therapy-intent-track');
      track.tabIndex = 0;
      track.setAttribute('role', 'listbox');
      track.setAttribute('aria-label', 'Dein Anliegen – nach oben oder unten blättern');
      track.setAttribute('aria-orientation', 'vertical');
      const position = make('span', '1 / ' + choices.length, 'therapy-intent-position');
      position.setAttribute('aria-live', 'polite');
      const viewport = make('div', '', 'therapy-wheel-viewport');
      const card = make('div', '', 'therapy-intent-focus-card');
      const header = button('', () => { if (!suppressClick) setExpanded(!expanded); });
      header.classList.add('therapy-intent-title', 'is-current', 'therapy-intent-card-toggle');
      const reveal = make('div', '', 'therapy-intent-reveal');
      reveal.id = instance + '-detail';
      reveal.setAttribute('role', 'region');
      const body = make('div', '', 'therapy-intent-reveal-inner');
      const copy = make('div', '', 'therapy-intent-reveal-copy');
      const description = make('p', choices[0][2]);
      const follow = button(choices[0][4] + ' →', () => {
        const [value, , , view] = choices[current];
        dialog?.close();
        mode = value;
        minimized = false;
        save();
        const target = value === 'explore'
          ? views.find(link => !['ueberblick', 'anreise', 'alternativen'].includes(link.dataset.view) && hasInformation(link))
            || views.find(link => link.dataset.view === 'wirkung')
          : views.find(link => link.dataset.view === view);
        paint(true);
        openView(target);
        if (value === 'explore' && experienceCount() === 0) showEmptyState();
      }, true);
      copy.append(description, follow);
      body.append(copy);
      reveal.append(body);
      card.append(header, reveal);
      header.setAttribute('aria-controls', reveal.id);
      const visual = make('div', '', 'therapy-wheel-visual');
      track.setAttribute('aria-owns', choices.map((_, index) => instance + '-option-' + index).join(' '));
      const rows = [];
      const visualRows = [];
      let current = 0;
      let expanded = false;
      let scrolling = false;
      let settleTimer;
      let suppressClick = false;

      function paintWheel() {
        const fraction = track.scrollTop / rowHeight - choices.length;
        const extra = reveal.getBoundingClientRect().height;
        viewport.style.setProperty('--therapy-reveal-height', extra + 'px');
        viewport.classList.toggle('is-scrolling', scrolling);
        visualRows.forEach((control, index) => {
          const distance = wrapIndex(index - fraction + choices.length / 2) - choices.length / 2;
          const shift = -extra / 2 + extra * Math.max(0, Math.min(1, distance));
          const offset = viewport.clientHeight / 2 - rowHeight / 2 + distance * rowHeight + shift;
          const scale = Math.max(.84, 1 - Math.abs(distance) * .045);
          control.style.transform = 'translate3d(0,' + offset + 'px,0) scale(' + scale + ')';
          control.style.opacity = String(Math.max(.14, 1 - Math.abs(distance) * .34));
          control.style.visibility = 'visible';
        });
      }

      function settle() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          const row = Math.round(track.scrollTop / rowHeight);
          const target = row * rowHeight;
          if (Math.abs(track.scrollTop - target) > .5) {
            track.scrollTo({top: target, behavior: reducedMotion ? 'instant' : 'smooth'});
          } else {
            if (row < choices.length || row >= choices.length * 2) {
              track.scrollTop = (choices.length + wrapIndex(row)) * rowHeight;
            }
            scrolling = false;
            paintWheel();
          }
        }, 140);
      }

      function setExpanded(value) {
        expanded = value;
        header.setAttribute('aria-expanded', String(expanded));
        header.setAttribute('aria-label', choices[current][1] + (expanded ? ' – Erklärung schließen' : ' – Erklärung öffnen'));
        reveal.inert = !expanded;
        reveal.setAttribute('aria-hidden', String(!expanded));
        viewport.classList.toggle('is-expanded', expanded);
        rows.forEach((control, index) => control.classList.toggle('is-open', index === current && expanded));
        paintWheel();
        // The header stays in place; only the content beneath it slides open.
      }

      function update() {
        const row = wrapIndex(Math.round(track.scrollTop / rowHeight));
        if (row !== current) {
          current = row;
          setExpanded(false);
        }
        rows.forEach((control, index) => {
          control.classList.toggle('is-current', index === current);
          control.classList.toggle('is-near', Math.abs(index - current) === 1);
          control.setAttribute('aria-selected', String(index === current));
          control.classList.toggle('is-open', index === current && expanded);
        });
        reveal.setAttribute('aria-labelledby', instance + '-option-' + current);
        description.textContent = choices[current][2];
        follow.textContent = choices[current][4] + ' →';
        header.setAttribute('aria-label', choices[current][1] + (expanded ? ' – Erklärung schließen' : ' – Erklärung öffnen'));
        track.setAttribute('aria-activedescendant', instance + '-option-' + current);
        position.textContent = (current + 1) + ' / ' + choices.length;
        previous.disabled = false;
        next.disabled = false;
        paintWheel();
      }

      function go(index, visiblePosition = false) {
        setExpanded(false);
        const row = track.scrollTop / rowHeight;
        // Use the same wrapped distance as the visible labels, including during rotation.
        const target = visiblePosition
          ? row + wrapIndex(index - row + choices.length / 2) - choices.length / 2
          : Math.round(row) + index - current;
        track.scrollTo({top: target * rowHeight,
          behavior: reducedMotion ? 'instant' : 'smooth'});
      }
      choices.forEach((choice, index) => {
        const control = make('div', '', 'therapy-intent-title therapy-wheel-visual-option');
        const marker = make('span', String(index + 1), 'therapy-wheel-marker');
        marker.setAttribute('aria-hidden', 'true');
        const label = make('span', '', 'therapy-wheel-label');
        label.append(make('strong', choice[1]));
        if (choice[0] === 'explore') {
          const availability = make('small', '', 'therapy-wheel-availability');
          availability.dataset.therapyExperienceAvailability = '';
          availability.hidden = true;
          label.append(availability);
        }
        control.append(marker, label);
        control.id = instance + '-option-' + index;
        control.setAttribute('role', 'option');
        control.addEventListener('click', () => {
          if (suppressClick) return;
          if (index === current && !scrolling) setExpanded(!expanded);
          else go(index, true);
        });
        rows.push(control);
        visualRows.push(control);
        visual.append(control);
      });
      // A longer empty scroll range permits seamless rotation with one label per option.
      for (let index = 0; index < choices.length * 3; index++) {
        const spacer = make('div', '', 'therapy-intent-scroll-spacer');
        spacer.setAttribute('aria-hidden', 'true');
        track.append(spacer);
      }
      track.addEventListener('scroll', () => {
        scrolling = true;
        update();
        settle();
      }, {passive: true});
      track.addEventListener('keydown', event => {
        if (['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Enter' || event.key === ' ') {
            setExpanded(!expanded);
            header.focus({preventScroll: true});
          } else if (event.key === 'Home') go(0);
          else if (event.key === 'End') go(choices.length - 1);
          else go(current + (event.key === 'ArrowDown' ? 1 : -1));
        }
      });
      header.addEventListener('keydown', event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          go(current + (event.key === 'ArrowDown' ? 1 : -1));
        }
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Escape' && expanded) {
          event.preventDefault();
          event.stopPropagation();
          setExpanded(false);
          header.focus({preventScroll: true});
        }
      });
      const previous = button('⌃', () => go(current - 1));
      previous.setAttribute('aria-label', 'Vorheriges Anliegen');
      const next = button('⌄', () => go(current + 1));
      next.setAttribute('aria-label', 'Nächstes Anliegen');
      const controls = make('div', '', 'therapy-wheel-controls');
      controls.append(previous, position, next);
      viewport.append(track, visual, controls, card);
      host.append(viewport);
      refreshEntryAvailability(host);
      // Reserve the tallest explanation once per width, so opening never resizes the banner.
      let measuredWidth = 0;
      function reserveSpace() {
        if (!host.isConnected || !copy.clientWidth) return;
        const measure = copy.cloneNode(true);
        measure.setAttribute('aria-hidden', 'true');
        measure.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;box-sizing:border-box;width:' + copy.clientWidth + 'px;height:auto';
        card.append(measure);
        let maximum = 0;
        choices.forEach(choice => {
          measure.querySelector('p').textContent = choice[2];
          measure.querySelector('button').textContent = choice[4] + ' →';
          maximum = Math.max(maximum, measure.getBoundingClientRect().height);
        });
        measure.remove();
        viewport.style.height = Math.max(260, 130 + Math.ceil(maximum)) + 'px';
        paintWheel();
      }
      new ResizeObserver(() => {
        if (measuredWidth !== header.clientWidth) {
          measuredWidth = header.clientWidth;
          reserveSpace();
        }
      }).observe(header);
      new ResizeObserver(() => {
        paintWheel();
      }).observe(reveal);
      viewport.addEventListener('wheel', event => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
        const delta = event.deltaY * factor;
        const maximum = (choices.length * 3 - 1) * rowHeight;
        event.preventDefault();
        if (expanded) setExpanded(false);
        track.scrollTop = Math.max(0, Math.min(maximum, track.scrollTop + delta * .55));
        settle();
      }, {passive: false});
      let drag;
      viewport.addEventListener('pointerdown', event => {
        if (event.button !== 0 || (event.target.closest('button') && !header.contains(event.target))) return;
        drag = {id: event.pointerId, y: event.clientY, top: track.scrollTop, moved: false};
      });
      viewport.addEventListener('pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        const distance = drag.y - event.clientY;
        if (!drag.moved && Math.abs(distance) < 6) return;
        drag.moved = true;
        viewport.setPointerCapture(event.pointerId);
        if (expanded) setExpanded(false);
        event.preventDefault();
        track.scrollTop = Math.max(0, Math.min((choices.length * 3 - 1) * rowHeight, drag.top + distance));
      });
      const finishDrag = event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (drag.moved) {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
          settle();
        }
        drag = null;
      };
      viewport.addEventListener('pointerup', finishDrag);
      viewport.addEventListener('pointercancel', finishDrag);
      setExpanded(false);
      requestAnimationFrame(() => {
        track.scrollTop = choices.length * rowHeight;
        update();
      });
    }

    function enableOrientation() {
      minimized = false;
      if (!mode) mode = 'explore';
      save();
      paint(true);
    }

    function showOrientation() {
      if (document.querySelector('dialog.therapy-orientation')) return;
      const dialog = make('dialog', '', 'therapy-orientation');
      dialog.setAttribute('aria-label', 'Was möchtest du tun?');
      const actions = make('div', '', 'experience-guide-actions therapy-guide-choices');
      addChoices(actions, dialog);
      illustrated(dialog, 'Orientierung', make('h2', 'Was möchtest du tun?'),
        make('p', 'Blättere zu deinem Anliegen und öffne die Erklärung.'), actions,
        button('Schließen', () => dialog.close()),
        button(minimized ? 'Orientierung wieder einschalten' : 'Ich brauche keine Orientierung', () => {
          if (minimized) {
            dialog.close();
            enableOrientation();
          } else disableOrientation(dialog);
        }));
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove(), {once: true});
      dialog.showModal();
    }

    function showEmptyState() {
      const dialog = make('dialog');
      dialog.setAttribute('aria-label', 'Deine Einladung kann den Anfang machen');
      const invitation = shareTherapy();
      invitation.message.textContent = 'Zu dieser Therapie liegen noch keine Erfahrungen vor. Kennst du jemanden, der sie ausprobiert hat? Lade die Person ein, ihre Erfahrung zu teilen. Damit hilfst du dir und anderen, die sich über diese Therapie informieren möchten.';
      illustrated(dialog, 'Noch keine Erfahrungen', make('h2', 'Deine Einladung kann den Anfang machen'),
        invitation.block, button('Trotzdem umsehen', () => dialog.close()));
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove(), {once: true});
      dialog.showModal();
    }

    const orientation = button('Orientierung', showOrientation);
    orientation.classList.add('therapy-orientation-fab');
    orientation.setAttribute('aria-haspopup', 'dialog');
    document.body.append(orientation);

    let observedFeedback;
    const feedbackSize = new ResizeObserver(syncFloatingButtons);
    function syncFloatingButtons() {
      const feedback = document.querySelector('.lcn-feedback-float');
      if (!feedback) return;
      if (observedFeedback !== feedback) {
        observedFeedback = feedback;
        feedbackSize.observe(feedback);
        new MutationObserver(syncFloatingButtons).observe(feedback, {attributes: true, attributeFilter: ['style', 'class']});
      }
      const rect = feedback.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      orientation.style.width = rect.width + 'px';
      orientation.style.height = rect.height + 'px';
      orientation.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
      orientation.style.bottom = (innerHeight - rect.top + 12) + 'px';
      orientation.style.font = getComputedStyle(feedback).font;
    }
    new MutationObserver(syncFloatingButtons).observe(document.body, {childList: true});
    window.addEventListener('resize', syncFloatingButtons);
    window.addEventListener('scroll', syncFloatingButtons, {passive: true});
    syncFloatingButtons();

    document.addEventListener('lcn-guide-contributed', event => {
      const topic = event.detail?.topic;
      if(topic === 'provider')providerContributed = true;
      else if(['alternative','classification','combination'].includes(topic))relationshipContributions[topic] = true;
      else return;
      save();updateProgress();
    });
    window.addEventListener('lcn-provider-contributed', () => {
      providerContributed = true;save();updateProgress();
    });
    window.addEventListener('lcn-provider-catalog', event => {
      if(event.detail?.contributed){providerContributed=true;save();updateProgress();}
    });
    restore();
    document.addEventListener('lcn-treatment-view-changed', () => paint());
    document.addEventListener('lcn-treatment-answers-rendered', () => {
      if (mode === 'explore' && panel?.id !== 'ueberblick' && !minimized) paint(true);
      else refreshTopics();
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        restore();
        paint(true);
      }
    });
    if (new URLSearchParams(location.search).get('anliegen') === 'erfahrung') {
      mode = 'review';
      minimized = false;
      save();
      openView(views.find(link => link.dataset.view === 'wirkung'));
    }
    paint();
  }

  function nextLabel() {
    if (saved || !steps[step][4] || steps[step][5] === 'manual') return 'Schritt abschließen';
    return step === steps.length - 1 ? 'Begleitung abschließen' : 'Schritt überspringen';
  }

  function paintContext(host, view) {
    if (!host || disabled || dismissed) return;
    const local = view === 'ueberblick' ? -1 : steps.findIndex(item => item[0] === view && cardFor(item[1]));
    if (local < 0 && step < 0) return;
    const key = view + ':' + step;
    const existing = content.querySelector('[data-experience-context]');
    if (existing?.dataset.experienceContext === key) return;
    existing?.remove();
    const note = make('section');
    note.dataset.experienceContext = key;
    const actions = make('div', '', 'experience-guide-actions');
    if (local >= 0) {
      actions.append(
        button('Hier weitermachen ↓', () => {
          goTo(local);
          scrollTo(cardFor(steps[local][1]));
        }, true),
        button('Diesen Bereich überspringen', () => {
          const next = steps.findIndex((item, index) => index > local && item[0] !== view);
          if (next >= 0) goTo(next);
          else end();
        })
      );
    }
    if (step >= 0) actions.append(button('Zurück zu „' + steps[step][2] + '“', showStep, local < 0));
    actions.append(button('Rest überspringen', end));
    const description = local >= 0
      ? steps.filter(item => item[0] === view).map(item => item[3]).join(' ')
      : 'Du kannst dich hier umsehen und zu deinem offenen Schritt zurückkehren, wenn du soweit bist.';
    illustrated(note, 'Deine Erfahrung zählt', make('h2', local >= 0 ? 'Hier kannst du etwas beitragen' : 'Deine Begleitung wartet'),
      make('p', description), actions);
    host.prepend(note);
  }

  function paint() {
    const current = steps[step];
    const target = current && cardFor(current[1]);
    const host = content;
    const activeView = location.hash.slice(1) || 'ueberblick';
    const context = content.querySelector('[data-experience-context]');
    if (context && context.dataset.experienceContext !== activeView + ':' + step) context.remove();
    const visible = target && activeView === current[0] && !target.closest('[hidden]');
    const existing = content.querySelector('[data-experience-step]');
    if (existing && (!visible || existing.parentElement !== host || step !== Number(existing.dataset.experienceStep))) existing.remove();
    const banner = content.querySelector('[data-experience-banner]');
    if (banner) banner.hidden = activeView === 'ueberblick' && step >= 0;
    if (!visible) {
      paintContext(content, activeView);
      return;
    }
    context?.remove();
    if (existing?.isConnected) {
      existing.querySelector('[role="status"]').textContent = saved ? 'Danke, deine Angabe ist gespeichert.' : '';
      existing.querySelector('[data-experience-next]').textContent = nextLabel();
      existing.querySelector('[data-experience-skip]').hidden = nextLabel() !== 'Schritt abschließen';
      return;
    }
    const note = make('section');
    note.dataset.experienceStep = String(step);
    const status = make('p', saved ? 'Danke, deine Angabe ist gespeichert.' : '', 'experience-guide-status');
    status.setAttribute('role', 'status');
    const actions = make('div', '', 'experience-guide-actions');
    const next = button(nextLabel(), () => {
      if (saved || step === steps.length - 1 || !current[4]) checkpoint();
      else advance();
    });
    next.dataset.experienceNext = '';
    const jump = button(current[4] ? 'Zur Angabe ↓' : 'Zu den Therapien ↓', () => scrollTo(cardFor(current[1])), true);
    actions.append(jump, next);
    const skip = button('Schritt überspringen', advance);
    skip.dataset.experienceSkip = '';
    skip.hidden = nextLabel() !== 'Schritt abschließen';
    actions.append(skip);
    actions.append(button('Rest überspringen', end));
    illustrated(note, 'Deine Erfahrung zählt · ' + (step + 1) + ' von ' + steps.length,
      make('h2', current[2]), make('p', 'Lass dir Zeit. Teile nur, was du gerade beitragen kannst.'),
      make('p', current[3]), status, actions);
    host.prepend(note);
  }

  function end() {
    step = -1;
    offered = true;
    dismissed = true;
    saveProgress();
    content.querySelector('[data-experience-context]')?.remove();
    paint();
    scrollTo(content);
  }

  function showStep() {
    const link = document.querySelector('.side-nav [data-view="' + steps[step][0] + '"]');
    if (link?.getAttribute('aria-current') !== 'page') link?.click();
    paint();
    scrollTo(content.querySelector('[data-experience-step]'));
  }

  function goTo(index) {
    step = index;
    saved = false;
    prompted = false;
    dismissed = false;
    offered = true;
    saveProgress();
    showStep();
  }

  function advance() {
    if (step === steps.length - 1) end();
    else goTo(step + 1);
  }

  function prompt(titleText, message, configure) {
    if (disabled || document.getElementById('experience-guide-dialog')) return;
    const dialog = make('dialog');
    dialog.id = 'experience-guide-dialog';
    dialog.setAttribute('aria-labelledby', 'experience-guide-title');
    const title = make('h2', titleText);
    title.id = 'experience-guide-title';
    const actions = make('div', '', 'experience-guide-actions');
    configure(dialog, actions);
    illustrated(dialog, 'Deine Erfahrung zählt', title, make('p', message), actions);
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.showModal();
  }

  function offer(afterSave) {
    if (disabled || step >= 0) return;
    offered = true;
    saveProgress();
    prompt(
      afterSave ? 'Danke für deine Community-Bewertung!' : 'Möchtest du deine Erfahrung ergänzen?',
      'Deine Erfahrung gibt anderen Orientierung. Wenn du gerade Kraft dafür hast, gehen wir mit dir Schritt für Schritt weiter. Du kannst jederzeit pausieren.',
      (dialog, actions) => actions.append(
        button('Schritt für Schritt weiter', () => { dialog.close(); advance(); }, true),
        button('Jetzt nicht', () => dialog.close()),
        button('Hinweise ausschalten', () => {
          disabled = true;
          try { localStorage.setItem(preference, '1'); } catch {}
          dialog.close();
        })
      )
    );
  }

  function checkpoint() {
    const next = steps[step + 1];
    prompted = true;
    saveProgress();
    prompt(
      next ? 'Danke, dass du deine Erfahrung teilst!' : 'Danke für deine Zeit!',
      next
        ? 'Deine Angaben helfen anderen in der Community. Hast du noch Kraft für den nächsten Schritt? Dann nehmen wir dich mit zu „' + next[2] + '“.'
        : 'Was du aus deiner Erfahrung beigetragen hast, kann anderen bei ihrer Entscheidung helfen.',
      (dialog, actions) => {
        actions.append(button(next ? 'Zum nächsten Schritt →' : 'Begleitung abschließen', () => { dialog.close(); advance(); }, true));
        if (next) actions.append(
          button('Hier noch ergänzen', () => dialog.close()),
          button('Für heute fertig', () => { dialog.close(); end(); })
        );
      }
    );
  }

  function answersComplete(mode) {
    if (mode === 'manual') return false;
    if (mode === 'appointments') {
      return cardFor(steps[step][1])?.querySelectorAll('[data-choice][aria-pressed="true"]').length === 6;
    }
    if (mode === 'costs') {
      return ['unit_cost', 'total_cost'].every(key =>
        content.querySelector('[data-question="' + key + '"] [data-option][aria-pressed="true"]'));
    }
    return true;
  }

  function mount() {
    const chart = cardFor(rating);
    if (chart && content.querySelector('.overview-facts') && !content.querySelector('[data-experience-banner]')) {
      const banner = make('section', '', 'experience-guide-banner');
      banner.dataset.experienceBanner = '';
      const intro = make('p');
      intro.append(
        make('strong', 'Wie hast du deine Behandlung erlebt?'),
        ' Teile, was dir geholfen hat oder schwierig war. So hilfst du anderen, eine passende Anlaufstelle zu finden.'
      );
      const actions = make('div', '', 'experience-guide-actions');
      actions.append(button('Erfahrung teilen ↓', () => {
        if (content.querySelector(rating + '[aria-pressed="true"]') && !disabled && step < 0) offer(false);
        else scrollTo(cardFor(rating));
      }, true));
      illustrated(banner, 'Deine Erfahrung zählt',
        make('h2', 'Teile deine Erfahrung mit dieser Praxis'),
        intro, make('p', 'Starte mit deiner Community-Bewertung. Danach kannst du freiwillig weitere Angaben ergänzen.'), actions);
      content.prepend(banner);
    }
    paint();
  }

  window.addEventListener('lcn-doctor-rendered', mount);
  window.addEventListener('lcn-experience-answer-saved', event => {
    const question = event.detail;
    if (question === 'effect' && !offered) offer(true);
    if (steps[step]?.[4]?.test(question) && content.querySelector('[data-experience-step]')) {
      saved = true;
      saveProgress();
      paint();
      if (!prompted && answersComplete(steps[step][5])) checkpoint();
    }
  });
  window.addEventListener('hashchange', paint);
  window.addEventListener('popstate', paint);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      restoreProgress();
      paint();
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.side-nav [data-view]')) queueMicrotask(paint);
  });
  mount();
})();
