(() => {
  'use strict';
  const content = document.getElementById('view-content');
  if (!content) return;
  const doctor = document.body.dataset.doctorPage === 'live';
  const params = new URLSearchParams(location.search);
  const treatment = content.closest('[data-treatment-id]');
  const profileParam = params.has('submission_id') ? 'submission_id' : 'id';
  const profileId = query => query.has('submission_id')
    ? 'submission:' + query.get('submission_id') : query.get('id');
  const entryId = doctor ? profileId(params) : treatment?.dataset.treatmentId;
  if (!entryId || (!doctor && !content.querySelector('[data-therapy-welcome]'))) return;
  mountGuide();

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

  function mountGuide() {
    const views = [...document.querySelectorAll('.side-nav [data-view]')]
      .filter(link => link.dataset.view !== 'dashboard');
    const storageBase = doctor ? 'lcn_doctor_guide' : 'lcn_therapy_guide';
    const storagePrefix = storageBase + ':';
    const preferredModeKey = storageBase + '_preferred_mode';
    const orientationDisabledKey = storageBase + '_disabled';
    const contributionPrompt = 'Klicke in den Abbildungen oder Listen auf das, was deiner bisherigen Erfahrung entspricht. Jede Angabe hilft Patienten.';
    const ratingContext = doctor
      ? 'während der Behandlung bei der ausgewählten Behandlerin oder dem ausgewählten Behandler'
      : 'bei Anwendung der ausgewählten Therapie';
    const communityRating = {
      intro: 'Unter „Genesungsfortschritt“ fasst die Community zusammen, wie sich der Gesamtzustand ' + ratingContext + ' verändert hat. Du kannst zwischen vier Antworten wählen.',
      readingIntro: 'Unter „Genesungsfortschritt“ fasst die Community zusammen, wie sich der Gesundheitszustand ' + ratingContext + ' verändert hat. So siehst du, welchen Effekt die Behandlung aus Sicht der Community hatte. Die Antworten werden in vier Kategorien erfasst:',
      readingClosing: 'Beachte beim Vergleich auch die Anzahl der Angaben. Die Auswertung beschreibt die Erfahrungen der Community und berechnet nicht die individuelle Erfolgschance.',
      options: [
        ['Verschlechterung', 'verschlechtert'],
        ['Neutral', 'nicht verändert'],
        ['Verbesserung', 'verbessert'],
        ['Heilung', 'bis zur Genesung verbessert']
      ],
      closing: 'Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du ' + (doctor ? 'Patienten, die Behandlung' : 'Patienten, die Therapie') + ' besser einzuschätzen.'
    };

    function communityRatingOptions(review) {
      const list = make('ul', '', 'therapy-guide-options');
      for (const [label, ending] of communityRating.options) {
        const item = make('li');
        const description = make('span');
        description.append('Mein Gesamtzustand hat sich ', make('u', ending), '.');
        item.append(make('strong', review ? label : label + ':'), description);
        list.append(item);
      }
      return list;
    }

    function appendCommunityRating(disclosure) {
      disclosure.append(make('p', communityRating.intro), communityRatingOptions(true), make('p', communityRating.closing));
    }

    const topics = {
      effect: [
        communityRating,
        'Hier geht es um die Veränderung des Gesamtzustands während der Anwendung: Verschlechterung, Neutral (keine Veränderung), Verbesserung oder Heilung. Die Balken und Prozentangaben zeigen, wie sich die Antworten auf diese vier Möglichkeiten verteilen. Lies auch die Anzahl der Angaben: Ein hoher Anteil bei wenigen Antworten beschreibt zunächst nur diese wenigen Erfahrungen. Die Auswertung zeigt persönliche Einschätzungen und belegt nicht, dass die Therapie allein die Veränderung verursacht hat.'
      ],
      gamechanger: [
        {"intro": "Als Gamechanger gilt eine Therapie, die deinen Genesungsprozess entscheidend vorangetrieben hat. Du kannst zwischen zwei Antworten wählen:", "options": ["Ja: Die ausgewählte Therapie hat deinen Genesungsprozess entscheidend vorangetrieben.", "Nein: Die ausgewählte Therapie hat deinen Genesungsprozess leider nicht entscheidend vorangetrieben."], "closing": "Klicke in der Abbildung auf die passende Antwort. Damit hilfst du Patienten, die Bedeutung der Therapie für den Genesungsprozess einzuschätzen."},
        'Die Frage lautet: Hat die Therapie den Genesungsprozess entscheidend vorangetrieben? Im Ring und neben den Antworten siehst du den Anteil von Ja und Nein. Ein Ja steht für einen entscheidenden Fortschritt, nicht zwingend für Heilung. Ein Nein bedeutet umgekehrt nicht automatisch, dass die Therapie gar nicht geholfen hat. Vergleiche diese Angabe deshalb mit den Angaben zum Genesungsfortschritt.'
      ],
      symptoms: [
        {"intro": "Hier sammelt die Community, welche Symptome durch die ausgewählte Therapie gelindert wurden. Du hast folgende Möglichkeiten:", "options": ["Symptome auswählen: Klicke auf die passenden Symptome in der Auflistung unten, um deine Erfahrung zu ergänzen.", "Weitere Symptome ergänzen: Ergänze Symptome, die durch die Therapie gelindert wurden und noch nicht aufgelistet sind."], "closing": "Damit hilfst du Patienten mit ähnlichen Symptomen, die Therapie besser einzuschätzen."},
        'Die Liste zeigt, bei welchen Symptomen die Community eine Linderung durch die Therapie berichtet. Die Zahl neben einem Symptom zählt die entsprechenden Nennungen. Eine Person kann mehrere Symptome auswählen; die Zahlen lassen sich deshalb nicht zu einer Zahl behandelter Personen addieren. Viele Nennungen sind keine Erfolgsquote: Hier wird nicht erfasst, wie viele Menschen das jeweilige Symptom hatten, ohne eine Linderung zu erleben. Ein Symptom ohne Stimmen bedeutet, dass bisher keine entsprechende Linderung eingetragen wurde.'
      ],
      setting: [
        {"intro": "Die Community erfasst, wo und in welchem Rahmen du die ausgewählte Therapie angewendet hast. Dieses Durchführungssetting hilft Patienten einzuschätzen, welcher Aufwand damit für sie verbunden wäre und ob der Rahmen zu ihnen passt. Zur Auswahl stehen:", "options": ["Selbstständig zu Hause: Du wendest die Therapie eigenständig zu Hause an, ohne zusätzlichen Reiseaufwand oder die Hilfe einer Behandlerin oder eines Behandlers.", "Hausbesuch: Du benötigst Unterstützung durch Fachpersonal, kannst die Behandlung aber zu Hause durchführen.", "Ambulant: Du hast einzelne Termine vor Ort, zum Beispiel in einer Praxis.", "Stationär: Du hältst dich zur Behandlung für einen längeren Zeitraum in einer Einrichtung auf."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du Patienten, die Durchführung der Therapie zu planen."},
        'Die Verteilung zeigt, in welchem Rahmen Patienten die Therapie durchgeführt haben: selbstständig zu Hause, als Hausbesuch, ambulant mit einzelnen Terminen vor Ort oder stationär mit Aufenthalt in einer Einrichtung. Vergleiche die Anteile, um einen Eindruck von möglichen Abläufen zu bekommen. Das häufigste Setting ist keine verbindliche Vorgabe für jede Anwendung. Lies die Angaben zusammen mit dem Anreiseaufwand und der Einschätzung zum Verschlechterungsrisiko.'
      ],
      pem: [
        {"intro": "Hier geht es um deine Einschätzung aus eigener Erfahrung: Wie hoch hältst du das Risiko, dass die ausgewählte Behandlung bei Patienten zu einer Zustandsverschlechterung führt? Zur Auswahl stehen:", "options": ["Keines: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung nicht vorhanden ist.", "Niedrig: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung gering ist.", "Mittel: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung mittel ist.", "Hoch: Aus deiner Erfahrung gehst du davon aus, dass das Risiko einer Zustandsverschlechterung hoch ist."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du Patienten, die mögliche Belastung durch die Therapie besser einzuordnen."},
        'Hier teilt die Community ihre Einschätzung aus eigener Erfahrung zum Risiko einer Zustandsverschlechterung durch die Behandlung: keines, niedrig, mittel oder hoch. Die Prozentwerte zeigen die Verteilung dieser Einschätzungen. Sie geben nicht an, bei wie vielen Personen tatsächlich eine Verschlechterung aufgetreten ist. Achte auch auf Stimmen bei höheren Risikostufen, selbst wenn eine niedrigere Stufe häufiger gewählt wurde. Die Antwort Keines ist eine persönliche Einschätzung und keine Zusicherung für die eigene Anwendung.'
      ],
      access: [
        {"intro": "Hier erfasst die Community die Zugänglichkeit der ausgewählten Therapie: Wie aufwendig ist es, Zugang zu dieser Therapie zu erhalten? Vier Zugangswege im Vergleich:", "options": ["Selbstmanagement / eigenständig umsetzbar: Du kannst die Maßnahme selbst umsetzen. Du benötigst weder eine Behandlerin oder einen Behandler noch eine ärztliche Verordnung. Der Zugang ist mit geringem Aufwand verbunden.", "Frei erhältlich / private Behandler:innen: Du kaufst das Mittel selbst oder vereinbarst die Behandlung direkt mit privaten Behandler:innen. Eine ärztliche Verordnung ist nicht nötig. Der Zugang ist mit mittlerem Aufwand verbunden.", "Ärztliche Verordnung oder Rezept erforderlich: Du benötigst eine ärztliche Verordnung oder ein Rezept, um die Therapie zu erhalten. Der Zugang ist mit hohem Aufwand verbunden.", "Nur im Rahmen einer Studie möglich: Du kannst die Behandlung nur erhalten, wenn du zur Teilnahme an einer entsprechenden Studie zugelassen wirst. Der Zugang ist mit sehr hohem Aufwand verbunden."], "closing": "Klicke in der Abbildung auf den Zugangsweg, der deiner bisherigen Erfahrung entspricht. Damit hilfst du Patienten, einen passenden Weg zur Therapie zu finden."},
        'Hier berichtet die Community über ihre Zugangswege zur Therapie: durch Selbstmanagement, frei erhältlich oder über private Behandler:innen, mit ärztlicher Verordnung beziehungsweise Rezept oder im Rahmen einer Studie. Die Anteile zeigen die berichteten Zugangswege. Mehrere vertretene Wege können auf unterschiedliche Anwendungen oder Rahmenbedingungen hinweisen. Eine Nennung sagt noch nichts über aktuelle Verfügbarkeit, Wartezeit oder Kostenübernahme aus.'
      ],
      unit_cost: [
        {"intro": "Hier erfasst die Community, was du pro Therapieeinheit selbst bezahlt hast – zum Beispiel pro Anwendung, Behandlung, Packung oder Ampulle. Ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Falls sich die Kosten nicht pro Einheit angeben lassen, wähle die Option Nicht anwendbar und trage stattdessen die Gesamtkosten ein.", "options": ["Nicht anwendbar: Eine Kostenangabe pro Einheit passt nicht zu dieser Therapie.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Betrag pro Einheit. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du Patienten, die eigenen Kosten besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Die Verteilung zeigt den selbst bezahlten Betrag pro Therapieeinheit nach Abzug der Kostenübernahme, etwa pro Anwendung, Packung oder Ampulle. Prüfe zuerst das ausgewählte Krankenversicherungssystem und die Versicherungsart: Die Anzeige bezieht sich auf diesen Kontext. Kostenlos bedeutet, dass keine Kosten anfielen; Komplett übernommen, dass die Krankenkasse die Kosten vollständig getragen hat. Nicht anwendbar ist keine Kostenangabe von null Euro. Die Betragsstufen sind ungefähre Angaben; bei unterschiedlich großen Einheiten sind sie nur eingeschränkt vergleichbar.'
      ],
      total_cost: [
        {"intro": "Hier erfasst die Community, was du bisher insgesamt selbst für die Therapie bezahlt hast. Zähle alle bisherigen Anwendungen und Ausgaben zusammen und ziehe den Betrag ab, den deine Krankenkasse übernommen hat. Ist die Therapie noch nicht abgeschlossen, schätze die Gesamtkosten. Bei einer fortlaufenden Therapie kannst du die Option Nicht anwendbar wählen und stattdessen die Kosten pro Einheit angeben.", "options": ["Nicht anwendbar: Eine Angabe zu Gesamtkosten lässt sich auf diese Therapie nicht anwenden.", "Kostenlos: Für die Therapie sind keine Kosten angefallen.", "Komplett übernommen: Die Kosten wurden vollständig von deiner Krankenkasse übernommen.", "Kostenspannen: Wähle den ungefähr passenden Gesamtbetrag. Eine grobe Schätzung genügt."], "closing": "Klicke in der Abbildung auf die Antwort, die deiner bisherigen Erfahrung entspricht. Damit hilfst du Patienten, die Kosten eines Therapieverlaufs besser einzuplanen.", "insuranceIntro": "Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. Für Deutschland stehen zur Auswahl:", "insuranceOptions": ["GKV: Du bist gesetzlich krankenversichert.", "PKV: Du bist privat krankenversichert.", "Aus dem Ausland: Du nimmst aus dem Ausland teil. Wähle diese Option, wenn deine Versicherung nicht zum ausgewählten Krankenversicherungssystem gehört."], "optionsIntro": "Mache anschließend eine Angabe zu deinem Kostenanteil:"},
        'Hier siehst du, welche selbst getragenen Gesamtkosten für den Therapieverlauf die Community berichtet, nach Abzug einer Kostenübernahme. Bei noch laufenden Behandlungen können die Angaben geschätzt sein. Prüfe das ausgewählte Krankenversicherungssystem und die Versicherungsart und unterscheide Kostenlos, Komplett übernommen und Nicht anwendbar. Die Betragsstufen sind keine Preisangebote. Unterschiedliche Behandlungsdauern und Anwendungszahlen können zu unterschiedlichen Gesamtkosten führen; lies diese deshalb zusammen mit den Kosten pro Einheit.'
      ]
    };
    const encouragement = {
      symptome: ['Bei welchen Symptomen hat dir die Therapie geholfen? Wähle die passenden Symptome aus oder suche weitere. Du entscheidest, was du beitragen möchtest.', 'Bei welchen Beschwerden haben Patienten eine Linderung erlebt? Die Community sammelt Erfahrungen zu einzelnen Symptomen. So findest du Berichte zu Beschwerden, die du selbst kennst.'],
      wirkung: ['Was du erlebt hast, kann Patienten helfen, ihre Fragen an die Therapie zu finden. Jede Angabe zählt.',
        'Wie ging es Patienten mit dieser Therapie? Die Community sammelt Erfahrungen dazu, wie sich der Gesamtzustand verändert hat und für wen die Therapie ein entscheidender Schritt zur Genesung war.'],
      termin: ['Deine Erfahrung mit Durchführung und Belastung hilft Patienten, ihren Alltag rund um die Therapie zu planen.',
        'Wie könnte die Therapie in deinen Alltag passen? Die Community sammelt Erfahrungen dazu, wo und wie die Therapie durchgeführt wurde und wie Patienten das Crash-Risiko einschätzen.'],
      zugang: ['Dein Weg zur Therapie und deine ungefähren Kosten geben Patienten eine Vorstellung davon, womit sie rechnen können.',
        'Wie sind Patienten an die Therapie gekommen und was haben sie selbst bezahlt? Die Community sammelt Erfahrungen zu Zugangswegen, Kosten pro Einheit und Kosten für den gesamten Verlauf.'],
      anreise: ['Du hast schon etwas beigetragen? Danke dafür. Hier kannst du bei Bedarf noch nach Behandler:innen schauen.',
        'Wenn du die Therapie weiter erkunden möchtest, kannst du hier nach Behandler:innen in deiner Nähe schauen.'],
      alternativen: ['Danke, dass du dir Zeit für die Community genommen hast. Hier kannst du zum Abschluss noch verwandte Behandlungen ansehen.',
        'Vielleicht findest du hier eine weitere Behandlung, über die du dich informieren möchtest. Schau dir mögliche Alternativen und verwandte Therapien an.']
    };
    const doctorIntroductions = {
      wirkung: [
        contributionPrompt,
        'Kann dir diese Behandlung helfen – und wenn ja, wie sehr? Hier teilt die Community ihre Erfahrungen. Sie zeigen dir, ob und in welchem Maß Patienten von der Behandlung profitiert haben. Das kann dir eine erste Orientierung geben, was du selbst erwarten könntest – auch wenn die Wirkung von Person zu Person unterschiedlich ist.'
      ],
      termin: [
        contributionPrompt,
        'Wie lässt sich ein Termin mit deiner Belastbarkeit vereinbaren? Die Community sammelt Erfahrungen zur Anpassung der Termine und dazu, welche Terminformen möglich waren.'
      ],
      zugang: [
        contributionPrompt,
        'Mit welchen Kosten und Wartezeiten kannst du rechnen? Die Community sammelt Angaben zu selbst getragenen Behandlungskosten und zur Wartezeit auf Erst- und Folgetermine.'
      ],
      symptome: [
        'Klicke auf die Symptome, die sich bei dir während der Behandlung verbessert haben, oder ergänze entsprechende Symptome.',
        'Bei welchen Beschwerden haben Patienten während der Behandlung eine Linderung erlebt? Die Community sammelt diese Erfahrungen nach Symptomen, damit du Angaben zu deinen Beschwerden leichter findest.'
      ],
      therapien: [
        'Bestätige, welche Therapien hier angeboten werden, widersprich unzutreffenden Zuordnungen oder ergänze fehlende Therapien.',
        'Welche Therapien bietet diese Praxis an? Die Übersicht bündelt recherchierte Zuordnungen und Rückmeldungen der Community zum Therapieangebot.'
      ],
      anreise: [
        'Auf der Karte siehst du die Praxisstandorte.',
        'Wie weit ist es bis zur Praxis? Auf der Karte siehst du die Standorte und kannst den Anreiseaufwand von deinem Ausgangsort aus einschätzen.'
      ]
    };
    const doctorTopics = {
      wirkung: [
        {
          title: 'Genesungsfortschritt', selector: '.effect-chart', answers: 'Angaben',
          reading: communityRating.readingIntro,
          readingNote: communityRating.readingClosing
        }
      ],
      termin: [
        {
          title: 'Long-Covid-gerechter Termin', selector: '.adaptation-matched', answers: 'Angaben',
          review: 'Hier fasst die Community zusammen, welche Belastung bei einem Termin vor Ort auf Betroffene zukommt. Die fünf Stufen bauen auf den unten nummerierten Kriterien auf. Wähle in der Abbildung die Stufe, die am besten zu deiner Erfahrung passt.',
          reading: 'Die Community sammelt Erfahrungen dazu, wie gut Termine vor Ort an die Belastbarkeit angepasst waren. Je mehr der folgenden Kriterien erfüllt waren, desto höher ist die Stufe.',
          reviewOptions: [
            ['Hohe Belastung', '0 von 4 Kriterien erfüllt.'],
            ['Etwas belastender', '1 von 4 Kriterien erfüllt.'],
            ['Gut angepasst', '2 von 4 Kriterien erfüllt.'],
            ['Sehr gut angepasst', '3 von 4 Kriterien erfüllt.'],
            ['Individuell anpassbar', '4 von 4 Kriterien erfüllt. Insbesondere individueller Rückzug (Kriterium 4).']
          ],
          reviewCriteria: [
            ['Kurze Wartezeit', 'Du musstest vor Ort nur kurz warten, bis du an der Reihe warst.'],
            ['Ruhiges Wartezimmer', 'Im Wartebereich war es ruhig, etwa ohne laute Gespräche oder klingelnde Telefone.'],
            ['Warten im Liegen möglich', 'Du konntest dich schon beim Warten hinlegen, etwa auf einer Liege.'],
            ['Rückzug möglich', 'Du konntest dich beim Warten bei Bedarf zurückziehen, etwa in einen separaten ruhigen Raum.']
          ],
          options: [
            ['Wartezeit', 'Wie lange dauerte das Warten vor Ort?'],
            ['Wartezimmer', 'War der Wartebereich ruhig?'],
            ['Warten im Liegen', 'Konntest du dich beim Warten hinlegen?'],
            ['Rückzug', 'Konntest du dich bei Bedarf zurückziehen?']
          ]
        },
        {
          title: 'Terminform', selector: '.appointment-variant', answers: 'Einzelangaben',
          review: 'Unter „Terminform“ sammelt die Community, ob Erst- und Folgetermine vor Ort, per Telefon oder per Video möglich sind. Klicke dazu auf die Zahl für **Möglich** oder **Nicht möglich** links oder rechts neben dem jeweiligen Balken.',
          reviewNote: 'Telefon- und Videotermine können für Long-Covid-Betroffene mit geringer Belastbarkeit eine Erleichterung sein, weil die Anfahrt entfällt.',
          reviewOptions: [],
          reading: 'Die Community meldet, ob Termine vor Ort, per Telefon oder per Video möglich waren. Die Tabelle zeigt die Angaben getrennt für Erst- und Folgetermine.',
          options: [
            ['Ersttermin', 'Hier geht es um den ersten Termin vor Ort, per Telefon oder per Video.'],
            ['Folgetermin', 'Hier geht es um dieselben Terminformen für weitere Termine.']
          ],
          readingNote: 'Eine Person kann mehrere Angaben machen. Die Gesamtzahl zählt die einzelnen Antworten.'
        }
      ],
      zugang: [
        {
          title: 'Behandlungskosten (Eigenanteil)', selector: '.cost-heading', answers: 'Angaben', insurance: true,
          review: 'Unter „Behandlungskosten (Eigenanteil)“ sammelt die Community Angaben dazu, was Patienten für Untersuchungen und Behandlungen in dieser Praxis selbst bezahlt haben.',
          reviewOptionsIntro: 'Gib danach an, wie viel du selbst bezahlt hast. Ziehe vom Gesamtbetrag ab, was deine Krankenversicherung übernommen hat, und wähle die passende Kostenspanne.',
          reviewOptions: [
            ['Komplett übernommen', 'Die Krankenkasse oder Versicherung hat die Kosten vollständig getragen.'],
            ['Kostenspannen', 'Die Stufen ordnen den ungefähr selbst bezahlten Betrag ein. Läuft deine Behandlung noch, schätze deinen gesamten Eigenanteil. Falls das schwierig ist, reicht der Betrag, den du bisher selbst bezahlt hast.']
          ],
          reading: 'Die Auswertung zeigt die selbst getragenen Kosten für das gewählte Land und die gewählte Versicherungsart. Die Beträge stammen aus Angaben der Community.',
          options: [
            ['Komplett übernommen', 'Die Krankenkasse oder Versicherung hat die Kosten vollständig getragen.'],
            ['Kostenspannen', 'Die Stufen ordnen den ungefähr selbst bezahlten Betrag ein.']
          ],
          readingNote: 'Die Kosten beziehen sich auf die bisherigen Untersuchungen und Behandlungen. Der Umfang kann von Person zu Person unterschiedlich sein.'
        },
        {
          title: 'Wartezeit auf den Ersttermin', selector: '[data-choice="wait"]', answers: 'Angaben',
          review: 'Unter „Wartezeit auf den Ersttermin“ sammelt die Community, wie lange Patienten auf ihren ersten Termin gewartet haben. Wähle in der Abbildung die Stufe, die zu deiner Wartezeit passt.',
          reading: 'Die Balken zeigen, wie lange Patienten aus der Community auf ihren ersten Termin gewartet haben. Die aktuelle Verfügbarkeit kann davon abweichen.'
        },
        {
          title: 'Wartezeit auf Folgetermine', selector: '[data-choice="wait-followup"]', answers: 'Angaben',
          review: 'Unter „Wartezeit auf Folgetermine“ sammelt die Community, wie lange Patienten auf einen weiteren Termin gewartet haben. Wähle in der Abbildung die Stufe, die zu deiner Wartezeit passt.',
          reading: 'Die Balken zeigen die Wartezeiten, die die Community für weitere Termine gemeldet hat. Vergleiche sie mit der Wartezeit auf den Ersttermin.'
        }
      ],
      symptome: [
        {
          title: 'Bei welchen Symptomen hat dir die behandelnde Person geholfen?', disclosureKey: 'Symptome',
          selector: '[data-doctor-symptom-help]', answers: 'Symptome',
          review: 'Unter „Symptome“ sammelt die Community, bei welchen Beschwerden Patienten während der Behandlung eine Linderung erlebt haben. Du kannst mehrere Symptome angeben.',
          reading: 'Die Zahl neben einem Symptom zeigt, wie oft die Community eine Linderung gemeldet hat. Eine Person kann mehrere Symptome angeben.',
          reviewOptions: [
            ['Vorhandene Symptome auswählen', 'Wähle die passenden Symptome in der Liste. Durch erneutes Auswählen nimmst du deine Angabe zurück.'],
            ['Weitere Symptome ergänzen', 'Suche unter „Weiteres Symptom auswählen“ nach einem passenden Eintrag.']
          ],
          readingNote: 'Die Liste erfasst berichtete Linderungen. Für eine Erfolgsquote wären auch Angaben von Personen nötig, die beim selben Symptom keine Linderung erlebt haben.'
        }
      ],
      therapien: [
        {
          title: 'Therapien', disclosureKey: 'Einträge ansehen und vergleichen', selector: '#treatment-section',
          review: 'Unter „Therapien“ sammelt die Community, welche Behandlungen in dieser Praxis angeboten werden. Wenn eine Therapie fehlt, die du hier gemacht hast, kannst du sie unten über „Therapie hinzufügen“ ergänzen.',
          reading: 'Wenn Therapien zugeordnet sind, kannst du nach Namen suchen und nach Kategorien filtern. Unter „Tabelle“ und „Kacheln“ kannst du die Einträge vergleichen. Über den Namen gelangst du zur jeweiligen Therapieseite.'
        },
        {
          title: 'Zuordnungen prüfen und ergänzen', selector: '#treatment-section', publishedOnly: true, readingOnly: true,
          reading: 'Die Zahlen neben **Zustimmen (✓)** und **Widersprechen (×)** zählen Rückmeldungen dazu, ob eine Therapie hier angeboten wird. Erfahrungen zur Wirkung findest du auf der jeweiligen Therapieseite.'
        }
      ],
      anreise: [
        {
          title: 'Anreiseaufwand', selector: '.travel-estimate',
          review: 'Gib bei „Adresse, PLZ oder Ort“ deinen Ausgangsort ein und wähle „Standort übernehmen“. Unter „Anreiseaufwand“ siehst du dann die Luftlinienentfernung und eine grobe Einschätzung der Fahrzeit. Sind Erst- und Folgetermin online möglich, entfällt für beide die Anreise.',
          reviewOptions: [],
          reading: 'Die Entfernungsstufe nutzt die Luftlinie von deinem Ausgangsort. Die Fahrzeit dient als grobe Orientierung. Hinweise zur Terminform findest du unter „Belastungseinschätzung“.',
          options: [
            ['Erst- und Folgetermin online', 'Wenn beide Termine online möglich sind, entfällt die Anreise zu diesen Terminen.']
          ]
        },
        {
          title: 'Karte', selector: '#doctor-detail-map', readingOnly: true,
          reading: 'Auf der Karte siehst du die Praxisstandorte. Gib unter „Adresse, PLZ oder Ort“ deinen Ausgangsort ein und wähle „Standort übernehmen“, um die Entfernung zu sehen.'
        }
      ]
    };
    let mode = '';
    let minimized = false;
    let providerCount = doctor ? 0 : JSON.parse(content.querySelector('#anreise .nd-map-data').textContent).length;
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

    function entryState(id) {
      try {
        return JSON.parse(sessionStorage.getItem(storagePrefix + id));
      } catch { return null; }
    }

    function restore() {
      const state = entryState(entryId);
      mode = validMode(state?.mode);
      minimized = state?.minimized === true;
      providerContributed = state?.providerContributed === true;
      relationshipContributions = state?.relationshipContributions || {};
      finishedSections = state?.finishedSections || {};
    }

    function save() {
      try { sessionStorage.setItem(storagePrefix + entryId, JSON.stringify({mode, minimized, providerContributed, relationshipContributions, finishedSections})); } catch {}
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
      const sourceId = doctor ? profileId(source.searchParams)
        : source.searchParams.get('treatment_id') || source.searchParams.get('treat_id');
      if (!sourceId || sourceId === entryId) return;

      const sourceState = entryState(sourceId);
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
      const countryIntro = 'Für ' + countryName + ' stehen zur Auswahl:';
      scope.querySelectorAll('[data-guide-insurance-intro]').forEach(node => {
        updateText(node, node.dataset.guideInsuranceIntro === 'review'
          ? 'Wähle zuerst das Krankenversicherungssystem (Land) und die passende Versicherungsart aus. ' + countryIntro
          : countryIntro);
      });
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

    function shareEntry({providers = false, invitation, shareText} = {}) {
      const block = make('div', '', 'therapy-guide-sharing');
      const message = make('p');
      const url = new URL(location.pathname, location.origin);
      if (window.LCNDummy?.available || ['lcn.localhost.test', 'localhost.test'].includes(url.hostname)) {
        url.href = 'https://long-covid-navigator.de/' + (doctor ? 'arzt_detail.html' : 'therapie_detail.php');
      }
      if (doctor) url.searchParams.set(profileParam, params.get(profileParam));
      else url.searchParams.set('treatment_id', entryId);
      url.searchParams.set('anliegen', 'erfahrung');
      url.hash = 'ueberblick';
      const text = shareText ?? (doctor ? 'Warst du hier in Behandlung? Teile deine Erfahrung im Long Covid Navigator.'
        : providers
        ? 'Kennst du Behandler:innen für diese Therapie aus eigener Erfahrung? Schau dir die Einträge im Long Covid Navigator an, bestätige oder korrigiere Angaben und ergänze fehlende Behandler:innen. Teile deine Behandlungserfahrung im jeweiligen Praxiseintrag.'
        : 'Kennst du diese Therapie aus eigener Erfahrung? Teile sie im Long Covid Navigator.');
      const actions = make('div', '', 'experience-guide-actions');
      const status = make('p');
      status.setAttribute('role', 'status');
      const fallback = make('input');
      fallback.type = 'url';
      fallback.readOnly = true;
      fallback.hidden = true;
      fallback.value = url.href;
      fallback.setAttribute('aria-label', doctor ? 'Link zum Behandler:innen-Profil' : 'Link zur Therapie');
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
      return {block, message, invitation, providers};
    }

    function formatShareInvitation(node, message) {
      // Rebuild the formatting only when the wording changes.
      if (node.dataset.message === message) return;
      node.dataset.message = message;
      const parts = message.split('? ');
      if (parts.length > 1) {
        node.replaceChildren(make('strong', parts.shift() + '?'), make('span', parts.join('? ')));
      } else updateText(node, message);
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
        const message = sharing.invitation ?? (sharing.providers
          ? 'Kennst du jemanden, der diese Therapie schon bei einer Behandler:in gemacht hat? Leite diese Seite weiter und lade die Person ein, Angaben zu bestätigen oder zu korrigieren, fehlende Behandler:innen zu ergänzen und ihre Erfahrung im jeweiligen Praxiseintrag zu teilen.'
          : count === 0
          ? 'Kennst du jemanden, der diese Therapie ausprobiert hat? Lade die Person ein, ihre Erfahrung zu teilen. Das hilft dir und Patienten bei der Orientierung.'
          : 'Kennst du jemanden, der diese Therapie ausprobiert hat? Jede weitere Erfahrung hilft, die Therapie besser einzuschätzen.');
        formatShareInvitation(sharing.message, message);
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
      if (!card) return false;
      if (doctor) return !!card.querySelector('[data-choice][aria-pressed="true"], [data-symptom-id][aria-pressed="true"]');
      if(card.dataset.guideContribution === 'provider') return providerContributed;
      if(card.dataset.guideContribution) return relationshipContributions[card.dataset.guideContribution] === true;
      return !!card.querySelector('[data-option][aria-pressed="true"], [data-symptom-id][aria-pressed="true"]');
    }

    function updateProgress() {
      const doneEntries = entries.map(({card, selector, disclosure}) => {
        const done = answered(doctor ? doctorTopicCard(selector) : card);
        disclosure?.classList.toggle('is-complete', mode === 'review' && done);
        const summary = disclosure?.querySelector('summary');
        if (summary) summary.setAttribute('aria-label', summary.textContent + (mode === 'review' ? (done ? ' – Angabe gespeichert' : ' – noch offen') : ''));
        return done;
      });
      views.forEach(link => {
        const view = link.dataset.view;
        const useOwnAnswers = doctor && mode === 'review' && link.hasAttribute('data-own-answers');
        const cards = doctor ? [] : [...document.getElementById(view).querySelectorAll('[data-question], .ux-symptom-help')];
        const finished = !useOwnAnswers && finishedSections[view] === true;
        const done = useOwnAnswers ? link.dataset.ownAnswers === 'true'
          : finished || (view === 'anreise' && providerContributed) || (view === 'alternativen' && Object.values(relationshipContributions).some(Boolean)) || (cards.length > 0 && cards.every(answered));
        link.classList.toggle('therapy-section-complete', done);
        const number = link.querySelector('.nav-number');
        number?.setAttribute('aria-label', finished ? 'Für dich abgeschlossen' : done ? 'Beitrag gespeichert' : '');
      });
      if (completion) {
        const count = doneEntries.filter(Boolean).length;
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
        updateText(node, !loaded ? '' : count === 0 ? '(Noch keine Angabe vorhanden)' : count < 10 ? 'Bisher wenige Angaben' : 'Zahlreiche Angaben vorhanden');
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
      if (doctor && link.hasAttribute('aria-label')) return link.getAttribute('aria-label');
      return link.querySelector('strong').textContent.replaceAll('­', '');
    }

    function doctorTopicCard(selector) {
      return panel?.querySelector(selector)?.closest('.card');
    }

    function renderDoctorTopics(review) {
      const withHighlights = text => text.split(/(„[^“]+“|\*\*[^*]+\*\*)/).map((part, i) => {
        if (i % 2 === 0) return part;
        return part.startsWith('**') ? make('strong', part.slice(2, -2)) : make('u', part.slice(1, -1));
      });
      return (doctorTopics[panel.id] || []).flatMap(topic => {
        const {title, disclosureKey, selector, answers, insurance, options, reviewOptions, readingNote, publishedOnly} = topic;
        if ((review && topic.readingOnly) || !doctorTopicCard(selector) || (publishedOnly && profileParam !== 'id')) return [];
        const disclosure = make('details');
        const summary = make('summary', title);
        const isEffect = selector === '.effect-chart';
        if (isEffect) disclosure.dataset.disclosureKey = 'effect';
        else if (disclosureKey) disclosure.dataset.disclosureKey = disclosureKey;
        const ratingContribution = review && isEffect;
        disclosure.append(summary);
        if (ratingContribution) {
          appendCommunityRating(disclosure);
        } else {
          const description = make('p');
          description.append(...withHighlights(review ? topic.review : topic.reading));
          disclosure.append(description);
          if (isEffect) disclosure.append(communityRatingOptions(false));
        }
        if (answers && !review) {
          const count = make('span', '', 'therapy-guide-answer-count');
          count.dataset.guideAnswerCount = '';
          count.hidden = true;
          summary.append(' ', count);
        }
        if (insurance) {
          const intro = make('p');
          intro.dataset.guideInsuranceIntro = review ? 'review' : 'reading';
          const list = make('ul', '', 'therapy-guide-options');
          list.dataset.guideInsuranceList = '';
          disclosure.append(intro, list);
          refreshInsuranceHelp(disclosure);
        }
        const choices = review ? reviewOptions || options : options;
        const criteria = review ? topic.reviewCriteria : null;
        if (!ratingContribution && choices?.length) {
          if (review && topic.reviewOptionsIntro) disclosure.append(make('p', topic.reviewOptionsIntro));
          const list = make('ul', '', 'therapy-guide-options');
          if (criteria) list.classList.add('therapy-guide-stage-options');
          for (const [label, text] of choices) {
            const item = make('li');
            const detail = make('span');
            detail.append(...withHighlights(text));
            item.append(make('strong', label + ':'), detail);
            list.append(item);
          }
          disclosure.append(list);
        }
        if (criteria) {
          const cards = make('ul', '', 'therapy-guide-options therapy-guide-criteria');
          for (const [index, [label, text]] of criteria.entries()) {
            const item = make('li');
            const number = make('span', String(index + 1), 'therapy-guide-access-number');
            item.append(number, make('strong', label), make('span', text));
            cards.append(item);
          }
          const heading = make('p');
          heading.append(make('strong', 'Kriterien für die Einstufung'));
          disclosure.append(heading, cards);
        }
        const note = review ? topic.reviewNote : readingNote;
        if (note) disclosure.append(make('p', note));
        if (answers) entries.push({selector, disclosure, answers});
        return [disclosure];
      });
    }

    function refreshDoctorTopics() {
      for (const {selector, disclosure, answers} of entries) {
        const badge = disclosure.querySelector('[data-guide-answer-count]');
        if (!badge) continue;
        const rawCount = doctorTopicCard(selector)?.dataset.guideAnswerCount;
        const count = Number(rawCount);
        badge.hidden = rawCount === undefined;
        if (badge.hidden) {
          updateText(badge, '');
          continue;
        }
        const unit = answers === 'Einzelangaben'
          ? (count === 1 ? 'Einzelangabe' : 'Einzelangaben')
          : (count === 1 ? 'Angabe' : 'Angaben');
        const label = answers === 'Symptome' ? 'bis zu ' + count + ' ' + unit + ' je Symptom' : count + ' ' + unit;
        updateText(badge, '(' + label + ')');
      }
      updateProgress();
    }

    function classificationContext(section) {
      const fields = [...section.querySelectorAll('.ux-stage-column')].map(column => ({
        column,
        label: column.getAttribute('aria-label'),
        nodes: [...column.querySelectorAll('.ux-stage-node')].filter(node => !node.closest('[hidden]'))
      }));
      const current = section.querySelector('.ux-stage-node[aria-current="page"]');
      const index = fields.findIndex(({column}) => column.contains(current));
      return {fields, current, index};
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

    function appendRelationshipTopic(body, key, selector, title, description) {
      const card = panel.querySelector(selector);
      if (!card) return null;

      card.dataset.guideContribution = key;
      const disclosure = make('details');
      disclosure.append(make('summary', title ?? card.querySelector('h3')?.firstChild?.textContent.trim()));
      if (description) disclosure.append(make('p', description));
      body.push(disclosure);

      const entry = {card, disclosure};
      entries.push(entry);
      return entry;
    }

    function renderAlternativesTopics(body, copy) {
      const topics = [
        ['alternative', '.ux-alternative-section', 'Alternative Therapien'],
        ['classification', '[data-relationship-stages]'],
        ['combination', '[data-combination-section]']
      ];
      for (const [key, selector, title] of topics) {
        const topic = copy.topics[key];
        const entry = appendRelationshipTopic(body, key, selector, title, topic?.description);
        if (!entry) continue;

        const {card, disclosure} = entry;
        if (key === 'classification') {
          disclosure.classList.add('therapy-guide-classification');
          entry.refreshClassification = () => copy.renderClassification(disclosure, card);
          entry.refreshClassification();
        } else if (topic.voting) {
          const section = make('section');
          const heading = make('h4', copy.votingTitle);
          heading.style.marginInlineStart = '.9rem';
          section.append(heading, make('p', topic.voting));
          disclosure.append(section);
        }
      }
    }

    function refreshClassificationGuide() {
      const entry = entries.find(({refreshClassification}) => refreshClassification);
      entry?.refreshClassification();
    }

    function paint(force = false) {
      const active = content.querySelector(doctor ? '.nd-panel[data-profile-loaded]' : '.nd-panel:not([hidden])');
      if (!active) return;
      if (!force && panel === active) {
        if (doctor) updateProgress();
        return;
      }
      const welcome = active.querySelector('[data-doctor-welcome], [data-therapy-welcome]');
      const collapsed = orientationIsOff();
      if (doctor && !force && panel?.id === active.id) {
        panel = active;
        if (guide) (collapsed ? panel : welcome || panel).prepend(guide);
        refreshDoctorTopics();
        return;
      }
      guide?.remove();
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
      let eyebrow = review ? 'Deine Erfahrung zählt' : ({
        anreise: doctor ? 'Anreise planen' : 'Behandler:innen finden',
        therapien: 'Therapieangebot erkunden'
      }[panel.id] || 'Erfahrungen einordnen');
      if (!review) guide.classList.add('therapy-guide-reading');
      const body = [make('p', doctor
        ? doctorIntroductions[panel.id]?.[review ? 0 : 1]
        : review ? (panel.querySelector('[data-question], .ux-symptom-help') ? contributionPrompt : encouragement[panel.id][0]) : encouragement[panel.id][1])];
      if (doctor && profileParam === 'submission_id') {
        if (panel.id === 'symptome') body[0].textContent = 'Hier werden nach der Freigabe des Profils Erfahrungen zur Linderung einzelner Beschwerden gesammelt.';
        if (panel.id === 'therapien') body[0].textContent = 'Hier siehst du, welche Therapien dem vorgeschlagenen Profil bereits zugeordnet sind.';
      }
      if (!doctor && review && panel.id === 'symptome') body[0].textContent = 'Klicke auf die Symptome, die sich bei dir durch diese Therapie verbessert haben, oder ergänze entsprechende Symptome.';
      if (!doctor && !review && panel.querySelector('[data-question], .ux-symptom-help')) {
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
      const cards = doctor ? [] : panel.querySelectorAll('[data-question], .ux-symptom-help');
      if (doctor) {
        body.push(...renderDoctorTopics(review));
        if (review && panel.id === 'therapien' && profileParam === 'id' && doctorTopicCard('#treatment-section')) {
          body.push(feedbackNote('Mit Zustimmen (✓) bestätigst du, dass die Praxis die Therapie anbietet. Mit Widersprechen (×) widersprichst du der Zuordnung. Deine Rückmeldung bezieht sich auf das Therapieangebot, nicht auf die Qualität oder Wirksamkeit der Behandlung.'));
        }
        if (!review && entries.length && profileParam === 'id') {
          sharing = shareEntry();
          const question = panel.id === 'wirkung'
            ? 'Kennst du jemanden, der bei diesem Behandler oder bei dieser Behandlerin in Therapie war?'
            : 'Kennst du jemanden, der hier behandelt wurde?';
          formatShareInvitation(sharing.message, question + ' Lade die Person ein, ihre Erfahrung zu teilen.');
        }
      } else if (cards.length) {

        if (!review) {
          sharing = shareEntry();
        }
      } else if (panel.id === 'anreise' && !review) {
        body[0].textContent = 'Wer bietet diese Therapie in deiner Nähe an? Die Community sammelt Behandler:innen und ihre Standorte. Auf der Karte kannst du nach einem Ort suchen und den Anreiseaufwand vergleichen.';
        const help = [
          ['Anreiseaufwand', 'Die hervorgehobene Stufe bezieht sich auf den nächstgelegenen Eintrag in deiner Auswahl. Sie nutzt die Luftlinie von deinem Ausgangsort. Die Fahrzeit dient als grobe Orientierung. Sind Erst- und Folgetermin online möglich, entfällt die Anreise zu diesen Terminen.'],
          ['Karte', 'Auf der Karte findest du Behandler:innen für diese Therapie in deiner Nähe. Gib dazu eine Adresse, Postleitzahl oder einen Ort ein und übernimm den Standort.'],
          ['Einträge ansehen und vergleichen', 'Vergleiche die Behandler:innen in der Kachel- oder Tabellenansicht. Öffne einen Eintrag, um mehr über das Angebot der Praxis zu erfahren.'],
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
        sharing = shareEntry({providers: true});
        body.push(sharing.block);
      }
      cards.forEach(card => {
        const topic = topics[card.dataset.question || 'symptoms'];
        if (!topic) return;
        const compactSymptoms = mode === 'explore' && card.matches('.ux-symptom-help, [data-question="symptoms"]');
        const readingTopics = {
          effect: {
            intro: communityRating.readingIntro,
            closing: communityRating.readingClosing
          },
          gamechanger: {
            intro: 'Als Gamechanger gilt eine Therapie, die den Genesungsprozess entscheidend vorangebracht hat. Hier siehst du, wie häufig die Community das für diese Therapie berichtet.',
            options: [
              'Ja: Die ausgewählte Therapie hat den Genesungsprozess entscheidend vorangetrieben.',
              'Nein: Die ausgewählte Therapie hat den Genesungsprozess leider nicht entscheidend vorangetrieben.'
            ],
            closing: 'Ein Nein bedeutet nicht automatisch, dass sie gar nicht geholfen hat; ein Ja bedeutet nicht automatisch Heilung. Lies diese Angabe deshalb zusammen mit den Angaben zum Genesungsfortschritt und beachte die Anzahl der Angaben.'
          }
        };
        Object.assign(readingTopics, {
          setting: {
            intro: 'Hier erfasst die Community, wo und in welchem Rahmen Patienten die Therapie angewendet haben. Diese Angabe hilft dir einzuschätzen, welcher Aufwand damit für dich verbunden wäre und ob der Rahmen zu dir passt. Die Antworten werden in vier Kategorien erfasst:',
            options: mode === 'explore' ? [
              'Selbstständig zu Hause: Die Therapie findet zu Hause und ohne Fachpersonal statt.',
              'Hausbesuch: Die Therapie findet zu Hause und mit Fachpersonal statt.',
              'Ambulant: Die Therapie findet bei einzelnen Terminen vor Ort statt, etwa in einer Praxis.',
              'Stationär: Die Therapie findet während eines Aufenthalts mit Übernachtung in einer Einrichtung statt.'
            ] : [
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
            intro: 'Die Community sammelt Erfahrungen dazu, wie Patienten Zugang zu dieser Therapie bekommen haben. Die vier Zugangswege unterscheiden sich im Aufwand.',
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
        if (card.dataset.question === 'effect') disclosure.dataset.disclosureKey = 'effect';
        disclosure.append(make('summary', title));
        if (!review) {
          const countLabel = make('span', '', 'therapy-guide-answer-count');
          countLabel.dataset.guideAnswerCount = '';
          disclosure.querySelector('summary').append(document.createTextNode(' '), countLabel);
        }
        if (compactSymptoms) {
          disclosure.append(make('p', 'Hier sammelt die Community, bei welchen Symptomen Patienten eine Linderung durch diese Therapie erlebt haben. Die Zahl neben dem Symptom zeigt, wie oft eine Linderung gemeldet wurde. Eine Person kann mehrere Symptome angeben. Nennungen sind keine Erfolgsquote: Angaben zu ausgebliebener Linderung werden hier nicht erfasst.'));
        } else if (instructions === communityRating) {
          appendCommunityRating(disclosure);
        } else if (card.dataset.question === 'effect') {
          disclosure.append(make('p', instructions.intro), communityRatingOptions(false), make('p', instructions.closing));
        } else if (instructions) {
          const list = make('ul', '', 'therapy-guide-options');
          if (card.dataset.question === 'access') list.classList.add('therapy-guide-access-options');
          instructions.options.forEach(option => {
            const item = make('li');
            const separator = option.indexOf(': ');
            const label = separator >= 0 ? option.slice(0, separator)
              : option.startsWith('Wähle ') ? 'Symptome auswählen' : 'Weitere Symptome suchen';
            const explanation = separator >= 0 ? option.slice(separator + 1).trim() : option;
            const description = make('span', explanation);
            if (card.dataset.question === 'setting' && mode === 'explore') {
              const parts = explanation.split(/\b(zu Hause|ohne|mit Übernachtung|mit|vor Ort)\b/);
              description.replaceChildren(...parts.map((part, index) => index % 2 ? make('u', part) : part));
            }
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
            const insuranceIntro = make('p');
            insuranceIntro.dataset.guideInsuranceIntro = review ? 'review' : 'reading';
            if (!review) {
              disclosure.append(make('p', 'Die Auswertung zeigt die Angaben für das gewählte Land und die gewählte Versicherungsart.'));
            }
            disclosure.append(insuranceIntro, insuranceList, make('p', instructions.optionsIntro));
            refreshInsuranceHelp(disclosure);
          }
          disclosure.append(list, make('p', instructions.closing));
        } else disclosure.append(make('p', topic[1]));
        const example = review || compactSymptoms ? null : make('p');
        if (example) disclosure.append(example);
        body.push(disclosure);
        entries.push({card, example, disclosure});
      });
      if (!doctor && panel.id === 'alternativen') {
        const createAlternativesContent = review ? window.LCNTherapyAlternativesContribution : window.LCNTherapyAlternativesReading;
        const diagnostic = panel.querySelector('[data-combination-section]')?.hasAttribute('data-diagnostic-combinations');
        const copy = createAlternativesContent({make, classificationContext, fieldReference, classificationContents, relationshipTypeLabels, diagnostic});
        eyebrow = copy.eyebrow;
        body[0].textContent = copy.introduction;
        renderAlternativesTopics(body, copy);
        if (copy.feedbackNote) body.push(feedbackNote(copy.feedbackNote));
        if (copy.sharing) sharing = shareEntry(copy.sharing);
      } else if (!doctor && review && panel.id === 'anreise') {
        body[0].textContent = 'Bestätige, wer diese Therapie anbietet, widersprich unzutreffenden Zuordnungen oder ergänze fehlende Behandler:innen.';
        appendRelationshipTopic(body, 'provider', '.nd-provider-map', 'Behandler:innen und Erfahrungen',
          'Hier erfasst die Community, wo man Hilfe erhalten und die ausgewählte Therapie in Anspruch nehmen kann. Wähle einen Ort aus, um auf der Karte Behandler:innen in der Nähe zu finden. Die Liste zeigt dir außerdem Alternativen, wenn du mit deiner bisherigen Behandler:in nicht zufrieden bist und die Therapie weiterführen möchtest. Deine Erfahrung mit der Behandlung kannst du im jeweiligen Eintrag teilen.');
        body.push(feedbackNote('Mit Zustimmen (✓) stimmst du der Angabe zu, dass die jeweilige Behandler:in diese Therapie anbietet. Mit Widersprechen (×) widersprichst du dieser Angabe. Deine Rückmeldung bezieht sich auf das Therapieangebot, nicht auf die Qualität oder Wirksamkeit der Behandlung.'));
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
        if (!doctor && mode === 'explore') {
          thanks.classList.add('therapy-finish-dialog');
          const polls = make('div');
          const invitation = shareEntry();
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
        } else if (doctor && !review) {
          const title = 'Danke, dass du dich umgesehen hast!';
          thanks.setAttribute('aria-label', title);
          illustrated(thanks, 'Zum Abschluss', make('h2', title),
            make('p', 'Du kannst jederzeit zurückkommen, weiterlesen oder ein anderes Anliegen wählen.'), thanksActions);
        } else illustrated(thanks, 'Für heute geschafft', make('h2', 'Danke, dass du dabei bist!'),
          make('p', 'Schön, dass du dir Zeit genommen hast, dich hier umzusehen und dein Wissen zu teilen. So wächst unser gemeinsames Wissen – und Patienten finden leichter ihren Weg.'),
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
      illustrated(guide, eyebrow, heading, ...body, actions);
      if (!review && sharing) {
        sharing.block.classList.add('therapy-guide-sharing-first');
        guide.querySelector('.experience-guide-copy').prepend(sharing.block);
      }
      panel.prepend(guide);
      if (doctor) refreshDoctorTopics();
      else refreshTopics();
    }

    const choices = doctor ? [
      ['review', 'Meine Erfahrung teilen', 'Berichte Schritt für Schritt, wie es dir mit der Behandlung und den Terminen ging. Du entscheidest, welche Fragen du beantworten möchtest.', 'wirkung', 'Erfahrung teilen'],
      ['travel', 'Anreise', 'Sieh dir die Praxisstandorte auf der Karte an und schätze die Entfernung von deinem Ausgangsort ein.', 'anreise', 'Anreise ansehen'],
      ['symptoms', 'Bei welchem Symptom berichtet die Community von einer Linderung?', 'Sieh nach, bei welchen Symptomen Patienten von einer Linderung berichten.', 'symptome', 'Symptome ansehen'],
      ['explore', 'Erfahrungen der Community ansehen', 'Lies, was Patienten über die Behandlung, die Belastung bei Terminen und die Kosten berichten.', 'wirkung', 'Erfahrungen ansehen'],
      ['treatments', 'Therapien dieser Praxis', 'Sieh dir recherchierte Therapieangebote und Rückmeldungen der Community an. Über den Namen gelangst du zur jeweiligen Therapieseite.', 'therapien', 'Therapien ansehen']
    ] : [
      ['review', 'Meine Erfahrung teilen', 'Berichte Schritt für Schritt, wie es dir mit der Therapie ging. Du entscheidest, welche Fragen du beantworten möchtest.', 'wirkung', 'Erfahrung teilen'],
      ['providers', 'Behandler:innen finden (Karte)', 'Sieh auf der Karte nach, wo diese Therapie angeboten wird. Gib einen Ort ein, um Einträge in deiner Nähe zu finden und die Anreise einzuschätzen.', 'anreise', 'Behandler:innen suchen'],
      ['symptoms', 'Bei welchem Symptom berichtet die Community von einer Linderung?', 'Sieh nach, bei welchen Symptomen Patienten von einer Linderung berichten.', 'symptome', 'Symptome ansehen'],
      ['explore', 'Erfahrungen der Community ansehen', 'Lies Schritt für Schritt, was Patienten über die Wirkung, den Aufwand und die Kosten dieser Therapie berichten.', 'wirkung', 'Erfahrungen ansehen'],
      ['alternatives', 'Therapiealternativen', 'Entdecke Alternativen, Anwendungsformen und Kombinationen, die die Community zu dieser Therapie zusammengetragen hat.', 'alternativen', 'Alternativen ansehen']
    ];

    function startView([value, , , view]) {
      if (!doctor && value === 'explore') {
        const first = views.find(link => !['ueberblick', 'anreise', 'alternativen'].includes(link.dataset.view) && hasInformation(link));
        if (first) return first;
      }
      return views.find(link => link.dataset.view === view);
    }

    let wheelSerial = 0;
    function addChoices(host, dialog) {
      host.classList.add('therapy-intent-carousel', 'therapy-intent-wheel');
      const instance = 'therapy-wheel-' + (++wheelSerial);
      let rowHeight = 52;
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
        const resuming = !dialog && value === mode;
        if (!doctor && value === 'explore' && !resuming && experienceCount() === 0) {
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
        if (!doctor && choice[0] === 'explore') {
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
        const spacerHeight = track.firstElementChild.offsetHeight;
        if (spacerHeight && spacerHeight !== rowHeight) {
          rowHeight = spacerHeight;
          track.scrollTop = (choices.length + current) * rowHeight;
          update();
        }
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
        viewport.style.height = Math.max(5 * rowHeight, 2.5 * rowHeight + Math.ceil(maximum)) + 'px';
        paintWheel();
      }
      new ResizeObserver(() => {
        if (measuredWidth !== header.clientWidth || rowHeight !== track.firstElementChild.offsetHeight) {
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
      const stay = () => {
        dialog.close();
        chooseMode('explore');
        paint(true);
        const heading = guide?.querySelector('h2, h3');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({preventScroll: true});
        }
      };
      const proceed = button('', () => {
        dialog.close();
        chooseMode('explore');
        if (panel?.id === destinationLink.dataset.view) paint(true);
        openView(destinationLink);
      }, true);
      proceed.autofocus = true;
      actions.append(proceed, button('Trotzdem wechseln', stay));
      if (mode && mode !== 'explore' && !orientationIsOff()) {
        actions.append(button('Zurück zum vorherigen Orientierungsmodus', () => dialog.close()));
      }

      const invitation = shareEntry();
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
      dialog.addEventListener('cancel', event => event.preventDefault());
      dialog.addEventListener('close', () => {
        listeners.abort();
        dialog.remove();
      }, {once: true});
      dialog.showModal();
    }

    restore();
    if (doctor) {
      window.addEventListener('lcn-doctor-rendered', () => paint());
      window.addEventListener('lcn-doctor-symptoms-rendered', refreshDoctorTopics);
      window.addEventListener('lcn-doctor-appointment-updated', refreshDoctorTopics);
    } else {
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
      document.addEventListener('lcn-treatment-view-changed', () => paint());
      document.addEventListener('lcn-combination-diagrams-changed', refreshClassificationGuide);
      window.addEventListener('lcn-relation-feedback', () => queueMicrotask(refreshClassificationGuide));
      // Refresh the counts in place to preserve any text selection in the guide.
      document.addEventListener('lcn-treatment-answers-rendered', refreshTopics);
    }
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        restore();
        paint(true);
      }
    });
    if (params.get('anliegen') === 'erfahrung') {
      mode = 'review';
      minimized = false;
      save();
      openView(views.find(link => link.dataset.view === 'ueberblick'));
    } else inheritOrientation();
    paint();
  }

})();

// Remember native disclosures, including guide panels mounted after page load.
(() => {
  const doctor = document.body.dataset.doctorPage === 'live';
  const root = doctor ? document.getElementById('view-content') : document.querySelector('.ux-detail[data-treatment-id]');
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const entryId = doctor
    ? (params.has('submission_id') ? 'submission:' + params.get('submission_id') : params.get('id'))
    : root.dataset.treatmentId;
  if (!entryId) return;
  const storageKey = (doctor ? 'lcn_doctor_disclosures:' : 'lcn_therapy_disclosures:') + entryId;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(storageKey)) || {}; } catch {}
  const initialized = new WeakSet();
  function restore() {
    root.querySelectorAll(doctor ? '.therapy-guide-note details' : 'details').forEach(details => {
      if (initialized.has(details)) return;
      initialized.add(details);
      const section = details.closest('.view-panel, [data-view-panel], section[id], [id]');
      const summary = details.querySelector(':scope > summary');
      const title = summary?.cloneNode(true);
      title?.querySelectorAll('[data-guide-answer-count]').forEach(node => node.remove());
      const prefix = (section?.id || 'page') + ':';
      const disclosureKey = details.dataset.disclosureKey;
      const key = prefix + (details.id || disclosureKey || title?.textContent.trim());
      const wasOpen = saved[key] ?? (disclosureKey === 'effect' ? saved[prefix + 'Community-Bewertung'] : undefined);
      if (typeof wasOpen === 'boolean') details.open = wasOpen;
      details.addEventListener('toggle', () => {
        saved[key] = details.open;
        try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
      });
    });
  }
  restore();
  new MutationObserver(restore).observe(root, {childList: true, subtree: true});
})();
