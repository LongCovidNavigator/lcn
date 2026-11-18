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

  // Keep native selection anchors intact when background data has not changed.
  function updateText(node, text) {
    if (node.textContent === text) return;
    if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) {
      node.firstChild.data = text;
    } else node.textContent = text;
  }

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

  function scrollTo(target, minimumOffset = 0) {
    const heading = target?.querySelector('h2,h3') || target;
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({preventScroll: true});
    const headerOffset = Math.max(minimumOffset, parseFloat(getComputedStyle(content).scrollMarginTop) || 0);
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
    const treatment = content.closest('[data-treatment-id]');
    const treatmentId = treatment.dataset.treatmentId;
    const storagePrefix = 'lcn_therapy_guide:';
    const preferredModeKey = 'lcn_therapy_guide_preferred_mode';
    const orientationDisabledKey = 'lcn_therapy_guide_disabled';
    const topics = {
      effect: [
        {"intro": "Unter Community-Bewertung fasst die Community zusammen, wie sich der Gesamtzustand bei Anwendung der ausgewählten Therapie verändert hat. Du kannst zwischen vier Antworten wählen:", "options": ["Verschlechterung: Die Behandlung hatte einen negativen Effekt auf deine Gesundheit.", "Neutral: Dein Gesamtzustand ist gleich geblieben.", "Verbesserung: Du hast einen positiven Effekt auf deinen Gesamtzustand gespürt.", "Heilung: Die Therapie hat bei dir zu einer Genesung geführt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Therapie besser einzuschätzen."},
        'Hier geht es um die Veränderung des Gesamtzustands während der Anwendung: Verschlechterung, Neutral (keine Veränderung), Verbesserung oder Heilung. Die Balken und Prozentangaben zeigen, wie sich die Antworten auf diese vier Möglichkeiten verteilen. Lies auch die Anzahl der Angaben: Ein hoher Anteil bei wenigen Antworten beschreibt zunächst nur diese wenigen Erfahrungen. Die Auswertung zeigt persönliche Einschätzungen und belegt nicht, dass die Therapie allein die Veränderung verursacht hat.'
      ],
      gamechanger: [
        {"intro": "Als Gamechanger gilt eine Therapie, die deinen Genesungsprozess entscheidend vorangetrieben hat. Du kannst zwischen zwei Antworten wählen:", "options": ["Ja: Die ausgewählte Therapie hat deinen Genesungsprozess entscheidend vorangetrieben.", "Nein: Die ausgewählte Therapie hat deinen Genesungsprozess leider nicht entscheidend vorangetrieben."], "closing": "Klicke in der Abbildung auf die passende Antwort. Damit hilfst du anderen, die Bedeutung der Therapie für den Genesungsprozess einzuschätzen."},
        'Die Frage lautet: Hat die Therapie den Genesungsprozess entscheidend vorangetrieben? Im Ring und neben den Antworten siehst du den Anteil von Ja und Nein. Ein Ja steht für einen entscheidenden Fortschritt, nicht zwingend für Heilung. Ein Nein bedeutet umgekehrt nicht automatisch, dass die Therapie gar nicht geholfen hat. Vergleiche diese Angabe deshalb mit der Community-Bewertung des Gesamtzustands.'
      ],
      symptoms: [
        {"intro": "Hier sammelt die Community, welche Symptome durch die ausgewählte Therapie gelindert wurden. Du hast folgende Möglichkeiten:", "options": ["Symptome auswählen: Klicke auf die passenden Symptome in der Auflistung unten, um deine Erfahrung zu ergänzen.", "Weitere Symptome ergänzen: Ergänze Symptome, die durch die Therapie gelindert wurden und noch nicht aufgelistet sind."], "closing": "Damit hilfst du anderen mit ähnlichen Symptomen, die Therapie besser einzuschätzen."},
        'Die Liste zeigt, bei welchen Symptomen die Community eine Linderung durch die Therapie berichtet. Die Zahl neben einem Symptom zählt die entsprechenden Nennungen. Eine Person kann mehrere Symptome auswählen; die Zahlen lassen sich deshalb nicht zu einer Zahl behandelter Personen addieren. Viele Nennungen sind keine Erfolgsquote: Hier wird nicht erfasst, wie viele Menschen das jeweilige Symptom hatten, ohne eine Linderung zu erleben. Ein Symptom ohne Stimmen bedeutet, dass bisher keine entsprechende Linderung eingetragen wurde.'
      ],
      setting: [
        {"intro": "Die Community erfasst, wo und in welchem Rahmen du die ausgewählte Therapie angewendet hast. Dieses Durchführungssetting hilft anderen einzuschätzen, welcher Aufwand damit für sie verbunden wäre und ob der Rahmen zu ihnen passt. Zur Auswahl stehen:", "options": ["Selbstständig zu Hause: Du wendest die Therapie eigenständig zu Hause an, ohne zusätzlichen Reiseaufwand oder die Hilfe einer Behandlerin oder eines Behandlers.", "Hausbesuch: Du benötigst Unterstützung durch Fachpersonal, kannst die Behandlung aber zu Hause durchführen.", "Ambulant: Du hast einzelne Termine vor Ort, zum Beispiel in einer Praxis.", "Stationär: Du hältst dich zur Behandlung für einen längeren Zeitraum in einer Einrichtung auf."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Durchführung der Therapie zu planen."},
        'Die Verteilung zeigt, in welchem Rahmen andere die Therapie durchgeführt haben: selbstständig zu Hause, als Hausbesuch, ambulant mit einzelnen Terminen vor Ort oder stationär mit Aufenthalt in einer Einrichtung. Vergleiche die Anteile, um einen Eindruck von möglichen Abläufen zu bekommen. Das häufigste Setting ist keine verbindliche Vorgabe für jede Anwendung. Lies die Angaben zusammen mit dem Anreiseaufwand und der Einschätzung zum Verschlechterungsrisiko.'
      ],
      pem: [
        {"intro": "Hier geht es um deine Einschätzung aus eigener Erfahrung: Wie hoch hältst du das Risiko, dass die ausgewählte Behandlung bei anderen zu einer Zustandsverschlechterung führt? Zur Auswahl stehen:", "options": ["Keines: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung nicht vorhanden ist.", "Niedrig: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung gering ist.", "Mittel: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung mittel ist.", "Hoch: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung hoch ist."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die mögliche Belastung durch die Therapie besser einzuordnen."},
        'Hier teilt die Community ihre Einschätzung aus eigener Erfahrung zum Risiko einer Zustandsverschlechterung durch die Behandlung: keines, niedrig, mittel oder hoch. Die Prozentwerte zeigen die Verteilung dieser Einschätzungen. Sie geben nicht an, bei wie vielen Personen tatsächlich eine Verschlechterung aufgetreten ist. Achte auch auf Stimmen bei höheren Risikostufen, selbst wenn eine niedrigere Stufe häufiger gewählt wurde. Die Antwort Keines ist eine persönliche Einschätzung und keine Zusicherung für die eigene Anwendung.'
      ],
      access: [
        {"intro": "Hier erfasst die Community die Zugänglichkeit der ausgewählten Therapie: Wie aufwendig ist es, Zugang zu dieser Therapie zu erhalten? Vier Zugangswege im Vergleich:", "options": ["Selbstmanagement / eigenständig umsetzbar: Du kannst die Maßnahme selbst umsetzen. Du benötigst weder eine Behandlerin oder einen Behandler noch eine ärztliche Verordnung. Der Zugang ist mit geringem Aufwand verbunden.", "Frei erhältlich / private Behandler:innen: Du kaufst das Mittel selbst oder vereinbarst die Behandlung direkt mit privaten Behandler:innen. Eine ärztliche Verordnung ist nicht nötig. Der Zugang ist mit mittlerem Aufwand verbunden.", "Ärztliche Verordnung oder Rezept erforderlich: Du benötigst eine ärztliche Verordnung oder ein Rezept, um die Therapie zu erhalten. Der Zugang ist mit hohem Aufwand verbunden.", "Nur im Rahmen einer Studie möglich: Du kannst die Behandlung nur erhalten, wenn du zur Teilnahme an einer entsprechenden Studie zugelassen wirst. Der Zugang ist mit sehr hohem Aufwand verbunden."], "closing": "Klicke in der Abbildung auf den Zugangsweg, der deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, einen passenden Weg zur Therapie zu finden."},
        'Hier berichtet die Community über ihre Zugangswege zur Therapie: durch Selbstmanagement, frei erhältlich oder über private Behandler:innen, mit ärztlicher Verordnung beziehungsweise Rezept oder im Rahmen einer Studie. Die Anteile zeigen die berichteten Zugangswege. Mehrere vertretene Wege können auf unterschiedliche Anwendungen oder Rahmenbedingungen hinweisen. Eine Nennung sagt noch nichts über aktuelle Verfügbarkeit, Wartezeit oder Kostenübernahme aus.'
      ],
      unit_cost: [
        {"intro": "Hier erfasst die Community, was du pro Therapieeinheit selbst bezahlt hast – zum Beispiel pro Anwendung, Behandlung, Packung oder Ampulle. Ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Falls sich die Kosten nicht pro Einheit angeben lassen, wähle die Option Nicht anwendbar und trage stattdessen die Gesamtkosten ein.", "options": ["Nicht anwendbar: Eine Kostenangabe pro Einheit passt nicht zu dieser Therapie.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Betrag pro Einheit. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die eigenen Kosten besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Die Verteilung zeigt den selbst bezahlten Betrag pro Therapieeinheit nach Abzug der Kostenübernahme, etwa pro Anwendung, Packung oder Ampulle. Prüfe zuerst das ausgewählte Krankenversicherungssystem und die Versicherungsart: Die Anzeige bezieht sich auf diesen Kontext. Kostenlos bedeutet, dass keine Kosten anfielen; Komplett übernommen, dass die Krankenkasse die Kosten vollständig getragen hat. Nicht anwendbar ist keine Kostenangabe von null Euro. Die Betragsstufen sind ungefähre Angaben; bei unterschiedlich großen Einheiten sind sie nur eingeschränkt vergleichbar.'
      ],
      total_cost: [
        {"intro": "Hier erfasst die Community, was du bisher insgesamt selbst für die Therapie bezahlt hast. Zähle alle bisherigen Anwendungen und Ausgaben zusammen und ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Ist die Therapie noch nicht abgeschlossen, schätze die Gesamtkosten. Bei einer fortlaufenden Therapie kannst du die Option Nicht anwendbar wählen und stattdessen die Kosten pro Einheit angeben.", "options": ["Nicht anwendbar: Eine Angabe zu Gesamtkosten lässt sich auf diese Therapie nicht anwenden.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Gesamtbetrag. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du anderen, die Kosten eines Therapieverlaufs besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Hier siehst du, welche selbst getragenen Gesamtkosten für den Therapieverlauf die Community berichtet, nach Abzug einer Kostenübernahme. Bei noch laufenden Behandlungen können die Angaben geschätzt sein. Prüfe das ausgewählte Krankenversicherungssystem und die Versicherungsart und unterscheide Kostenlos, Komplett übernommen und Nicht anwendbar. Die Betragsstufen sind keine Preisangebote. Unterschiedliche Behandlungsdauern und Anwendungszahlen können zu unterschiedlichen Gesamtkosten führen; lies diese deshalb zusammen mit den Kosten pro Einheit.'
      ]
    };
    const encouragement = {
      symptome: ['Bei welchen Symptomen hat dir die Therapie geholfen? Wähle die passenden Symptome aus oder suche weitere. Du entscheidest, was du beitragen möchtest.', 'Bei welchen deiner Symptome könnte die Therapie helfen? Um dir hierfür eine Einschätzungsmöglichkeit zu geben, trägt die Community Erfahrungen zur Linderung einzelner Beschwerden zusammen.'],
      wirkung: ['Was du erlebt hast, kann anderen helfen, ihre Fragen an die Therapie zu finden. Jede Angabe zählt.',
        'Kann dir diese Therapie helfen – und wenn ja, wie sehr? Hier teilt die Community ihre Erfahrungen. Sie zeigen dir, ob und in welchem Maß andere von der Therapie profitiert haben. Das kann dir eine erste Orientierung geben, was du selbst erwarten könntest – auch wenn die Wirkung von Person zu Person unterschiedlich ist.'],
      termin: ['Deine Erfahrung mit Durchführung und Belastung hilft anderen, ihren Alltag rund um die Therapie zu planen.',
        'Ist die Behandlung mit deinem aktuellen Gesundheitszustand überhaupt machbar? Um dir hierfür eine Einschätzungsmöglichkeit zu geben, trägt die Community Erfahrungen zur Durchführung zusammen. Das kann dir eine erste Orientierung geben, was du selbst erwarten könntest – auch wenn die Wirkung von Person zu Person unterschiedlich ist.'],
      zugang: ['Dein Weg zur Therapie und deine ungefähren Kosten geben anderen eine Vorstellung davon, womit sie rechnen können.',
        'Wie aufwendig ist es, Zugang zur Behandlung zu bekommen, und welche Kosten kommen auf dich zu? Um dir hierfür eine Einschätzungsmöglichkeit zu geben, trägt die Community Erfahrungen zu Zugangswegen und Kosten zusammen.'],
      anreise: ['Du hast schon etwas beigetragen? Danke dafür. Hier kannst du bei Bedarf noch nach Behandler:innen schauen.',
        'Wenn du die Therapie weiter erkunden möchtest, kannst du hier nach Behandler:innen in deiner Nähe schauen.'],
      alternativen: ['Danke, dass du dir Zeit für die Community genommen hast. Hier kannst du zum Abschluss noch verwandte Behandlungen ansehen.',
        'Vielleicht findest du hier eine weitere Behandlung, über die du dich informieren möchtest. Schau dir mögliche Alternativen und verwandte Therapien an.']
    };
    let mode = '';
    let minimized = false;
    let providerCount = JSON.parse(content.querySelector('#anreise .nd-map-data').textContent).length;
    let providerContributed = false;
    let relationshipContributions = {};
    let finishedSections = {};
    let panel;
    let guide;
    let entries = [];
    let completion;
    let sharing;

    function validMode(value) {
      return choices.some(choice => choice[0] === value) ? value : '';
    }

    function preferredMode() {
      try { return validMode(localStorage.getItem(preferredModeKey)); } catch { return ''; }
    }

    function orientationIsOff() {
      if (minimized) return true;
      try { return localStorage.getItem(orientationDisabledKey) === '1'; } catch { return false; }
    }

    function treatmentState(id) {
      try {
        return JSON.parse(sessionStorage.getItem(storagePrefix + id));
      } catch { return null; }
    }

    function restore() {
      const state = treatmentState(treatmentId);
      mode = validMode(state?.mode);
      minimized = state?.minimized === true;
      providerContributed = state?.providerContributed === true;
      relationshipContributions = state?.relationshipContributions || {};
      finishedSections = state?.finishedSections || {};
    }

    function save() {
      try { sessionStorage.setItem(storagePrefix + treatmentId, JSON.stringify({mode, minimized, providerContributed, relationshipContributions, finishedSections})); } catch {}
    }

    function chooseMode(value) {
      mode = value;
      minimized = false;
      try {
        localStorage.removeItem(orientationDisabledKey);
        localStorage.setItem(preferredModeKey, mode);
      } catch {}
      save();
    }

    function inheritOrientation() {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (!document.referrer || (navigation && navigation.type !== 'navigate')) return;
      const source = new URL(document.referrer);
      if (source.origin !== location.origin || source.pathname !== location.pathname) return;
      const sourceId = source.searchParams.get('treatment_id') || source.searchParams.get('treat_id');
      if (!sourceId || sourceId === treatmentId) return;

      const sourceState = treatmentState(sourceId);
      // A link opened in a new tab can lack the source tab's session state.
      const sourceMode = validMode(sourceState?.mode) || (!sourceState ? preferredMode() : '');
      const sourceMinimized = sourceState?.minimized === true;
      if (!sourceMode && !sourceMinimized) return;
      mode = sourceMode;
      minimized = sourceMinimized;
      save();
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
      if (location.hash !== link.hash || link.getAttribute('aria-current') !== 'page') link.click();
      const nav = link.closest('.side-nav');
      const style = getComputedStyle(nav);
      const navOffset = style.position === 'sticky' ? (parseFloat(style.top) || 0) + nav.offsetHeight + 8 : 0;
      scrollTo(guide || document.getElementById(link.dataset.view), navOffset);
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
      url.searchParams.set('treatment_id', treatment.dataset.treatmentId);
      url.searchParams.set('anliegen', 'erfahrung');
      url.hash = 'ueberblick';
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
      async function copyLink() {
        try {
          await navigator.clipboard.writeText(url.href);
          status.textContent = 'Link kopiert.';
        } catch {
          fallback.hidden = false;
          fallback.select();
          status.textContent = 'Du kannst den markierten Link kopieren.';
        }
      }
      const share = button('Teilen', async () => {
        if (navigator.share) {
          try { await navigator.share({title: document.title, text, url: url.href}); }
          catch (error) { if (error.name !== 'AbortError') await copyLink(); }
        } else await copyLink();
      });
      const shareIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      shareIcon.setAttribute('viewBox', '0 0 24 24');
      shareIcon.setAttribute('width', '19');
      shareIcon.setAttribute('height', '19');
      shareIcon.setAttribute('fill', 'none');
      shareIcon.setAttribute('stroke', 'currentColor');
      shareIcon.setAttribute('stroke-width', '1.6');
      shareIcon.setAttribute('aria-hidden', 'true');
      shareIcon.innerHTML = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/>';
      share.prepend(shareIcon);
      actions.append(share);
      block.append(message, document.createTextNode(' '), actions, fallback, status);
      return {block, message, alternatives, providers};
    }

    function refreshTopics() {
      refreshEntryAvailability();
      entries.forEach(({card, disclosure, example}) => {
        const countLabel = disclosure?.querySelector('[data-guide-answer-count]');
        if (countLabel) {
          const count = cardCount(card);
          const label = card.matches('.ux-symptom-help')
            ? '(bis zu ' + count + ' ' + (count === 1 ? 'Angabe' : 'Angaben') + ' je Symptom)'
            : '(' + count + ' ' + (count === 1 ? 'Angabe' : 'Angaben') + ')';
          updateText(countLabel, label);
        }
        if (!example) return;
        const demo = window.LCNDummy?.get();
        const count = Number(card.dataset.displayAnswerCount);
        const symptoms = JSON.parse(card.dataset.guideSymptoms || '[]');
        const prefix = demo ? 'Mit Beispieldaten: ' : '';
        const exampleText = symptoms.length
          ? prefix + 'Zu den Symptomen mit den meisten Nennungen gehören ' + symptoms
            .map(({name, count}) => name + ' (' + count + (count === 1 ? ' Stimme)' : ' Stimmen)')).join(' und ') + '.'
          : count ? ''
            : 'Zu diesem Thema werden aktuell keine Angaben angezeigt. Daraus lässt sich keine Bewertung ableiten.';
        updateText(example, exampleText);
        example.hidden = !exampleText;
      });
      updateProgress();
      if (sharing) {
        const count = experienceCount(panel);
        sharing.block.hidden = false;
        const message = sharing.providers
          ? 'Kennst du jemanden, der diese Therapie schon bei einer Behandler:in gemacht hat? Leite diese Seite weiter und lade die Person ein, Angaben zu bestätigen oder zu korrigieren, fehlende Behandler:innen zu ergänzen und ihre Erfahrung im jeweiligen Praxiseintrag zu teilen.'
          : sharing.alternatives
          ? 'Kennst du jemanden, der diese Therapie oder eine der Alternativen schon ausprobiert hat? Leite diese Seite weiter und lade die Person ein, Einträge zu bestätigen, ihnen zu widersprechen oder fehlendes Wissen zu ergänzen.'
          : count === 0
          ? 'Kennst du jemanden, der diese Therapie ausprobiert hat? Lade die Person ein, ihre Erfahrung zu teilen. Das hilft dir und anderen bei der Orientierung.'
          : 'Kennst du jemanden, der diese Therapie ausprobiert hat? Jede weitere Erfahrung hilft, die Therapie besser einzuschätzen.';
        // The invitation contains formatting; rebuild it only when its wording changes.
        if (sharing.message.dataset.message !== message) {
          sharing.message.dataset.message = message;
          const messageParts = message.split('? ');
          if (messageParts.length > 1) {
            sharing.message.replaceChildren(make('strong', messageParts.shift() + '?'), make('span', messageParts.join('? ')));
          } else updateText(sharing.message, message);
        }
      }
      content.querySelectorAll('.therapy-guide-data-status').forEach(node => {
        const count = experienceCount(node.closest('.nd-panel'));
        node.dataset.level = count >= 10 ? 'full' : count ? 'few' : 'none';
        node.hidden = count < 10;
        updateText(node, count < 10 ? '' : 'Erfahrungen vorhanden.');
      });
      entries.forEach(({card, disclosure}) => {
        if (disclosure) disclosure.hidden = false;
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
        updateText(completion, count === entries.length
          ? 'Danke! Deine Angaben sind gespeichert.' : count + ' von ' + entries.length + ' Themen ausgefüllt');
        completion.classList.toggle('is-complete', count === entries.length);
      }
    }

    function disableOrientation(dialog, remember = true) {
      dialog?.close();
      minimized = true;
      if (remember) {
        try {
          localStorage.setItem(orientationDisabledKey, '1');
          minimized = false;
        } catch {}
      }
      save();
      paint(true);
    }

    function refreshEntryAvailability(scope = document) {
      const loaded = !!content.querySelector('[data-question][data-real-answer-count]');
      const count = experienceCount();
      scope.querySelectorAll('[data-therapy-experience-availability]').forEach(node => {
        node.hidden = !loaded;
        updateText(node, !loaded ? '' : count === 0 ? 'Keine Angaben vorhanden' : count < 10 ? 'Bisher wenige Angaben' : 'Zahlreiche Angaben vorhanden');
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

    function classificationFields(section) {
      return [...section.querySelectorAll('.ux-stage-column')].map(column => ({
        column,
        label: column.getAttribute('aria-label'),
        nodes: [...column.querySelectorAll('.ux-stage-node')].filter(node => !node.closest('[hidden]'))
      }));
    }

    function fieldReference(field) {
      return make('u', field.label);
    }

    const relationshipTypeLabels = {
      has_trade: 'Handelsnamen',
      has_form: 'Applikationen',
      has_variant: 'Stoffvarianten',
      has_detail: 'konkrete Anwendungen'
    };

    function classificationContents(nodes) {
      return [...new Set(nodes.map(node => {
        const kind = node.closest('[data-relationship-kind]')?.dataset.relationshipKind;
        return relationshipTypeLabels[kind] || 'weitere zugeordnete Einträge';
      }))];
    }

    function renderClassificationContribution(disclosure, target) {
      const fields = classificationFields(target);
      const current = target.querySelector('.ux-stage-node[aria-current="page"]');
      const currentIndex = fields.findIndex(({column}) => column.contains(current));
      const classification = current?.querySelector('[data-stage-classification]');
      const previous = disclosure.querySelector(':scope > ul');
      const list = make('ul', '', 'therapy-guide-options');
      const agree = () => make('strong', 'Zustimmen (✓)');
      const disagree = () => make('strong', 'Widersprechen (×)');
      const related = {
        Gruppe: 'Die zugeordneten Gruppen',
        Gruppen: 'Die zugeordneten Gruppen',
        Wirkstoffgruppen: 'Die zugeordneten Wirkstoffgruppen',
        Medikamentengruppe: 'Die zugeordnete Medikamentengruppe',
        'Übergeordnete Substanz': 'Die übergeordnete Substanz',
        Verfahren: 'Das zugehörige Verfahren',
        Substanz: 'Die zugehörige Substanz',
        Wirkstoffe: 'Die zugehörigen Wirkstoffe',
        'Wirkstoffe und Substanzen': 'Den zugehörigen Wirkstoff oder die Substanz',
        'Wirkstoffe und Substanzen (Kombination)': 'Die zugehörige Kombination',
        Anwendung: 'Die zugeordneten Anwendungen',
        Handelsnamen: 'Die zugehörigen Handelsnamen',
        'Weitere Anwendungsformen': 'Weitere Anwendungsformen'
      };

      fields.forEach(({column, label, nodes}, index) => {
        const additions = [...column.querySelectorAll('[data-treatment-relation-add]')].filter(button => !button.closest('[hidden]'));
        const hint = column.querySelector('.ux-stage-add-hint')?.textContent.trim();
        const isCurrent = index === currentIndex;
        const item = make('div', '', 'therapy-guide-classification-content');
        if (isCurrent && classification) {
          const field = current.closest('.ux-stage-block')?.dataset.relationshipLabel || label;
          const summary = make('p', 'Die Community ordnet diese Therapie bei ');
          summary.append(make('strong', field));
          if (field !== label) summary.append(' im Bereich ', make('strong', label));
          summary.append(' ein.');
          if (classification.dataset.classificationCategory) {
            summary.append(' Mit ', agree(), ' bestätigst du die Einordnung.');
          }
          summary.append(' Über ', disagree(), ' kannst du eine andere Einordnung vorschlagen.');
          item.append(summary);

          const neighbors = make('p');
          for (const [offset, direction] of [[-1, 'links'], [1, 'rechts']]) {
            const neighbor = fields[index + offset];
            if (!neighbor?.nodes.length) continue;
            if (neighbors.hasChildNodes()) neighbors.append(' ');
            if (neighbor.label === 'Anwendungsformen') {
              const contents = new Intl.ListFormat('de').format(classificationContents(neighbor.nodes));
              neighbors.append('Im Feld ', make('u', direction), ' unter ', fieldReference(neighbor),
                ' findest du ', contents, ' zu dieser Therapie.');
              continue;
            }
            if (index === 0) {
              neighbors.append('Die ', fieldReference(neighbor), ', die sie dieser Gruppe zuordnet,');
            } else {
              neighbors.append(related[neighbor.label] || 'Die zugehörigen Einträge');
            }
            neighbors.append(' findest du im Feld ', make('u', direction));
            if (index === 0) neighbors.append(' daneben');
            else neighbors.append(' unter ', fieldReference(neighbor));
            neighbors.append('.');
          }
          if (neighbors.hasChildNodes()) item.append(neighbors);
        }

        const actions = make('p');
        const addLabels = [...new Set(additions.map(button => button.textContent.replace(/^[＋+]\s*/, '').trim()).filter(Boolean))];
        const groupMembers = currentIndex === 0 && index === 1;
        const procedureMembers = groupMembers && label === 'Verfahren';
        if (addLabels.length) {
          actions.append('Über ');
          addLabels.forEach((name, position) => {
            if (position) actions.append(position === addLabels.length - 1 ? ' oder ' : ', ');
            actions.append(make('strong', '„' + name.replace(/[„“]/g, '') + '“'));
          });
          if (procedureMembers) actions.append(' kannst du Verfahren für diese Gruppe ergänzen.');
          else actions.append(groupMembers ? ' kannst du die Gruppe ergänzen.' : ' kannst du Zuordnungen ergänzen.');
        }
        const linked = nodes.filter(node => node !== current);
        const voteCount = linked.filter(node => node.querySelector('[data-treatment-relation-feedback]')).length;
        if (voteCount) {
          if (actions.hasChildNodes()) actions.append(' ');
          if (procedureMembers) {
            const perEntry = voteCount < linked.length ? 'Bei Einträgen mit Abstimmungsbuttons kannst du '
              : 'Beim jeweiligen Eintrag kannst du ';
            actions.append('Gehört das Verfahren aus deiner Sicht in diese Gruppe? ', perEntry, agree(), ' oder ', disagree(), ' wählen.');
          } else {
            const perEntry = voteCount < linked.length ? 'Bei Einträgen mit Abstimmungsbuttons kannst du mit '
              : 'Bei jedem vorhandenen Eintrag kannst du mit ';
            actions.append(perEntry, agree(), groupMembers ? ' die Zuordnung zur Gruppe bestätigen oder ihr mit '
              : ' die angezeigte Zuordnung bestätigen oder ihr mit ', disagree(), ' widersprechen.');
          }
        }
        if (linked.some(node => node.querySelector('[data-clarify-parent]'))) {
          if (actions.hasChildNodes()) actions.append(' ');
          actions.append('Über ', make('strong', '„Zuordnung offen · Genauer einordnen“'), ' kannst du eine Zuordnung vorschlagen.');
        }
        if (!isCurrent && !actions.hasChildNodes() && linked.length && hint) actions.textContent = hint;
        if (actions.hasChildNodes()) item.append(actions);
        if (!item.hasChildNodes()) return;

        const topic = make('details', '', 'therapy-guide-classification-topic');
        topic.dataset.guideStage = index;
        topic.open = previous?.querySelector(`[data-guide-stage="${index}"]`)?.open || false;
        const heading = make('summary', label);
        if (isCurrent) heading.append(make('span', ' (hier eingeordnet)', 'therapy-guide-current-level'));
        topic.append(heading, item);
        const row = make('li');
        row.append(topic);
        list.append(row);
      });
      if (!previous) disclosure.append(list);
      else if (!previous.isEqualNode(list)) previous.replaceWith(list);
    }

    function refreshClassificationGuide() {
      const entry = entries.find(({card}) => card.matches('[data-relationship-stages]'));
      if (entry) renderClassificationGuide(entry.disclosure, entry.card);
    }

    function renderClassificationGuide(disclosure, section) {
      if (mode === 'review') {
        renderClassificationContribution(disclosure, section);
        return;
      }
      const previous = [...disclosure.querySelectorAll(':scope > p')];
      const paragraphs = classificationParagraphs(section);
      if (previous.length === paragraphs.length && previous.every((paragraph, index) => paragraph.isEqualNode(paragraphs[index]))) return;
      previous.forEach(paragraph => paragraph.remove());
      disclosure.append(...paragraphs);
    }

    function classificationIntro(current, fields, index) {
      const label = fields[index].label;
      const block = current.closest('.ux-stage-block')?.dataset.relationshipLabel;
      const paragraph = make('p', 'Die Community ordnet diese Therapie bei ');
      paragraph.append(make('strong', label));
      if (block && block !== label) paragraph.append(' unter ', make('strong', block));
      paragraph.append(' ein.');
      return paragraph;
    }

    function appendClassificationFields(paragraph, fields, index) {
      const [left, middle, right] = fields;
      const leftDirection = index === 2 ? 'ganz links' : 'links';
      const rightDirection = index === 0 ? 'ganz rechts' : 'rechts';
      const filledFields = [];
      const emptyFields = [];
      const addEmptyField = (location, missing = ['keine Einträge']) => {
        emptyFields.push(emptyFields.length
          ? ['Auch im ', ...location, ' sind noch ', ...missing, ' hinterlegt.']
          : ['Leider sind noch ', ...missing, ' im ', ...location, ' hinterlegt.']);
      };

      if (index !== 0) {
        const isSubstance = left.label === 'Übergeordnete Substanz';
        if (!left.nodes.length) {
          const missing = isSubstance ? 'Substanz' : 'Gruppe';
          emptyFields.push([`Leider ist im Feld ${leftDirection} noch keine übergeordnete `, make('u', missing), ' hinterlegt.']);
        } else {
          const purpose = isSubstance
            ? 'Wenn du mehr über den zugrunde liegenden Stoff erfahren möchtest, schau '
            : 'Wenn du breiter nach verwandten Therapien suchen möchtest, schau ';
          filledFields.push([`${purpose}${leftDirection} ins Feld `, fieldReference(left), '.']);
        }
      }
      if (index !== 1) {
        const name = fieldReference(middle);
        if (!middle.nodes.length) {
          addEmptyField(['mittleren Feld unter ', name]);
        } else if (index === 0) {
          filledFields.push(['Wenn du deine Behandlung konkretisieren möchtest, schau im mittleren Feld unter ', name, ' nach.']);
        } else if (middle.label === 'Wirkstoffe und Substanzen') {
          filledFields.push(['Den zugehörigen ', make('u', 'Wirkstoff'), ' bzw. die ', make('u', 'Substanz'), ' findest du im mittleren Feld.']);
        } else {
          filledFields.push(['Im mittleren Feld findest du die zugehörigen Einträge unter ', name, '.']);
        }
      }
      if (index !== 2) {
        const field = `Feld ${rightDirection}`;
        const name = fieldReference(right);
        const location = [field, ' unter ', name];
        if (!right.nodes.length) {
          if (index === 0 && right.label === 'Anwendung') addEmptyField([field], ['keine Einträge zur ', name]);
          else addEmptyField(location);
        } else {
          const destination = right.label === 'Anwendung' ? [field] : location;
          const description = new Intl.ListFormat('de').formatToParts(classificationContents(right.nodes)).flatMap(({type, value}) => {
            if (right.label === 'Anwendung' && type === 'element' && value === relationshipTypeLabels.has_detail) {
              return ['konkrete ', make('u', 'Anwendungen')];
            }
            return [value];
          });
          filledFields.push(['Im ', ...destination, ' findest du ', ...description, '.']);
        }
      }

      for (const sentence of [...filledFields, ...emptyFields]) {
        if (paragraph.hasChildNodes()) paragraph.append(' ');
        paragraph.append(...sentence);
      }
    }

    function classificationParagraphs(section) {
      const fields = classificationFields(section);
      const current = section.querySelector('.ux-stage-node[aria-current="page"]');
      const index = fields.findIndex(({column}) => column.contains(current));
      if (index < 0) return [make('p', 'Hier siehst du, wie die Community den Eintrag einordnet.')];
      const paragraph = classificationIntro(current, fields, index);
      appendClassificationFields(paragraph, fields, index);
      const paragraphs = [paragraph];

      if (index === 1) {
        const combination = section.closest('.nd-panel')?.querySelector('[data-combination-section][data-is-combination="1"]');
        const parts = combination?.querySelector('[data-combination-tree]:has([data-combination-parent].is-current) [data-combination-part]');
        const heading = combination?.querySelector('h3')?.firstChild?.textContent.trim();
        if (parts && !parts.closest('[hidden]') && heading) {
          const components = make('p', 'Unter ');
          components.append(make('u', heading), ' findest du die einzelnen Bestandteile dieser Therapie.');
          paragraphs.push(components);
        }
      }
      return paragraphs;
    }

    function paint(force = false) {
      const active = content.querySelector('.nd-panel:not([hidden])');
      if (!active || (!force && panel === active)) return;
      guide?.remove();
      const collapsed = orientationIsOff();
      content.querySelectorAll('[data-question], .ux-symptom-help').forEach(card => {
        card.hidden = !collapsed && mode === 'explore' && cardCount(card) === 0;
      });
      panel = active;
      entries = [];
      completion = sharing = null;

      updateProgress();
      if (collapsed) {
        guide = make('section', '', 'therapy-guide-collapsed');
        guide.setAttribute('aria-label', 'Orientierung ausgeschaltet');
        guide.append(button('Orientierung zurückholen', enableOrientation));
        panel.prepend(guide);
        return;
      }
      if (panel.id === 'dashboard' || (panel.id !== 'ueberblick' && !mode)) {
        guide = null;
        if (panel.id !== 'dashboard') showOrientation();
        return;
      }

      guide = make('section');
      const actions = make('div', '', 'experience-guide-actions');
      const close = button('Ich brauche keine Orientierung', () => disableOrientation());
      close.classList.add('therapy-guide-dismiss');


      if (panel.id === 'ueberblick') {
        const activeChoice = choices.find(choice => choice[0] === mode);
        if (activeChoice) {
          actions.append(button(activeChoice[4] + ' →', () => openView(startView(activeChoice)), true),
            button('Anliegen ändern', showOrientation), close);
          guide.classList.add('experience-guide-banner');
          illustrated(guide, '', make('h2', 'Orientierung fortsetzen'), make('p', activeChoice[1]), actions);
          guide.querySelector('.experience-guide-eyebrow')?.remove();
          welcome.append(guide);
          return;
        }
        actions.classList.add('therapy-guide-choices');
        addChoices(actions);
        guide.classList.add('experience-guide-banner', 'therapy-guide-personal');
        close.textContent = 'Ohne Begleitung weiter';
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
      if (!review && panel.querySelector('[data-question], .ux-symptom-help')) {
        body.push(make('p', '', 'therapy-guide-data-status'));
      }
      const feedbackNote = text => {
        const note = make('aside', '', 'therapy-guide-annotation');
        note.setAttribute('aria-label', 'Anmerkung zu den Rückmeldungen');
        const description = make('p');
        text.split(/([✓×])/).forEach(part => {
          description.append(part === '✓' || part === '×'
            ? make('span', part, 'therapy-guide-feedback-symbol')
            : document.createTextNode(part));
        });
        note.append(make('strong', 'Anmerkung'), description);
        return note;
      };
      const cards = panel.querySelectorAll('[data-question], .ux-symptom-help');
      if (cards.length) {

        if (!review) {
          sharing = shareTherapy();
        }
      } else if (panel.id === 'anreise' && !review) {
        body[0].textContent = 'Wo findest du Behandler:innen für diese Therapie? Die Community sammelt Einträge, damit du eine Auswahl hast und sehen kannst, wer die Behandlung in deiner Nähe anbietet. So kannst du Behandler:innen mit möglichst wenig Anreiseaufwand finden.';
        const help = [
          ['Anreiseaufwand', 'Die hervorgehobene Stufe ordnet die nächstgelegene behandelnde Person im aktuellen Filter nach Entfernung ein. Die Kilometerangabe ist die Luftlinie; die Zeitangaben sind grobe Orientierung und keine berechnete Reiseroute. Online-Behandlung bedeutet hier, dass Erst- und Folgetermin online möglich sind.'],
          ['Karte', 'Die Community sammelt Behandler:innen, die diese Therapie anbieten, und ihre Standorte. Mithilfe der Karte kannst du Behandler:innen für diese Therapie in deiner Nähe finden. Gib dazu eine Adresse, Postleitzahl oder einen Ort ein und übernimm den Standort.'],
          ['Einträge ansehen und vergleichen', 'Nutze die Übersicht der Behandler:innen, die diese Therapie anbieten, um sie untereinander zu vergleichen und die für dich passendste Anlaufstelle zu finden. Öffne einen Eintrag, um mehr über das Behandlungsangebot zu erfahren. Bei Bedarf kannst du zwischen Kachel- und Tabellenansicht wechseln.'],
        ];
        help.forEach(([title, text]) => {
          const disclosure = make('details');
          const description = make('p', text);
          if (title === 'Karte') {
            const [before, after] = text.split('für diese Therapie');
            description.replaceChildren(document.createTextNode(before), make('u', 'für diese Therapie'), document.createTextNode(after));
          }
          disclosure.append(make('summary', title), description);
          body.push(disclosure);
        });
        body.push(feedbackNote('Die Zahlen neben Zustimmen (✓) und Widersprechen (×) zeigen, wie die Community die Angabe einschätzt, dass die jeweilige Behandler:in diese Therapie tatsächlich anbietet. Sie helfen dir einzuordnen, wie gesichert diese Information ist. Sie bewerten weder die Qualität der Behandlung noch ihre Wirksamkeit.'));
        sharing = shareTherapy(false, true);
        body.push(sharing.block);
      }
      cards.forEach(card => {
        const topic = topics[card.dataset.question || 'symptoms'];
        if (!topic) return;
        const readingTopics = {
          effect: {
            intro: 'Unter Community-Bewertung fasst die Community zusammen, wie sich der Gesundheitszustand bei Anwendung der ausgewählten Therapie verändert hat. So siehst du, welchen Effekt die Behandlung aus Sicht der Community hatte. Die Antworten werden in vier Kategorien erfasst:',
            options: [
              'Verschlechterung: Die Behandlung hatte einen negativen Effekt auf die Gesundheit.',
              'Neutral: Der Gesamtzustand ist gleich geblieben.',
              'Verbesserung: Der Gesamtzustand hat sich spürbar verbessert.',
              'Heilung: Die Therapie hat nach eigener Einschätzung zu einer Genesung geführt.'
            ],
            closing: 'Die Auswertung beschreibt die Erfahrungen der Teilnehmenden und berechnet nicht deine persönliche Erfolgschance'
          },
          gamechanger: {
            intro: 'Als Gamechanger gilt eine Therapie, die den Genesungsprozess entscheidend vorangetrieben hat. Hier siehst du, für wie viele die ausgewählte Therapie diese Bedeutung hatte. Die Antworten werden in zwei Kategorien erfasst:',
            options: [
              'Ja: Die ausgewählte Therapie hat den Genesungsprozess entscheidend vorangetrieben.',
              'Nein: Die ausgewählte Therapie hat den Genesungsprozess leider nicht entscheidend vorangetrieben.'
            ],
            closing: 'Ein Nein bedeutet nicht automatisch, dass sie gar nicht geholfen hat; ein Ja bedeutet nicht automatisch Heilung. Lies diese Angabe deshalb zusammen mit der Community-Bewertung und beachte die Anzahl der Angaben.'
          }
        };
        Object.assign(readingTopics, {
          setting: {
            intro: 'Die Community erfasst, wo und in welchem Rahmen sie die ausgewählte Therapie angewendet haben. Diese Angabe hilft dir einzuschätzen, welcher Aufwand damit für dich verbunden wäre und ob der Rahmen zu dir passt. Die Antworten werden in vier Kategorien erfasst:',
            options: [
              'Selbstständig zu Hause: Die Therapie wird eigenständig zu Hause angewendet, ohne zusätzlichen Reiseaufwand oder Unterstützung durch Fachpersonal.',
              'Hausbesuch: Die Behandlung findet mit Unterstützung durch Fachpersonal zu Hause statt.',
              'Ambulant: Die Behandlung findet bei einzelnen Terminen vor Ort statt, zum Beispiel in einer Praxis.',
              'Stationär: Die Behandlung erfordert einen längeren Aufenthalt in einer Einrichtung.'
            ],
            closing: 'Die mögliche Durchführung kann je nach Anwendung variieren. Berücksichtige auch das Verschlechterungsrisiko und den Anreiseaufwand.'
          },
          pem: {
            intro: 'Bei der Entscheidung für eine Therapie ist es hilfreich, das Crash-Risiko einschätzen zu können. Hier sammelt die Community ihre Einschätzungen dazu, wie hoch das Risiko ist, dass die ausgewählte Therapie einen Crash auslöst und damit zu einer Zustandsverschlechterung führt. Diese Einschätzungen können dir als Orientierung dienen. Die Antworten werden in vier Kategorien erfasst:',
            options: [
              'Keines: Aus eigener Erfahrung schätzt die Community ein, dass das Risiko einer Zustandsverschlechterung nicht vorhanden ist.',
              'Niedrig: Aus eigener Erfahrung schätzt die Community ein, dass das Risiko einer Zustandsverschlechterung gering ist.',
              'Mittel: Aus eigener Erfahrung schätzt die Community ein, dass das Risiko einer Zustandsverschlechterung mittel ist.',
              'Hoch: Aus eigener Erfahrung schätzt die Community ein, dass das Risiko einer Zustandsverschlechterung hoch ist.'
            ],
            closing: 'Die Anteile beschreiben Risikoeinschätzungen, nicht die Häufigkeit tatsächlich aufgetretener Verschlechterungen. Die Antwort Keines ist keine Zusicherung für deine eigene Anwendung.'
          },
          access: {
            intro: 'Die Zugänglichkeit beschreibt, wie aufwendig es ist, Zugang zur ausgewählten Therapie zu erhalten. Hier siehst du, welche Wege andere genutzt haben. Vier Zugangswege im Vergleich:',
            options: [
              'Selbstmanagement / eigenständig umsetzbar: Du kannst die Maßnahme eigenständig umsetzen und benötigst weder Behandler:innen noch eine ärztliche Verordnung. Der Zugang ist mit geringem Aufwand verbunden.',
              'Frei erhältlich / private Behandler:innen: Du kannst das Mittel frei kaufen oder die Therapie direkt mit privaten Behandler:innen vereinbaren. Eine ärztliche Verordnung ist nicht nötig. Der Zugang ist mit mittlerem Aufwand verbunden.',
              'Ärztliche Verordnung oder Rezept erforderlich: Du benötigst eine ärztliche Verordnung oder ein Rezept, um die Therapie zu erhalten. Der Zugang ist mit hohem Aufwand verbunden.',
              'Nur im Rahmen einer Studie möglich: Du kannst die Behandlung nur erhalten, wenn du zur Teilnahme an einer entsprechenden Studie zugelassen wirst. Der Zugang ist mit sehr hohem Aufwand verbunden.'
            ],
            closing: 'Ein berichteter Zugangsweg bestätigt weder die aktuelle Verfügbarkeit noch eine Kostenübernahme.'
          },
          symptoms: {
            intro: 'Hier sammelt die Community, welche Symptome durch die ausgewählte Therapie gelindert wurden. So kannst du sehen, für welche deiner Beschwerden Erfahrungen vorliegen. Die Liste liest du so:',
            options: [
              'Symptome: Die aufgelisteten Beschwerden zeigen, zu welchen Symptomen Angaben gesammelt werden.',
              'Nennungen: Die Zahl bei einem Symptom zeigt, wie viele Angaben zu einer Linderung vorliegen. Eine Person kann mehrere Symptome angeben.',
              'Keine Nennungen: Bisher ist keine entsprechende Linderung eingetragen. Daraus lässt sich nicht ableiten, dass die Therapie bei diesem Symptom nicht hilft.'
            ],
            closing: 'Nennungen sind keine Erfolgsquote: Angaben zu ausgebliebener Linderung werden hier nicht erfasst. Mehrfachnennungen lassen sich nicht zu einer Gesamtzahl behandelter Personen addieren.'
          }
        });
        for (const key of ['unit_cost', 'total_cost']) {
          const unit = key === 'unit_cost';
          readingTopics[key] = {
            intro: unit
              ? 'Hier erfasst die Community, welche selbst getragenen Kosten pro Therapieeinheit anfallen – zum Beispiel pro Anwendung, Behandlung, Packung oder Ampulle. Beträge, die die Krankenkasse übernommen hat, sind bereits abgezogen. Die Angaben werden so eingeordnet:'
              : 'Hier erfasst die Community, welche selbst getragenen Gesamtkosten bisher für die Therapie angefallen sind. Dazu zählen die bisherigen Anwendungen und Ausgaben abzüglich einer Kostenübernahme. Ist die Behandlung noch nicht abgeschlossen, können die Gesamtkosten geschätzt sein. Die Angaben werden so eingeordnet:',
            options: [
              'Nicht anwendbar: Eine Kostenangabe ' + (unit ? 'pro Einheit' : 'zum gesamten Therapieverlauf') + ' passt nicht zu dieser Behandlung. Das bedeutet nicht, dass die Therapie kostenlos ist.',
              'Kostenlos: Für die Therapie sind keine Kosten angefallen.',
              'Komplett übernommen: Die Kosten wurden vollständig von der Krankenkasse übernommen.',
              'Kostenspannen: Die Community hat den ungefähr passenden ' + (unit ? 'Betrag pro Einheit' : 'Gesamtbetrag') + ' angegeben. Die Stufen zeigen eine grobe Einordnung der selbst bezahlten Kosten.'
            ],
            insuranceOptions: topic[0].insuranceOptions,
            optionsIntro: 'Die Kostenangaben unterscheiden folgende Antworten:',
            closing: unit
              ? 'Vergleiche nur passende Einheiten: Eine Packung entspricht nicht unbedingt einer Anwendung. Berücksichtige zusätzlich die Gesamtkosten.'
              : 'Behandlungsdauer und Anwendungszahl beeinflussen die Gesamtkosten. Die Angaben sind keine Preisangebote oder Zusagen einer Kostenübernahme.'
          };
        }
        const instructions = review ? topic[0] : readingTopics[card.dataset.question || 'symptoms'];
        const title = card.querySelector('h3').firstChild.textContent.trim();
        const disclosure = make('details');
        disclosure.append(make('summary', title));
        if (!review) {
          const countLabel = make('span', '', 'therapy-guide-answer-count');
          countLabel.dataset.guideAnswerCount = '';
          disclosure.querySelector('summary').append(document.createTextNode(' '), countLabel);
        }
        if (instructions) {
          const list = make('ul', '', 'therapy-guide-options');
          if (card.dataset.question === 'access') list.classList.add('therapy-guide-access-options');
          instructions.options.forEach(option => {
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
          disclosure.append(make('p', instructions.intro));
          if (instructions.insuranceOptions) {
            const insuranceList = make('ul', '', 'therapy-guide-options');
            insuranceList.dataset.guideInsuranceList = '';
            const insuranceIntro = make('p');insuranceIntro.dataset.guideInsuranceIntro = '';
            disclosure.append(insuranceIntro, insuranceList, make('p', instructions.optionsIntro));
            refreshInsuranceHelp(disclosure);
            if (!review) insuranceIntro.textContent = 'Wähle das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Die Auswertung zeigt die Angaben für diesen Versicherungskontext.';
          }
          disclosure.append(list, make('p', instructions.closing));
        } else disclosure.append(make('p', topic[1]));
        const example = review ? null : make('p');
        if (example) disclosure.append(example);
        body.push(disclosure);
        entries.push({card, example, disclosure});
      });
      if(panel.id === 'alternativen' || (review && panel.id === 'anreise')) {
        const readingHelp = {
          alternative: 'Hier sammelt die Community frei vorgeschlagene Therapiealternativen. Die Einträge beruhen auf diesen Vorschlägen; ein fachlicher Zusammenhang wird damit nicht vorausgesetzt. Scrolle seitlich und öffne die Namen für Details.',
          combination: 'Hier sammelt die Community Kombinationen aus Therapien oder Wirkstoffen, deren Zusammenspiel einen zusätzlichen oder anderen Effekt erzielen soll. Du siehst, welche Bestandteile jeweils zusammengehören und welche Kombinationen die Community vorschlägt.'
        };
        const prompts = panel.id === 'anreise' ? [
          ['provider', '.nd-provider-map', 'Behandler:innen und Erfahrungen', 'Hier erfasst die Community, wo man Hilfe erhalten und die ausgewählte Therapie in Anspruch nehmen kann. Wähle einen Ort aus, um auf der Karte Behandler:innen in der Nähe zu finden. Die Liste zeigt dir außerdem Alternativen, wenn du mit deiner bisherigen Behandler:in nicht zufrieden bist und die Therapie weiterführen möchtest. Deine Erfahrung mit der Behandlung kannst du im jeweiligen Eintrag teilen.']
        ] : [
          ['alternative', '.ux-alternative-section', 'Alternative Therapien', 'Hier trägt die Community ihr Wissen zu Therapiealternativen zusammen. Ergänze frei, was du für eine Alternative hältst – aus eigener Erfahrung, von anderen oder vom Hörensagen. Eigene Behandlungserfahrung ist nicht nötig.'],
          ['classification', '[data-relationship-stages]', 'Therapieansatz und Umsetzung'],
          ['combination', '[data-combination-section]', 'Therapiekombinationen', 'Welche Behandlungen ergeben zusammen mehr als ihre einzelnen Bestandteile? Gesucht sind gezielte Kombinationen, die einen zusätzlichen oder anderen Effekt erzielen sollen, den Genesungsprozess unterstützen oder zusammen eine eigenständige Therapie bilden. Entscheidend ist dieses Zusammenspiel, nicht allein die gleichzeitige Anwendung. Eigene Behandlungserfahrung ist dafür nicht nötig.']
        ];
        if(panel.id === 'alternativen') body[0].textContent = review
          ? 'Prüfe die vorhandenen Alternativen, Einordnungen und Kombinationen. Bestätige passende Einträge oder ergänze fehlende über die Schaltflächen im jeweiligen Bereich. Eigene Behandlungserfahrung ist dafür nicht nötig.'
          : 'Du bist unsicher, ob diese Therapie zu dir passt, oder suchst nach etwas, das dir mehr hilft? Hier trägt die Community Alternativen und konkrete Varianten zusammen. So kannst du entdecken, wie die Behandlung aussehen könnte und welche weiteren Möglichkeiten du hast.';
        if(panel.id === 'anreise') body[0].textContent = 'Suche in der Liste nach deiner Behandler:in. Fehlt er oder sie, kannst du den Eintrag unter Behandler:innen hinzufügen ergänzen.';
        prompts.forEach(([key, selector, title, text]) => {
          const target = panel.querySelector(selector);
          if(!target)return;
          target.dataset.guideContribution = key;
          const disclosure = make('details');
          if (key === 'classification') {
            disclosure.classList.add('therapy-guide-classification');
            title = target.querySelector('h3')?.firstChild?.textContent.trim() || title;
            disclosure.append(make('summary', title));
            renderClassificationGuide(disclosure, target);
          } else {
            disclosure.append(make('summary', title), make('p', !review && readingHelp[key] ? readingHelp[key] : text));
          }
          if (panel.id === 'alternativen' && review && key !== 'classification') {
            const explanations = {
              alternative: review
                ? 'Mit Zustimmen (✓) bestätigst du, dass du den vorgeschlagenen Eintrag als passende Alternative zur hier geöffneten Therapie ansiehst. Mit Widersprechen (×) widersprichst du diesem Vorschlag. Du bewertest damit weder die Wirksamkeit noch die Gleichwertigkeit der Therapien.'
                : 'Die Zahlen neben Zustimmen (✓) und Widersprechen (×) zeigen, wie viele Personen den Eintrag als passende Alternative ansehen oder diesem Vorschlag widersprechen. Sie bewerten weder die Wirksamkeit noch die Gleichwertigkeit der Therapien. Du kannst die Alternativen nach Zustimmung oder Widerspruch sortieren.',
              combination: review
                ? 'Mit Zustimmen (✓) bestätigst du, dass der angezeigte Bestandteil zur vorgeschlagenen Therapiekombination gehört. Mit Widersprechen (×) widersprichst du dieser Zuordnung. Deine Rückmeldung bezieht sich auf die Zusammensetzung der Kombination, nicht auf ihre Wirksamkeit.'
                : 'Die Zahlen neben Zustimmen (✓) und Widersprechen (×) zeigen, wie viele Personen der Zugehörigkeit des angezeigten Bestandteils zur vorgeschlagenen Therapiekombination zustimmen oder widersprechen. Sie bewerten die Zusammensetzung der Kombination, nicht ihre Wirksamkeit.'
            };
            const section = make('section');
            const votingHeading = make('h4', 'Zustimmung und Widerspruch');
            votingHeading.style.marginInlineStart = '.9rem';
            section.append(votingHeading, make('p', explanations[key]));
            disclosure.append(section);
          }
          body.push(disclosure);
          entries.push({card:target, disclosure});
        });
        if(panel.id === 'anreise' && review) {
          body.push(feedbackNote('Mit Zustimmen (✓) stimmst du der Angabe zu, dass die jeweilige Behandler:in diese Therapie anbietet. Mit Widersprechen (×) widersprichst du dieser Angabe. Deine Rückmeldung bezieht sich auf das Therapieangebot, nicht auf die Qualität oder Wirksamkeit der Behandlung.'));
        }
        if(panel.id === 'alternativen' && !review) {
          body.push(feedbackNote('Die Zahlen neben Zustimmen (✓) und Widersprechen (×) zeigen, wie die Community die jeweilige Zuordnung einschätzt, etwa als Therapiealternative. Sie helfen dir einzuordnen, wie gesichert diese Zuordnung ist. Sie bewerten weder die Wirksamkeit noch die Gleichwertigkeit der Therapien.'));
          sharing = shareTherapy(true);
          body.push(sharing.block);
        }
      }
      if(sharing && !body.includes(sharing.block)) body.push(sharing.block);
      const next = nextView();
      const nextLabel = next && 'Weiter zu ' + viewName(next) + ' →';
      const finish = () => {
        finishedSections[panel.id] = true;
        save();updateProgress();
        const thanks = make('dialog');
        thanks.setAttribute('aria-label', 'Danke, dass du dabei bist');
        const thanksActions = make('div', '', 'experience-guide-actions');
        thanksActions.append(button('Hier bleiben', () => thanks.close(), true), button('Anderes Anliegen wählen', () => {thanks.close();showOrientation();}));
        if (mode === 'explore') {
          thanks.classList.add('therapy-finish-dialog');
          const polls = make('div');
          const invitation = shareTherapy();
          const share = invitation.block.querySelector('button');
          const shareIcon = share.querySelector('svg');
          invitation.message.remove();
          invitation.block.querySelector('.experience-guide-actions').remove();
          invitation.block.classList.add('therapy-finish-share');
          const offerSharing = () => {
            if (document.querySelector('.therapy-share-invitation')) return;
            const dialog = make('dialog', '', 'experience-guide therapy-finish-dialog therapy-share-invitation');
            dialog.setAttribute('aria-label', 'Erfahrungen weitergeben');
            const copy = make('div', '', 'experience-guide-copy');
            const actions = make('div', '', 'experience-guide-actions');
            actions.append(button('Teilen', () => share.click(), true), button('Nein, danke', () => dialog.close()));
            copy.append(make('h2', 'Kennst du jemanden, der diese Therapie schon ausprobiert hat?'),
              make('p', 'Teile die Seite zu dieser Therapie mit dieser Person und lade sie ein, ihre Erfahrung beizutragen.'), actions, invitation.block);
            dialog.append(copy);
            document.body.append(dialog);
            dialog.addEventListener('close', () => dialog.remove(), {once: true});
            dialog.showModal();
          };
          const treatmentId = Number(content.closest('[data-treatment-id]').dataset.treatmentId);
          for (const [question, title] of [['helpful', 'Hat dir der Einblick geholfen?'], ['more', 'Wünschst du dir mehr Community-Angaben?']]) {
            const poll = make('section', '', 'therapy-finish-poll');
            poll.setAttribute('aria-label', title);
            const options = make('div', '', 'experience-guide-actions');
            const status = make('p', '', 'therapy-finish-poll-status');
            status.setAttribute('role', 'status');
            const controls = {};
            let busy = false;
            const request = async answer => {
              if (busy) return;
              busy = true;
              Object.values(controls).forEach(control => control.disabled = true);
              status.textContent = '';
              try {
                const endpoint = 'api/therapy_information_poll.php';
                const writing = answer !== undefined;
                const response = await fetch(writing ? endpoint : endpoint + '?treatment_id=' + treatmentId + '&question=' + question, writing ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({treatment_id: treatmentId, question, answer})} : {});
                const result = await response.json();
                if (!response.ok || !result.ok) throw new Error(result.error || 'Bitte später erneut versuchen.');
                Object.entries(controls).forEach(([key, control]) => {
                  control.setAttribute('aria-pressed', String(result.own === key));
                  control.querySelector('.therapy-finish-count').textContent = '(' + result.counts[key] + ')';
                });
                status.textContent = '';
              } catch (error) { status.textContent = error.message; }
              finally { busy = false; Object.values(controls).forEach(control => control.disabled = false); }
            };
            const labels = question === 'more' ? [['yes', 'Ja, gerne'], ['no', 'Ist ausreichend']] : [['yes', 'Ja'], ['no', 'Nein']];
            for (const [key, label] of labels) {
              controls[key] = button(label, () => {
                if (busy) return;
                const selected = controls[key].getAttribute('aria-pressed') === 'true';
                if (question === 'more' && key === 'yes' && !selected) offerSharing();
                request(selected ? null : key);
              });
              if (question === 'more' && key === 'yes') controls[key].prepend(shareIcon.cloneNode(true));
              controls[key].append(make('span', '', 'therapy-finish-count'));
              controls[key].setAttribute('aria-pressed', 'false');
              options.append(controls[key]);
            }
            if (question === 'helpful') options.append(button('Feedback', () => {
              document.querySelector('.lcn-feedback-float')?.click();
            }));
            const heading = make('h3', title + ' ');
            const info = make('span', '', 'therapy-finish-info');
            const setInfoOpen = open => {
              if (open) thanks.querySelectorAll('.therapy-finish-info > button').forEach(other => {
                if (other !== toggle) {
                  other.setAttribute('aria-expanded', 'false');
                  document.getElementById(other.getAttribute('aria-controls'))?.setAttribute('hidden', '');
                }
              });
              toggle.setAttribute('aria-expanded', String(open));
              help.hidden = !open;
              if (open) {
                const iconRect = toggle.getBoundingClientRect();
                const pollRect = poll.getBoundingClientRect();
                help.style.setProperty('--info-left', (iconRect.right - pollRect.left + 8) + 'px');
                help.style.setProperty('--info-top', (iconRect.top - pollRect.top) + 'px');
              }
            };
            const toggle = button('ⓘ', () => setInfoOpen(toggle.getAttribute('aria-expanded') !== 'true'));
            toggle.setAttribute('aria-label', 'Information zur Frage');
            toggle.setAttribute('aria-expanded', 'false');
            const help = make('span', question === 'helpful'
              ? 'Konntest du die Therapie durch diesen Einblick besser einordnen? Die Zahlen zählen Stimmen. Deine Auswahl lässt sich ändern.'
              : 'Wünschst du dir weitere Erfahrungen? Wenn du zustimmst, bieten wir dir an, die Seite zu dieser Therapie zu teilen. Das ist freiwillig. Die Zahlen zählen Stimmen. Deine Auswahl lässt sich ändern.', 'therapy-finish-tooltip lcn-shared-tooltip');
            help.id = 'therapy-finish-help-' + question;
            help.setAttribute('role', 'tooltip');
            help.hidden = true;
            toggle.setAttribute('aria-controls', help.id);
            toggle.setAttribute('aria-describedby', help.id);
            info.append(toggle);
            info.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setInfoOpen(true); });
            info.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch' && !help.contains(event.relatedTarget)) setInfoOpen(false); });
            help.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch' && !info.contains(event.relatedTarget)) setInfoOpen(false); });
            poll.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') setInfoOpen(false); });
            toggle.addEventListener('focus', () => { if (toggle.matches(':focus-visible')) setInfoOpen(true); });
            toggle.addEventListener('blur', () => setInfoOpen(false));
            thanks.addEventListener('pointerdown', event => { if (!info.contains(event.target) && !help.contains(event.target)) setInfoOpen(false); });
            thanks.addEventListener('keydown', event => {
              if (event.key === 'Escape' && !help.hidden) { event.preventDefault(); setInfoOpen(false); }
            });
            heading.append(info);
            poll.append(heading, help, options, status);
            polls.append(poll);
            request();
          }
          illustrated(thanks, 'Zum Abschluss', make('h2', 'Dein kurzer Eindruck'), polls, thanksActions);
        } else illustrated(thanks, 'Für heute geschafft', make('h2', 'Danke, dass du dabei bist!'),
          make('p', 'Schön, dass du dir Zeit genommen hast, dich hier umzusehen und dein Wissen zu teilen. So wächst unser gemeinsames Wissen – und andere finden leichter ihren Weg.'),
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
      const backButton = previous ? button('← Zurück zu ' + viewName(previous), () => openView(previous)) : null;
      backButton?.classList.add('therapy-guide-back');
      const changeIntent = button(next ? 'Ich bin hier fertig' : 'Ich bin fertig', finish, !next);
      changeIntent.classList.add('therapy-guide-change-intent');
      if (!next) changeIntent.classList.add('therapy-guide-finish');
      if (review && entries.length) {
        completion = make('p', '', 'therapy-guide-progress');
        completion.setAttribute('role', 'status');
        body.push(completion);
      }
      const secondaryActions = make('div', '', 'therapy-guide-secondary-actions');
      if (next) secondaryActions.append(changeIntent);
      secondaryActions.append(close);
      actions.classList.add('therapy-guide-navigation');
      const navigationPair = make('div', '', 'therapy-guide-navigation-pair');
      if(backButton)navigationPair.append(backButton);
      if(backButton){const divider=make('span', '', 'therapy-guide-navigation-divider');divider.setAttribute('aria-hidden','true');navigationPair.append(divider);}
      if(nextButton)navigationPair.append(nextButton);
      if(!next)navigationPair.append(changeIntent);
      actions.append(navigationPair, secondaryActions);
      if (!review && !['anreise', 'alternativen'].includes(panel.id)) {
        const orientationClosing = panel.id === 'zugang'
          ? 'Das kann dir eine erste Orientierung geben, was du selbst erwarten könntest'
          : 'Das kann dir eine erste Orientierung geben, was du selbst erwarten könntest – auch wenn die Wirkung von Person zu Person unterschiedlich ist.';
        if (!body[0].textContent.includes(orientationClosing)) body[0].append(document.createTextNode(' ' + orientationClosing));
      }
      illustrated(guide, review ? (panel.id === 'alternativen' ? 'Community-Wissen' : 'Deine Erfahrung zählt') : 'Erfahrungen verstehen', heading, ...body, actions);
      if (!review && sharing) {
        sharing.block.classList.add('therapy-guide-sharing-first');
        guide.querySelector('.experience-guide-copy').prepend(sharing.block);
      }
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

    function startView([value, , , view]) {
      if (value === 'explore') {
        const first = views.find(link => !['ueberblick', 'anreise', 'alternativen'].includes(link.dataset.view) && hasInformation(link));
        if (first) return first;
      }
      return views.find(link => link.dataset.view === view);
    }

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
      const initial = Math.max(0, choices.findIndex(choice => choice[0] === (mode || preferredMode())));
      const description = make('p', choices[initial][2]);
      const follow = button(choices[initial][4] + ' →', async () => {
        const choice = choices[current];
        const [value] = choice;
        if (value === 'explore' && experienceCount() === 0) {
          follow.disabled = true;
          const loaded = await treatment.lcnInitialAnswers;
          follow.disabled = false;
          if (!host.isConnected || (dialog && !dialog.open) || choices[current][0] !== value) return;
          if (loaded && experienceCount() === 0) {
            dialog?.close();
            showEmptyState();
            return;
          }
        }
        dialog?.close();
        chooseMode(value);
        // Reading and contributing change the mode of the current section.
        // Only the initial overview and intents with a specific destination navigate.
        const keepCurrentView = ['review', 'explore'].includes(value)
          && panel && !['ueberblick', 'dashboard'].includes(panel.id);
        const target = keepCurrentView ? null : startView(choice);
        paint(true);
        if (target) openView(target);
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
      let current = initial;
      let expanded = false;
      let scrolling = false;
      let settleTimer;
      let openAfterScroll = null;
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
        // Start revealing as the clicked option enters the centre, while it is still rolling.
        if (openAfterScroll !== null && current === openAfterScroll) {
          openAfterScroll = null;
          setExpanded(true);
        }
        paintWheel();
      }

      function go(index, visiblePosition = false, open = false) {
        openAfterScroll = open ? wrapIndex(index) : null;
        setExpanded(false);
        const row = track.scrollTop / rowHeight;
        // Use the same wrapped distance as the visible labels, including during rotation.
        const target = visiblePosition
          ? row + wrapIndex(index - row + choices.length / 2) - choices.length / 2
          : Math.round(row) + index - current;
        track.scrollTo({top: target * rowHeight,
          behavior: reducedMotion ? 'instant' : 'smooth'});
        update();
        settle();
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
          else go(index, true, true);
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
        openAfterScroll = null;
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
        openAfterScroll = null;
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
        track.scrollTop = (choices.length + initial) * rowHeight;
        update();
      });
    }

    function enableOrientation() {
      const previousMode = mode || (minimized ? '' : preferredMode());
      if (!previousMode) {
        showOrientation();
        return;
      }
      chooseMode(previousMode);
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
        button('Ich brauche keine Orientierung', () => disableOrientation(dialog)));
      document.body.append(dialog);
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        disableOrientation(dialog, false);
      });
      dialog.addEventListener('close', () => dialog.remove(), {once: true});
      dialog.showModal();
    }

    function emptyStateDestination() {
      if (providerCount > 0) {
        return {view: 'anreise', description: 'Für diese Therapie findest du Einträge in der Behandler:innen-Suche.'};
      }

      const view = 'alternativen';
      const panel = document.getElementById(view);
      const alternatives = panel.querySelector('.ux-alternative-section');
      const classification = panel.querySelector('[data-relationship-stages]');
      const combinations = panel.querySelector('[data-combination-section]');
      if (alternatives.querySelector('.ux-feedback-relation')) {
        return {view, description: 'Die Community hat bereits alternative Therapien eingetragen.'};
      }
      if (classification.querySelector('.ux-stage-node.is-linked')) {
        return {view, description: 'Unter Alternativen und Ausgestaltung findest du bereits Zuordnungen zu dieser Therapie.'};
      }
      if (combinations.querySelector('[data-combination-tree]')) {
        return {view, description: 'Zu dieser Therapie sind bereits Kombinationen eingetragen.'};
      }
      return {view, description: 'Unter Alternativen und Ausgestaltung kannst du nachsehen, wie die Therapie eingeordnet ist, und Angaben ergänzen.'};
    }

    function showEmptyState() {
      const dialog = make('dialog', '', 'therapy-empty-state');
      const title = make('h2', 'Noch keine Erfahrungsberichte');
      title.id = 'therapy-empty-state-title';
      dialog.setAttribute('aria-labelledby', title.id);
      const description = make('p');
      const actions = make('div', '', 'experience-guide-actions');
      let destinationLink;
      const proceed = button('', () => {
        dialog.close();
        chooseMode('explore');
        if (panel?.id === destinationLink.dataset.view) paint(true);
        openView(destinationLink);
      }, true);
      proceed.autofocus = true;
      actions.append(proceed, button('Hier bleiben', () => dialog.close()));

      const invitation = shareTherapy();
      invitation.message.textContent = 'Kennst du jemanden, der die Therapie ausprobiert hat? Teile die Seite und lade die Person ein, ihre Erfahrung beizutragen.';
      illustrated(dialog, '', title, description, actions, invitation.block);
      function updateDestination() {
        const destination = emptyStateDestination();
        destinationLink = views.find(link => link.dataset.view === destination.view);
        updateText(description, destination.description);
        updateText(proceed, 'Zu ' + viewName(destinationLink));
      }
      updateDestination();
      const listeners = new AbortController();
      window.addEventListener('lcn-provider-catalog', updateDestination, {signal: listeners.signal});
      document.addEventListener('lcn-combination-diagrams-changed', updateDestination, {signal: listeners.signal});
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        listeners.abort();
        dialog.remove();
      }, {once: true});
      dialog.showModal();
    }

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
      providerCount = event.detail.providers.length;
      if(event.detail?.contributed){providerContributed=true;save();updateProgress();}
    });
    restore();
    document.addEventListener('lcn-treatment-view-changed', () => paint());
    document.addEventListener('lcn-combination-diagrams-changed', refreshClassificationGuide);
    window.addEventListener('lcn-relation-feedback', () => queueMicrotask(refreshClassificationGuide));
    document.addEventListener('lcn-treatment-answers-rendered', () => {
      // Counts and visibility can change without replacing the reading guide.
      // Replacing it during a drag invalidates the browser's selection endpoints.
      const onlyAnswered = mode === 'explore' && !orientationIsOff();
      content.querySelectorAll('[data-question], .ux-symptom-help').forEach(card => {
        card.hidden = onlyAnswered && cardCount(card) === 0;
      });
      refreshTopics();
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
      openView(views.find(link => link.dataset.view === 'ueberblick'));
    } else inheritOrientation();
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

// Remember native disclosures, including guide panels mounted after page load.
(() => {
  const root = document.querySelector('.ux-detail[data-treatment-id]');
  if (!root) return;
  const storageKey = 'lcn_therapy_disclosures:' + root.dataset.treatmentId;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(storageKey)) || {}; } catch {}
  const initialized = new WeakSet();
  function restore() {
    root.querySelectorAll('details').forEach(details => {
      if (initialized.has(details)) return;
      initialized.add(details);
      const section = details.closest('.view-panel, [data-view-panel], section[id], [id]');
      const summary = details.querySelector(':scope > summary');
      const title = summary?.cloneNode(true);
      title?.querySelectorAll('[data-guide-answer-count]').forEach(node => node.remove());
      const key = (section?.id || 'page') + ':' + (details.id || title?.textContent.trim());
      if (typeof saved[key] === 'boolean') details.open = saved[key];
      details.addEventListener('toggle', () => {
        saved[key] = details.open;
        try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
      });
    });
  }
  restore();
  new MutationObserver(restore).observe(root, {childList: true, subtree: true});
})();
