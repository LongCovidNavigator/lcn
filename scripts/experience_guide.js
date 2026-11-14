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
        'Die Community-Bewertung fragt nach deiner Gesamterfahrung. Was hat sich für dich nach der Therapie verändert? Wähle die Antwort, die deinem Verlauf am nächsten kommt.',
        'Die Balken zeigen, wie die Community ihren Zustand nach der Therapie erlebt hat: von Verschlechterung über keine Veränderung bis hin zu Verbesserung oder Heilung. Die Zahl der Angaben hilft dir, die Verteilung einzuordnen.'
      ],
      gamechanger: [
        'Hat die Therapie deinen Alltag entscheidend verbessert? Hier kannst du angeben, ob sie für dich einen solchen Unterschied gemacht hat.',
        'Der Kreis zeigt den Anteil der Teilnehmenden, für die die Therapie einen entscheidenden Unterschied im Alltag gemacht hat. Das ist eine eigene Frage neben der Gesamtbewertung.'
      ],
      symptoms: [
        'Hast du bei bestimmten Beschwerden eine Verbesserung bemerkt? Markiere die passenden Symptome. Über das Suchfeld findest du weitere. Wenn dir die Therapie bei keinem Symptom geholfen hat, geh einfach weiter.',
        'Die Liste zeigt, bei welchen Beschwerden Teilnehmende eine Verbesserung bemerkt haben. Die Stimmen zählen pro Symptom, und dieselbe Person kann mehrere Symptome auswählen.'
      ],
      setting: [
        'Wo hast du die Therapie gemacht? Wähle, was auf dich zutrifft, etwa selbstständig zu Hause, beim Hausbesuch, ambulant oder stationär. Damit können andere besser planen.',
        'Hier siehst du, in welchem Rahmen andere die Therapie gemacht haben. Das hilft dir einzuschätzen, ob du dafür zum Beispiel einen Termin vor Ort einplanen müsstest.'
      ],
      pem: [
        'Wie hast du die Belastung durch die Therapie vertragen? Wähle, wie hoch du das Crash-PEM-Risiko nach deiner eigenen Erfahrung einschätzt.',
        'Diese Verteilung zeigt, wie andere das Risiko einer Verschlechterung nach Belastung eingeschätzt haben. Sie gibt dir Anhaltspunkte für Fragen zur Verträglichkeit.'
      ],
      access: [
        'Wie bist du an die Therapie gekommen? Wähle den Weg, den du genutzt hast, etwa eine Verordnung, ein frei verfügbares Angebot oder Selbstmanagement.',
        'Die Angaben zeigen, welche Zugangswege andere genutzt haben und ob sie beispielsweise eine Verordnung brauchten.'
      ],
      unit_cost: [
        'Was hat dich eine einzelne Behandlung oder Einheit gekostet? Wähle für das passende Versicherungssystem die Kostenspanne oder „kostenlos“, wenn du nichts zahlen musstest.',
        'Hier geht es um die Kosten für eine einzelne Anwendung oder Einheit. Mit der Auswahl zum Versicherungssystem kannst du die Angaben für deine Situation einordnen.'
      ],
      total_cost: [
        'Was hast du für den gesamten Verlauf bezahlt? Wenn du den Betrag ungefähr kennst, hilft auch eine Kostenspanne.',
        'Hier siehst du die Kosten für den gesamten Therapieverlauf. Bei mehreren Einheiten können sie deutlich über dem Preis einer einzelnen Anwendung liegen.'
      ]
    };
    const encouragement = {
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
    let panel;
    let guide;
    let entries = [];
    let completion;
    let sharing;

    function restore() {
      try {
        const state = JSON.parse(sessionStorage.getItem(storageKey));
        mode = ['review', 'explore'].includes(state?.mode) ? state.mode : '';
        minimized = state?.minimized === true;
      } catch {}
    }

    function save() {
      try { sessionStorage.setItem(storageKey, JSON.stringify({mode, minimized})); } catch {}
    }

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

    function shareTherapy() {
      const block = make('div', '', 'therapy-guide-sharing');
      const message = make('p');
      const url = new URL(location.pathname, location.origin);
      if (window.LCNDummy?.available || ['lcn.localhost.test', 'localhost.test'].includes(url.hostname)) {
        url.href = 'https://long-covid-navigator.de/therapie_detail.php';
      }
      url.searchParams.set('treatment_id', content.closest('[data-treatment-id]').dataset.treatmentId);
      const text = 'Kennst du diese Therapie aus eigener Erfahrung? Teile sie im Long Covid Navigator.';
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
      email.href = 'mailto:?subject=' + encodeURIComponent('Erfahrungen mit dieser Therapie') +
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
      return {block, message};
    }

    function refreshTopics() {
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
      if (completion) {
        const done = entries.every(({card}) => card.querySelector(
          '[data-option][aria-pressed="true"], [data-symptom-id][aria-pressed="true"]'
        ));
        completion.box.hidden = !done;
        completion.nextButton.hidden = done;
      }
      if (sharing) {
        const answered = entries.filter(({card}) => Number(card.dataset.realAnswerCount) >= 10).length;
        sharing.block.hidden = answered === entries.length;
        sharing.message.textContent = (answered
          ? 'Zu einigen Themen gibt es derzeit wenige echte Rückmeldungen.'
          : 'Für eine Einschätzung in diesem Bereich gibt es derzeit zu wenige echte Rückmeldungen.'
        ) + ' Kennst du jemanden, der die Therapie ausprobiert hat? Mit diesem Link kannst du die Person einladen, ihre Erfahrung beizutragen.';
      }
    }

    function nextView() {
      return views[views.findIndex(link => link.dataset.view === panel.id) + 1];
    }

    function viewName(link) {
      return link.querySelector('strong').textContent.replaceAll('­', '');
    }

    function paint(force = false) {
      const active = content.querySelector('.nd-panel:not([hidden])');
      if (!active || (!force && panel === active)) return;
      guide?.remove();
      panel = active;
      entries = [];
      completion = sharing = null;

      if ((panel.id !== 'ueberblick' && (minimized || !mode)) || panel.id === 'dashboard') {
        guide = button('Begleitung öffnen', () => {
          minimized = false;
          save();
          paint(true);
          if (!mode || panel.id === 'dashboard') openView(views[0]);
          else scrollTo(guide);
        });
        guide.classList.add('therapy-guide-reopen');
        (panel.id === 'ueberblick' ? welcome : panel).prepend(guide);
        return;
      }

      guide = make('section');
      const actions = make('div', '', 'experience-guide-actions');
      const close = button('Ich brauche keinen Navigator', () => {
        minimized = true;
        save();
        paint(true);
        if (panel.id === 'ueberblick') scrollTo(guide);
        else guide.focus({preventScroll: true});
      });

      if (panel.id === 'ueberblick') {
        const start = nextMode => {
          const review = nextMode === 'review';
          therapyDialog(review ? 'Deine Erfahrung zählt' : 'Schön, dass du dich umschaust',
            review
              ? 'Mit deiner Erfahrung hilfst du anderen, diese Therapie besser einzuschätzen. Wir starten mit der Community-Bewertung, dem Gamechanger und den Symptomen. Du entscheidest, was du beantworten möchtest.'
              : 'Wir schauen zuerst darauf, was andere über die Therapie berichten. Danach kannst du dir Durchführung, Belastung und Kosten ansehen und herausfinden, welche Anlaufstellen oder Alternativen es gibt.',
            'Zu den Erfahrungen aus der Community', () => {
              mode = nextMode;
              minimized = false;
              save();
              openView(views[1]);
            });
        };
        actions.classList.add('therapy-guide-choices');
        actions.append(
          button('Ich habe die Therapie gemacht und möchte meine Erfahrung teilen', () => start('review')),
          button('Ich möchte die Therapie kennenlernen', () => start('explore')),
          close
        );
        guide.classList.add('experience-guide-banner');
        illustrated(guide, 'Deine Erfahrung zählt', make('h2', 'Willkommen! Was führt dich hierher?'),
          make('p', 'Was hat dir geholfen? Was war schwierig? Deine Erfahrung kann anderen bei ihrer Entscheidung helfen. Wenn du die Therapie erst kennenlernst, begleiten wir dich durch die Rückmeldungen der Community.'),
          ...(minimized ? [make('p', 'Du kannst dich jetzt frei umsehen. Die Begleitung kannst du hier jederzeit starten.')] : []), actions);
        welcome.append(guide);
        return;
      }

      guide.classList.add('therapy-guide-note');
      const heading = make('h2', panel.getAttribute('aria-label'));
      const review = mode === 'review';
      const body = [make('p', encouragement[panel.id][review ? 0 : 1])];
      const cards = panel.querySelectorAll('[data-question], .ux-symptom-help');
      if (cards.length) {
        body.push(make('p', review
          ? 'Klappe ein Thema auf, wenn du Hilfe beim Ausfüllen oder Überarbeiten brauchst. Teile so viel, wie für dich gerade passt.'
          : 'Klappe ein Thema auf, um die Rückmeldungen der Community besser einzuordnen.'));
        if (!review) {
          sharing = shareTherapy();
          body.push(sharing.block);
        }
      } else if (panel.id === 'anreise') {
        body.push(make('p', 'Gib eine Adresse, Postleitzahl oder einen Ort ein, um Entfernungen und die Anreise einzuschätzen.'));
      }
      cards.forEach(card => {
        const topic = topics[card.dataset.question || 'symptoms'];
        if (!topic) return;
        const title = card.querySelector('h3').firstChild.textContent.trim();
        const disclosure = make('details');
        disclosure.append(make('summary', title), make('p', topic[review ? 0 : 1]));
        const example = review ? null : make('p');
        if (example) disclosure.append(example);
        disclosure.append(button('Zu „' + title + '“ ↓', () => scrollTo(card)));
        body.push(disclosure);
        entries.push({card, example});
      });
      const next = nextView();
      const nextLabel = next && 'Weiter zu „' + viewName(next) + '“ →';
      const nextButton = next
        ? button(nextLabel, () => openView(next), true)
        : button('Begleitung abschließen', () => {
          mode = '';
          close.click();
        }, true);
      if (review && entries.length && next) {
        const box = make('div', '', 'therapy-guide-thanks');
        const status = make('p');
        status.setAttribute('role', 'status');
        status.append(make('strong', 'Danke für deine Erfahrung!'),
          ' Deine Angaben sind gespeichert. Du kannst sie weiter ergänzen oder zum nächsten Abschnitt gehen.');
        box.append(status, button(nextLabel, () => openView(next), true));
        completion = {box, nextButton};
        body.push(box);
      }
      actions.append(nextButton, close);
      illustrated(guide, review ? 'Deine Erfahrung zählt' : 'Dein nächster Schritt', heading, ...body, actions);
      panel.prepend(guide);
      refreshTopics();
    }

    restore();
    document.addEventListener('lcn-treatment-view-changed', () => paint());
    document.addEventListener('lcn-treatment-answers-rendered', refreshTopics);
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        restore();
        paint(true);
      }
    });
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
