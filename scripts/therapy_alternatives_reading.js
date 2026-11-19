window.LCNTherapyAlternativesReading = ({make, classificationContext, fieldReference, classificationContents, relationshipTypeLabels}) => {
  function renderClassification(disclosure, section) {
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
    const {fields, current, index} = classificationContext(section);
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

  return {
    eyebrow: 'Erfahrungen verstehen',
    introduction: 'Du bist unsicher, ob diese Therapie zu dir passt, oder suchst nach etwas, das dir mehr hilft? Hier trägt die Community Alternativen und konkrete Varianten zusammen. So kannst du entdecken, wie die Behandlung aussehen könnte und welche weiteren Möglichkeiten du hast.',
    topics: {
      alternative: {description: 'Hier sammelt die Community frei vorgeschlagene Therapiealternativen. Die Einträge beruhen auf diesen Vorschlägen; ein fachlicher Zusammenhang wird damit nicht vorausgesetzt. Scrolle seitlich und öffne die Namen für Details.'},
      combination: {description: 'Hier sammelt die Community Kombinationen aus Therapien oder Wirkstoffen, deren Zusammenspiel einen zusätzlichen oder anderen Effekt erzielen soll. Du siehst, welche Bestandteile jeweils zusammengehören und welche Kombinationen die Community vorschlägt.'}
    },
    feedbackNote: 'Die Zahlen neben Zustimmen (✓) und Widersprechen (×) zeigen, wie die Community die jeweilige Zuordnung einschätzt, etwa als Therapiealternative. Sie helfen dir einzuordnen, wie gesichert diese Zuordnung ist. Sie bewerten weder die Wirksamkeit noch die Gleichwertigkeit der Therapien.',
    sharing: {
      invitation: 'Kennst du jemanden, der diese Therapie oder eine der Alternativen schon ausprobiert hat? Leite diese Seite weiter und lade die Person ein, Einträge zu bestätigen, ihnen zu widersprechen oder fehlendes Wissen zu ergänzen.',
      shareText: 'Hast du diese Therapie oder eine Alternative dazu ausprobiert? Schau dir die Alternativen, Einordnungen und Kombinationen im Long Covid Navigator an. Bestätige passende Einträge, widersprich unpassenden Zuordnungen oder ergänze, was du kennst.'
    },
    renderClassification
  };
};
