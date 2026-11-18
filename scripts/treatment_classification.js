/* Classification choices describe the entry itself; relationship votes describe a link. */
document.addEventListener('DOMContentLoaded', () => {
  const labels = {
    group: 'Wirkstoffgruppe', ingredient: 'Wirkstoff', substance: 'Substanz', combination: 'Kombination',
    brand: 'Handelsname', application_form: 'Applikation', substance_variant: 'Stoffvariante',
    therapy_group: 'Gruppe', therapy: 'Verfahren', detailed_method: 'Anwendung'
  };
  const substanceRoles = ['group', 'substance'];
  const applicationRoles = ['brand', 'application_form', 'substance_variant'];
  const therapyRoles = ['therapy_group', 'therapy', 'detailed_method'];
  const specificCategories = ['Arzneimittel', 'Infusionen', 'Nahrungsergänzungsmittel'];
  document.querySelectorAll('[data-stage-classification]').forEach(host => {
    const id = Number(host.dataset.stageClassification), name = host.dataset.classificationName;
    const currentRole = host.dataset.classificationCurrent;
    const category = host.dataset.classificationCategory;
    const domain = host.closest('[data-relationship-stages]')?.dataset.relationshipDomain;
    const substanceLayout = domain === 'substance' || domain === 'medication';
    if (!Object.hasOwn(labels, currentRole)) return;
    const currentLabel = substanceLayout && currentRole === 'therapy_group' ? labels.group : labels[currentRole];
    const equivalentRoles = ['ingredient', 'substance', 'combination'].includes(currentRole)
      ? ['ingredient', 'substance', 'combination'] : currentRole === 'group' || currentRole === 'therapy_group'
        ? ['group', 'therapy_group'] : [currentRole];
    const box = document.createElement('span'), yes = document.createElement('button'), no = document.createElement('button');
    box.className = 'catalog-feedback catalog-feedback-standard';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Einordnung von „' + name + '“ als ' + currentLabel);
    yes.type = no.type = 'button';
    let data = {}, busy = true, loaded = false;
    const alternatives = Object.keys(labels).filter(role => role !== currentRole);
    const subject = '„' + name + '“ ist als ' + currentLabel + ' einsortiert.';
    function paint() {
      yes.textContent = '✓ ' + (data[currentRole]?.count || 0);
      no.textContent = '× ' + alternatives.reduce((sum, role) => sum + (data[role]?.count || 0), 0);
      const ownYes = !!data[currentRole]?.own, ownNo = alternatives.some(role => data[role]?.own);
      yes.setAttribute('aria-pressed', String(ownYes)); no.setAttribute('aria-pressed', String(ownNo));
      yes.disabled = no.disabled = busy || !loaded;
      for (const [button, stance] of [[yes, 1], [no, -1]]) {
        const action = stance === 1 ? (ownYes ? 'Zustimmung zurücknehmen' : 'Zustimmen') : 'Widersprechen';
        const explanation = stance === 1 ? subject : '„' + name + '“ ist nicht als ' + currentLabel + ' einzuordnen. Eine alternative Einordnung wählen.';
        button.dataset.stance = String(stance);
        button.dataset.feedbackAction = action; button.dataset.feedbackSubject = explanation;
        button.dataset.feedbackTone = stance === 1 ? (ownYes ? 'neutral' : 'confirm') : 'oppose';
        button.dataset.lcnTooltip = action + ': ' + explanation;
        button.setAttribute('aria-label', action + ': ' + explanation);
      }
    }
    async function request(choice, note = '') {
      const response = await fetch('api/treatment_classification_feedback.php' + (choice === undefined ? '?id=' + id : ''), choice === undefined ? {cache: 'no-store'} : {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, choice, note})
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || 'Rückmeldung konnte nicht gespeichert werden.');
      data = result.choices; loaded = true; paint();
    }
    function notifyChanged() {
      document.dispatchEvent(new Event('lcn-classification-changed'));
      document.dispatchEvent(new CustomEvent('lcn-guide-contributed', {detail: {topic: 'classification'}}));
    }
    yes.addEventListener('click', async () => {
      if (!category) { no.click(); return; }
      busy = true; paint();
      try { await request(data[currentRole]?.own ? '' : currentRole); notifyChanged(); }
      catch (error) { window.LCNCatalogRelations?.showFeedbackNotice(error.message, true); }
      finally { busy = false; paint(); }
    });
    no.addEventListener('click', () => {
      const dialog = document.createElement('dialog'); dialog.className = 'catalog-report-dialog ux-reclassify-dialog';
      const title = document.createElement('h3'); title.id = 'reclassify-title'; title.textContent = 'Einordnung vorschlagen'; dialog.setAttribute('aria-labelledby', title.id);
      const entry = document.createElement('p'); entry.className = 'ux-reclassify-subject'; entry.textContent = name;
      const help = document.createElement('p'); help.className = 'ux-reclassify-help'; help.textContent = 'Was passt besser?';
      const choices = document.createElement('div'); choices.className = 'ux-reclassify-options';
      const noteLabel = document.createElement('label'); noteLabel.textContent = 'Begründung (optional)';
      const note = document.createElement('textarea'); note.maxLength = 2000; note.rows = 3; note.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:6px 0 14px';
      noteLabel.append(note);
      const actions = document.createElement('div'); actions.className = 'ux-reclassify-actions';
      const status = document.createElement('p'); status.className = 'ux-reclassify-status'; status.setAttribute('role', 'status');
      dialog.append(title, entry, help, choices, noteLabel, status, actions); noteLabel.hidden = true;
      async function save(choice) {
        dialog.querySelectorAll('button').forEach(button => button.disabled = true);
        busy = true; paint();
        try { await request(choice, (!category && selectedCategory ? 'Vorgeschlagene Kategorie: ' + selectedCategory + '\n' : '') + note.value); notifyChanged(); dialog.close(); }
        catch (error) { status.textContent = error.message; }
        finally { busy = false; paint(); dialog.querySelectorAll('button').forEach(button => button.disabled = false); }
      }
      let selectedCategory = category || '';
      const addOption = (label, action, container = choices) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'ux-reclassify-option'; button.textContent = label; button.addEventListener('click', action); container.append(button); return button;
      };
      function selectRole(role, label) {
        choices.replaceChildren(); help.textContent = 'Vorschlag: ' + label; noteLabel.hidden = false;
        addOption('Vorschlag absenden', () => save(role)); addOption('Zurück', showRoles);
        note.focus();
      }
      function addRoleOption(role, container = choices) {
        if (equivalentRoles.includes(role)) return;
        const label = role === 'substance' ? 'Wirkstoff oder Substanz' : labels[role];
        const button = addOption(label, () => selectRole(role, label), container);
        button.dataset.classificationChoice = role;
        const count = data[role]?.count || 0;
        if (count) {
          const badge = document.createElement('span');
          badge.className = 'ux-reclassify-count';
          badge.textContent = count;
          badge.setAttribute('aria-label', count + (count === 1 ? ' Vorschlag' : ' Vorschläge'));
          button.append(badge);
        }
      }
      function showRoles() {
        choices.replaceChildren(); noteLabel.hidden = true; help.textContent = 'Was passt besser?';
        const specific = specificCategories.includes(selectedCategory) || (substanceLayout && selectedCategory === (category || ''));
        for (const role of specific ? substanceRoles : therapyRoles) addRoleOption(role);
        if (specific) {
          const group = document.createElement('div');
          group.className = 'ux-reclassify-application';
          group.setAttribute('role', 'group');
          const heading = document.createElement('h4');
          heading.id = 'reclassify-application-title';
          heading.textContent = 'Anwendungsform';
          group.setAttribute('aria-labelledby', heading.id);
          group.append(heading);
          if (applicationRoles.includes(currentRole)) {
            const hint = document.createElement('p');
            hint.id = 'reclassify-application-hint';
            hint.textContent = 'Bleibt in der rechten Spalte';
            group.setAttribute('aria-describedby', hint.id);
            group.append(hint);
          }
          for (const role of applicationRoles) addRoleOption(role, group);
          choices.append(group);
        }
        if (!category) addOption('Kategorie auswählen', chooseCategory);
        choices.firstElementChild?.focus();
      }
      function chooseCategory() {
        choices.replaceChildren(); noteLabel.hidden = true; help.textContent = 'In welche Kategorie gehört der Eintrag?';
        for (const category of [...specificCategories, 'Andere Kategorie']) addOption(category, () => { selectedCategory = category; showRoles(); });
      }
      if (selectedCategory || substanceLayout) showRoles(); else chooseCategory();
      if (alternatives.some(role => data[role]?.own)) {
        const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'ux-reclassify-undo'; undo.textContent = 'Rückmeldung zurücknehmen'; undo.addEventListener('click', () => save('')); actions.append(undo);
      }
      const close = document.createElement('button'); close.type = 'button'; close.className = 'ux-reclassify-cancel'; close.textContent = 'Abbrechen'; close.addEventListener('click', () => dialog.close()); actions.append(close);
      dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
      dialog.addEventListener('close', () => { dialog.remove(); no.focus(); }); document.body.append(dialog); dialog.showModal();
    });
    box.append(yes, no); host.append(box); paint();
    request().catch(error => { host.title = error.message; }).finally(() => { busy = false; paint(); });
  });
});
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-clarify-parent]').forEach(button => button.addEventListener('click', () => {
    const dialog = document.createElement('dialog'); dialog.className = 'catalog-report-dialog ux-reclassify-dialog';
    const title = document.createElement('h3'); title.textContent = 'Zuordnung präzisieren';
    const parent = document.querySelector('[data-stage-node="' + button.dataset.clarifyParent + '"] .ux-stage-name')?.textContent || '';
    const child = button.closest('[data-stage-node]').querySelector('.ux-stage-name').textContent;
    const context = document.createElement('p'); context.textContent = parent + ' → ' + child;
    const choices = document.createElement('div'); choices.className = 'ux-reclassify-options';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Schließen'; cancel.addEventListener('click', () => dialog.close());
    const specific = document.querySelector('[data-relationship-stages]')?.dataset.relationshipDomain !== 'therapy';
    const kinds = specific ? {has_trade:'Handelsname / Präparat',has_variant:'Stoffvariante / Darreichung',has_form:'Anwendungsform'} : {has_detail:'Anwendung'};
    for (const [kind, label] of Object.entries(kinds)) {
      const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'ux-reclassify-option'; choice.textContent = label;
      choice.addEventListener('click', async () => {
        choices.querySelectorAll('button').forEach(b => b.disabled = true); cancel.disabled = true;
        try {
          const response = await fetch('api/treatment_relationship_proposals.php', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source_id:Number(button.dataset.clarifyParent),target_id:Number(button.dataset.clarifyChild),context_id:Number(document.querySelector('[data-treatment-id]').dataset.treatmentId),kind})});
          const result = await response.json(); if (!response.ok || !result.ok) throw Error(result.error || 'Vorschlag konnte nicht gespeichert werden.');
          status.textContent = 'Vorschlag gespeichert · Arbeitshypothese wird übernommen'; window.location.reload();
          document.dispatchEvent(new CustomEvent('lcn-guide-contributed',{detail:{topic:'classification'}}));
        } catch(error) { status.textContent = error.message; choices.querySelectorAll('button').forEach(b => b.disabled = false); }
        finally { cancel.disabled = false; }
      }); choices.append(choice);
    }
    dialog.append(title,context,choices,status,cancel); document.body.append(dialog); dialog.addEventListener('close',()=>{dialog.remove();button.focus()});dialog.showModal();
  }));
});
