window.LCNTherapyAlternativesContribution = ({make, classificationContext, fieldReference}) => {
  const positions = ['linken', 'mittleren', 'rechten'];
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
  const applicationDefinitions = {
    Handelsnamen: ['Ein ', 'Handelsname', ' ist der Produktname eines Präparats, das den übergeordneten Wirkstoff bzw. die Substanz enthält.'],
    Applikation: ['Eine ', 'Applikation', ' beschreibt, auf welchem Weg ein Wirkstoff bzw. eine Substanz verabreicht wird, etwa oral oder als Infusion.'],
    Stoffvarianten: ['Eine ', 'Stoffvariante', ' kann eine andere Form eines Wirkstoffs sowie Extrakte oder Präparate beschreiben, die den übergeordneten Wirkstoff bzw. die Substanz enthalten.']
  };
  const definitionAliases = {
    Anwendungsform: 'Applikation',
    'Weitere Anwendungsformen': 'Anwendungsformen',
    'Übergeordnete Substanz': 'Substanz',
    Stoffvariante: 'Stoffvarianten'
  };
  const groupNames = {
    Gruppe: ['Gruppe', 'Gruppen'],
    Gruppen: ['Gruppe', 'Gruppen'],
    Wirkstoffgruppen: ['Wirkstoffgruppe', 'Wirkstoffgruppen'],
    Medikamentengruppe: ['Medikamentengruppe', 'Medikamentengruppen']
  };

  const agree = () => make('strong', 'Zustimmen (✓)');
  const disagree = () => make('strong', 'Widersprechen (×)');
  const visible = node => !node.closest('[hidden]');
  const guideLabel = label => label === 'Wirkstoffe und Substanzen (Kombination)' ? 'Wirkstoffe und Substanzen' : label;

  function appendSentence(paragraph, ...parts) {
    if (paragraph.hasChildNodes()) paragraph.append(' ');
    paragraph.append(...parts);
  }

  function appendDefinition(paragraph, label, substanceBranch) {
    const key = Object.hasOwn(groupNames, label)
      ? (substanceBranch ? 'substanceGroup' : 'therapyGroup')
      : definitionAliases[label] || label;
    const applicationDefinition = applicationDefinitions[key];
    if (applicationDefinition) {
      const [prefix, term, explanation] = applicationDefinition;
      appendSentence(paragraph, prefix, make('strong', term), explanation);
    } else if (definitions[key]) {
      appendSentence(paragraph, definitions[key]);
    }
  }

  function appendFieldReferences(paragraph, fields, currentIndex, substanceBranch) {
    const destinations = currentIndex === 2 ? [1, 0] : [0, 1, 2];
    for (const index of destinations) {
      const field = fields[index];
      if (index === currentIndex || !field?.nodes.length) continue;
      const {label, nodes} = field;
      const position = [' im ', make('u', positions[index]), ' Feld.'];
      const destination = fieldReference(field);
      if (index === 1 && currentIndex === 0) {
        appendSentence(paragraph, 'Die ', destination, ', die die Community dieser Gruppe zuordnet, findest du', ...position);
      } else if (index === 1 && label === 'Verfahren' && nodes.length === 1) {
        appendSentence(paragraph, 'Das zugehörige ', destination, ' findest du', ...position);
      } else if (index === 1 && label === 'Wirkstoffe und Substanzen' && nodes.length === 1) {
        appendSentence(paragraph, 'Den zugehörigen ', make('u', 'Wirkstoff'), ' bzw. die ', make('u', 'Substanz'),
          ' findest du', ...position);
      } else if (label === 'Substanz') {
        appendSentence(paragraph, 'Die zugehörige ', destination, ' findest du', ...position);
      } else if (index === 0 && label === 'Übergeordnete Substanz') {
        appendSentence(paragraph, 'Die ', make('u', 'übergeordnete Substanz'), ' findest du', ...position);
      } else if (index === 0 && Object.hasOwn(groupNames, label) && currentIndex === 2 && !substanceBranch) {
        const group = nodes.length === 1 ? 'Gruppe' : 'Gruppen';
        appendSentence(paragraph, 'Die ', make('u', group), nodes.length === 1 ? ', der' : ', denen',
          ' dieses Verfahren zugeordnet ist, findest du', ...position);
      } else if (index === 0 && Object.hasOwn(groupNames, label)) {
        const singular = nodes.length === 1;
        const [one, several] = groupNames[label];
        appendSentence(paragraph, singular ? 'Die zugehörige ' : 'Die zugehörigen ',
          make('u', singular ? one : several), ' findest du', ...position);
      } else {
        const name = label === 'Anwendung' ? 'Anwendungen' : label;
        appendSentence(paragraph, index === 2 ? 'Die dazugehörigen ' : 'Die zugehörigen ',
          make('u', name), ' findest du', ...position);
      }
    }
  }

  function appendCombinationReference(item, target) {
    const combination = target.closest('.nd-panel')?.querySelector('[data-combination-section][data-is-combination="1"]');
    const tree = combination?.querySelector('[data-combination-parent].is-current')?.closest('[data-combination-tree]');
    const heading = combination?.querySelector('h3')?.firstChild?.textContent.trim();
    if (!heading || !tree || ![...tree.querySelectorAll('[data-combination-part]')].some(visible)) return;
    const paragraph = make('p', 'Unter ');
    paragraph.append(make('u', heading), ' findest du die einzelnen Bestandteile dieser Therapie.');
    item.append(paragraph);
  }

  function descriptionSections(field) {
    const {column, label, nodes} = field;
    if (applicationFields.has(label)) {
      const sections = new Map();
      for (const block of column.querySelectorAll('.ux-stage-block[data-relationship-label]')) {
        if (!visible(block)) continue;
        const name = block.dataset.relationshipLabel;
        if (!sections.has(name)) sections.set(name, {name, containers: [], nodes: []});
        const section = sections.get(name);
        section.containers.push(block);
        section.nodes.push(...nodes.filter(node => block.contains(node)));
      }
      if (sections.size) return {subsections: true, sections: [...sections.values()]};
    }
    return {subsections: false, sections: [{name: label, containers: [column], nodes}]};
  }

  function appendAddHint(paragraph, label) {
    appendSentence(paragraph, 'Mit ', make('strong', '„' + label + '“'), ' kannst du Ergänzungen vorschlagen.');
  }

  function describeSection(section, {current, classificationName, addLabel, substanceBranch, groupDestination, sharedAddHint}) {
    const {name, nodes, canAdd} = section;
    const linked = nodes.filter(node => node !== current);
    const paragraph = make('p');
    const includesCurrent = current && (nodes.includes(current) || name === classificationName);
    if (!includesCurrent) appendDefinition(paragraph, name, substanceBranch);
    if (canAdd && !sharedAddHint) {
      appendAddHint(paragraph, addLabel);
    } else if (!canAdd && groupDestination) {
      appendSentence(paragraph, 'Um eine Gruppe zuzuordnen, öffne den zugehörigen Eintrag im ',
        make('u', 'mittleren'), ' Feld unter ', fieldReference(groupDestination), '.');
    }
    const voteCount = linked.filter(node => node.querySelector('[data-treatment-relation-feedback]')).length;
    if (voteCount) {
      const introduction = voteCount < linked.length ? 'Bei Einträgen mit Abstimmungsbuttons kannst du ' : 'Bei vorhandenen Einträgen kannst du ';
      appendSentence(paragraph, introduction, agree(), ' oder ', disagree(), ' wählen.');
    }
    if (linked.some(node => node.querySelector('[data-clarify-parent]'))) {
      appendSentence(paragraph, 'Über ', make('strong', '„Zuordnung offen · Genauer einordnen“'), ' kannst du eine Zuordnung vorschlagen.');
    }
    return paragraph;
  }

  function renderClassification(disclosure, target) {
    const {fields: stageFields, current, index: currentIndex} = classificationContext(target);
    const fields = stageFields.map(field => ({...field, label: guideLabel(field.label)}));
    const middle = fields[1];
    const classification = current?.querySelector('[data-stage-classification]');
    const previous = disclosure.querySelector(':scope > ul');
    const list = make('ul', '', 'therapy-guide-options');
    const substanceBranch = target.dataset.relationshipDomain
      ? target.dataset.relationshipDomain !== 'therapy'
      : middle?.label !== 'Verfahren';

    fields.forEach((field, index) => {
      const {label} = field;
      const isCurrent = index === currentIndex;
      const item = make('div', '', 'therapy-guide-classification-content');
      const classificationName = isCurrent ? current.closest('.ux-stage-block')?.dataset.relationshipLabel || label : null;
      if (isCurrent && classification) {
        const summary = make('p', 'Die Community ordnet diese Therapie bei ');
        summary.append(make('strong', classificationName));
        if (classificationName !== label) summary.append(' im Feld ', make('strong', label));
        summary.append(' ein.');
        appendDefinition(summary, classificationName, substanceBranch);
        if (classification.dataset.classificationCategory) {
          appendSentence(summary, 'Mit ', agree(), ' bestätigst du die Einordnung.');
        }
        appendSentence(summary, 'Über ', disagree(), ' kannst du eine andere Einordnung vorschlagen.');
        item.append(summary);

        const references = make('p');
        appendFieldReferences(references, fields, currentIndex, substanceBranch);
        if (references.hasChildNodes()) item.append(references);
        appendCombinationReference(item, target);
      }

      const groupDestination = index === 0 && Object.hasOwn(groupNames, label)
        && field.column.querySelector('.ux-stage-add-hint')
        && middle?.nodes.some(node => node.querySelector('a.ux-stage-name[href]')) ? middle : null;
      const {subsections, sections} = descriptionSections(field);
      const sectionsWithActions = sections.map(section => ({
        ...section,
        canAdd: section.containers.some(container => [...container.querySelectorAll('[data-treatment-relation-add]')].some(visible))
      }));
      const sharedAddHint = subsections && sectionsWithActions.length > 1 && sectionsWithActions.every(section => section.canAdd);
      const description = {
        current: isCurrent && classification ? current : null,
        classificationName,
        addLabel: target.dataset.addEntryLabel,
        substanceBranch,
        groupDestination,
        sharedAddHint
      };
      const paragraphs = sectionsWithActions.map(section => describeSection(section, description)).filter(paragraph => paragraph.hasChildNodes());
      if (subsections && paragraphs.length) {
        const applicationList = make('ul', '', 'therapy-guide-application-list');
        for (const paragraph of paragraphs) {
          const entry = make('li');
          entry.append(paragraph);
          applicationList.append(entry);
        }
        item.append(applicationList);
      } else {
        item.append(...paragraphs);
      }
      if (sharedAddHint) {
        const hint = make('p');
        appendAddHint(hint, description.addLabel);
        item.append(hint);
      }
      if (!item.hasChildNodes() && applicationFields.has(label)) {
        item.append(make('p', definitions.Anwendungsformen));
      }
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

  return {
    eyebrow: 'Community-Wissen',
    introduction: 'Prüfe die vorhandenen Alternativen, Einordnungen und Kombinationen. Bestätige passende Einträge oder ergänze fehlende über die Schaltflächen im jeweiligen Bereich. Eigene Behandlungserfahrung ist dafür nicht nötig.',
    votingTitle: 'Zustimmung und Widerspruch',
    topics: {
      alternative: {
        description: 'Hier trägt die Community ihr Wissen zu Therapiealternativen zusammen. Ergänze frei, was du für eine Alternative hältst – aus eigener Erfahrung, von anderen oder vom Hörensagen. Eigene Behandlungserfahrung ist nicht nötig.',
        voting: 'Mit Zustimmen (✓) bestätigst du, dass du den vorgeschlagenen Eintrag als passende Alternative zur hier geöffneten Therapie ansiehst. Mit Widersprechen (×) widersprichst du diesem Vorschlag. Du bewertest damit weder die Wirksamkeit noch die Gleichwertigkeit der Therapien.'
      },
      combination: {
        description: 'Welche Behandlungen ergeben zusammen mehr als ihre einzelnen Bestandteile? Gesucht sind gezielte Kombinationen, die einen zusätzlichen oder anderen Effekt erzielen sollen, den Genesungsprozess unterstützen oder zusammen eine eigenständige Therapie bilden. Entscheidend ist dieses Zusammenspiel, nicht allein die gleichzeitige Anwendung. Eigene Behandlungserfahrung ist dafür nicht nötig.',
        voting: 'Mit Zustimmen (✓) bestätigst du, dass der angezeigte Bestandteil zur vorgeschlagenen Therapiekombination gehört. Mit Widersprechen (×) widersprichst du dieser Zuordnung. Deine Rückmeldung bezieht sich auf die Zusammensetzung der Kombination, nicht auf ihre Wirksamkeit.'
      }
    },
    renderClassification
  };
};
