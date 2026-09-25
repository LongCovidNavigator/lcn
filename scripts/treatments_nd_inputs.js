(() => {
  'use strict';
  const root = document.querySelector('[data-treatment-id]');
  if (!root) return;
  const forms = [...root.querySelectorAll('.nd-user-form')];
  const storageKey = 'lcn:nd-test:v013:' + root.dataset.treatmentId;
  let draft = {};
  let storageAvailable = true;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) draft = stored;
  } catch { storageAvailable = false; }
  const fields = forms.flatMap(form => [...form.querySelectorAll('input, textarea')]);
  const name = field => field.name.replace(/\[\]$/, '');
  // Restore only values still allowed by the current schema; never insert saved HTML.
  fields.forEach(field => {
    const value = draft[name(field)];
    if (field.tagName === 'TEXTAREA') field.value = typeof value === 'string' ? value.slice(0, 1500) : '';
    else field.checked = field.type === 'checkbox' ? Array.isArray(value) && value.includes(field.value) : value === field.value;
  });
  function collect() {
    const values = {};
    fields.forEach(field => {
      const key = name(field);
      if (field.tagName === 'TEXTAREA') { if (field.value.trim()) values[key] = field.value.trim(); }
      else if (field.checked) {
        if (field.type === 'checkbox') (values[key] ||= []).push(field.value);
        else values[key] = field.value;
      }
    });
    return values;
  }
  function render() {
    root.querySelectorAll('[data-effect-value]').forEach(button => button.setAttribute('aria-pressed', String(fields.some(field => field.name === 'effect' && field.value === button.dataset.effectValue && field.checked))));
    const inline = root.querySelector('[data-own-inline="costs"]');
    if (inline) {
      inline.replaceChildren();
      Object.entries({unit_cost:'Preis pro Einheit',ongoing_cost:'Laufende Kosten',total_cost:'Gesamtkosten'}).forEach(([key,label]) => {
        if (!draft[key]) return;
        const row = document.createElement('p');
        row.textContent = 'Deine Angabe · ' + label + ': ' + draft[key];
        inline.append(row);
      });
    }
    const target = document.getElementById('nd-own-summary');
    target.replaceChildren();
    const entries = Object.entries(draft);
    if (!entries.length) { const p = document.createElement('p'); p.textContent = 'Noch keine eigenen Angaben ausgewählt.'; target.append(p); return; }
    entries.forEach(([key, value]) => {
      const field = fields.find(field => name(field) === key);
      if (!field) return;
      const row = document.createElement('div'); row.className = 'nd-own-result';
      const heading = document.createElement('strong');
      heading.textContent = field.closest('fieldset')?.querySelector('legend')?.textContent || field.closest('label').childNodes[0].textContent;
      const answer = document.createElement('span'); answer.textContent = Array.isArray(value) ? value.join(' · ') : value;
      row.append(heading, answer);
      if (['pem', 'rating', 'effect', 'gamechanger', 'onset'].includes(key)) {
        const scale = document.createElement('div'); scale.className = 'nd-own-scale'; scale.setAttribute('aria-hidden', 'true');
        fields.filter(f => name(f) === key).forEach(option => {
          const mark = document.createElement('span'); mark.className = option.value === value ? 'is-selected' : ''; mark.textContent = option.value; scale.append(mark);
        });
        row.append(scale);
      }
      target.append(row);
    });
  }
  function save(form) {
    draft = collect();
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); storageAvailable = true; }
    catch { storageAvailable = false; }
    form.querySelector('.nd-draft-status').textContent = storageAvailable
      ? 'Testentwurf in diesem Tab übernommen. Nicht an LCN gesendet.'
      : 'Nur für die aktuell geöffnete Seite übernommen. Browser-Speicherung ist nicht verfügbar.';
    render();
  }
  forms.forEach(form => {
    form.querySelectorAll('[data-effect-value]').forEach(button => button.addEventListener('click', () => {
      fields.filter(field => field.name === 'effect').forEach(field => { field.checked = field.value === button.dataset.effectValue; });
      save(form);
    }));
    form.hidden = false;
    form.addEventListener('submit', event => { event.preventDefault(); save(form); });
    form.addEventListener('change', () => save(form));
    form.querySelectorAll('[data-clear-answer]').forEach(button => button.addEventListener('click', () => {
      fields.filter(field => name(field) === button.dataset.clearAnswer).forEach(field => { field.checked = false; }); save(form);
    }));
  });
  document.getElementById('nd-reset-draft').addEventListener('click', () => {
    fields.forEach(field => { if (field.tagName === 'TEXTAREA') field.value = ''; else field.checked = false; });
    draft = {};
    try { sessionStorage.removeItem(storageKey); } catch { /* No persistent storage available. */ }
    forms.forEach(form => { form.querySelector('.nd-draft-status').textContent = ''; });
    render();
    document.getElementById('nd-reset-status').textContent = 'Alle Testangaben zu dieser Behandlung gelöscht.';
  });
  draft = collect();
  render();
})();
