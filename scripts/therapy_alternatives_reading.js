window.LCNTherapyAlternativesReading = ({make, classificationContext, fieldReference, classificationContents, relationshipTypeLabels}) => {
  const groupFields = new Set(['Gruppe', 'Gruppen', 'Wirkstoffgruppen', 'Medikamentengruppe']);
  const applicationFields = new Set(['Anwendungsformen', 'Weitere Anwendungsformen']);
  const definitions = {
    therapyGroup: 'Eine Gruppe fasst verwandte Behandlungsverfahren unter einem Oberbegriff zusammen und gibt dir eine erste Orientierung.',
    substanceGroup: 'Eine Gruppe fasst verwandte Wirkstoffe oder Substanzen unter einem Oberbegriff zusammen und gibt dir eine erste Orientierung.',
    Verfahren: 'Ein Verfahren beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie.',
    Anwendung: 'Eine Anwendung beschreibt, wie die Therapie konkret durchgeführt werden könnte.',
    Wirkstoffe: 'Ein Wirkstoff beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie.',
    Substanz: 'Eine Substanz beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie.',
    'Wirkstoffe und Substanzen': 'Ein Wirkstoff bzw. eine Substanz beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie.',
    Anwendungsformen: 'Anwendungsformen umfassen Handelsnamen, Applikationen und Stoffvarianten zu einem Wirkstoff bzw. einer Substanz.'
  };
  const definitionAliases = {
    'Wirkstoffe und Substanzen (Kombination)': 'Wirkstoffe und Substanzen',
    'Übergeordnete Substanz': 'Substanz',
    'Weitere Anwendungsformen': 'Anwendungsformen',
    Anwendungsform: 'Applikation',
    Stoffvariante: 'Stoffvarianten'
  };
  const applicationDefinitions = {
    Handelsnamen: ['Ein ', 'Handelsname', ' ist der Produktname eines Präparats, das den übergeordneten Wirkstoff bzw. die Substanz enthält.'],
    Applikation: ['Eine ', 'Applikation', ' beschreibt, auf welchem Weg ein Wirkstoff bzw. eine Substanz verabreicht wird, etwa oral oder als Infusion.'],
    Stoffvarianten: ['Eine ', 'Stoffvariante', ' kann eine andere Form eines Wirkstoffs sowie Extrakte oder Präparate beschreiben, die den übergeordneten Wirkstoff bzw. die Substanz enthalten.']
  };

  function renderClassification(disclosure, section) {
    const previous = [...disclosure.querySelectorAll(':scope > p')];
    const paragraphs = classificationParagraphs(section);
    if (previous.length === paragraphs.length && previous.every((paragraph, index) => paragraph.isEqualNode(paragraphs[index]))) return;
    previous.forEach(paragraph => paragraph.remove());
    disclosure.append(...paragraphs);
  }

  function classificationIntro(current, label, substanceBranch) {
    const block = current.closest('.ux-stage-block')?.dataset.relationshipLabel;
    const paragraph = make('p', 'Die Community ordnet diese Therapie bei ');
    paragraph.append(make('strong', label));
    if (block && block !== label) paragraph.append(' unter ', make('strong', block));
    paragraph.append(' ein.');

    const key = groupFields.has(label)
      ? (substanceBranch ? 'substanceGroup' : 'therapyGroup')
      : definitionAliases[block || label] || block || label;
    const applicationDefinition = applicationDefinitions[key];
    if (applicationDefinition) {
      const [prefix, term, explanation] = applicationDefinition;
      paragraph.append(' ', prefix, make('strong', term), explanation);
    } else {
      const definition = definitions[key] || definitions[definitionAliases[label] || label];
      if (definition) paragraph.append(' ', definition);
    }
    return paragraph;
  }

  function classificationReferences(fields, index, substanceBranch) {
    const [left, middle, right] = fields;
    const leftField = [make('u', 'linken'), ' Feld'];
    const middleField = [make('u', 'mittleren'), ' Feld'];
    const rightField = [make('u', 'rechten'), ' Feld'];
    const filledFields = [];
    const emptyFields = [];
    const addEmptyField = (location, missing = ['keine Einträge']) => {
      emptyFields.push(emptyFields.length
        ? ['Auch im ', ...location, ' sind noch ', ...missing, ' hinterlegt.']
        : ['Leider sind noch ', ...missing, ' im ', ...location, ' hinterlegt.']);
    };

    if (index !== 0) {
      const isBaseSubstance = left.label === 'Übergeordnete Substanz';
      if (!left.nodes.length) {
        const missing = isBaseSubstance ? 'Substanz' : 'Gruppe';
        emptyFields.push(['Leider ist im ', ...leftField, ' noch keine übergeordnete ', make('u', missing), ' hinterlegt.']);
      } else {
        const searchTarget = substanceBranch
          ? 'nach verwandten Wirkstoffen oder Substanzen'
          : 'breiter nach verwandten Behandlungsverfahren';
        const purpose = isBaseSubstance ? 'mehr über den zugrunde liegenden Stoff erfahren' : searchTarget + ' suchen';
        filledFields.push(['Wenn du ', purpose, ' möchtest, schau im ', ...leftField, ' unter ', fieldReference(left), ' nach.']);
      }
    }
    if (index !== 1) {
      const name = fieldReference(middle);
      if (!middle.nodes.length) {
        addEmptyField([...middleField, ' unter ', name]);
      } else if (index === 0) {
        filledFields.push(['Wenn du dich für allgemeine Umsetzungsmöglichkeiten dieser Therapie interessierst, dann schau im ',
          ...middleField, ' unter ', name, ' nach.']);
      } else if (middle.label === 'Wirkstoffe und Substanzen') {
        filledFields.push(['Den zugehörigen ', make('u', 'Wirkstoff'), ' bzw. die ', make('u', 'Substanz'),
          ' findest du im ', ...middleField, '.']);
      } else {
        filledFields.push(['Im ', ...middleField, ' findest du die zugehörigen Einträge unter ', name, '.']);
      }
    }
    if (index !== 2) {
      const name = fieldReference(right);
      const location = [...rightField, ' unter ', name];
      if (!right.nodes.length) {
        if (index === 0 && right.label === 'Anwendung') addEmptyField(rightField, ['keine Einträge zur ', name]);
        else addEmptyField(location);
      } else if (applicationFields.has(right.label)) {
        const forms = right.label === 'Anwendungsformen' ? 'konkrete ' : '';
        filledFields.push(['Im ', ...rightField, ' findest du ', forms, name, '.']);
      } else if (right.label === 'Handelsnamen') {
        filledFields.push(['Im ', ...rightField, ' findest du ', name, '.']);
      } else {
        const destination = right.label === 'Anwendung' ? rightField : location;
        const description = new Intl.ListFormat('de').formatToParts(classificationContents(right.nodes)).flatMap(({type, value}) => {
          if (right.label === 'Anwendung' && type === 'element' && value === relationshipTypeLabels.has_detail) {
            return ['konkrete ', make('u', 'Anwendungen')];
          }
          return [value];
        });
        filledFields.push(['Im ', ...destination, ' findest du ', ...description, '.']);
      }
    }

    const paragraph = make('p');
    for (const sentence of [...filledFields, ...emptyFields]) {
      if (paragraph.hasChildNodes()) paragraph.append(' ');
      paragraph.append(...sentence);
    }
    return paragraph;
  }

  function classificationParagraphs(section) {
    const {fields, current, index} = classificationContext(section);
    if (index < 0) return [make('p', 'Hier siehst du, wie die Community den Eintrag einordnet.')];
    const substanceBranch = section.dataset.relationshipDomain
      ? section.dataset.relationshipDomain !== 'therapy'
      : fields[1]?.label !== 'Verfahren';
    const paragraphs = [classificationIntro(current, fields[index].label, substanceBranch)];
    const references = classificationReferences(fields, index, substanceBranch);
    if (references.hasChildNodes()) paragraphs.push(references);

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

  return {
    eyebrow: 'Erfahrungen verstehen',
    introduction: 'Du bist unsicher, ob diese Therapie zu dir passt, oder suchst nach etwas, das dir mehr hilft? Hier trägt die Community Alternativen und konkrete Varianten zusammen. So kannst du entdecken, wie die Behandlung aussehen könnte und welche weiteren Möglichkeiten du hast.',
    topics: {
      alternative: {description: 'Hier sammelt die Community frei vorgeschlagene Therapiealternativen. Die Einträge beruhen auf diesen Vorschlägen; ein fachlicher Zusammenhang wird damit nicht vorausgesetzt. Scrolle seitlich und öffne die Namen für Details.'},
      combination: {description: 'Hier sammelt die Community Kombinationen aus Therapien oder Wirkstoffen, deren Zusammenspiel einen zusätzlichen oder anderen Effekt erzielen soll. Du siehst, welche Bestandteile jeweils zusammengehören und welche Kombinationen die Community vorschlägt.'}
    },
    feedbackNote: 'Die Zahlen neben ✓ und × zeigen, wie viele Zustimmungen und Widersprüche es zur jeweiligen Zuordnung gibt. Sie bewerten weder die Wirksamkeit noch die Gleichwertigkeit der Therapien.',
    sharing: {
      invitation: 'Kennst du jemanden, der diese Therapie oder eine der Alternativen schon ausprobiert hat? Leite diese Seite weiter und lade die Person ein, Einträge zu bestätigen, ihnen zu widersprechen oder fehlendes Wissen zu ergänzen.',
      shareText: 'Hast du diese Therapie oder eine Alternative dazu ausprobiert? Schau dir die Alternativen, Einordnungen und Kombinationen im Long Covid Navigator an. Bestätige passende Einträge, widersprich unpassenden Zuordnungen oder ergänze, was du kennst.'
    },
    renderClassification
  };
};
