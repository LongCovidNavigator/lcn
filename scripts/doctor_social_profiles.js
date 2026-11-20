(() => {
  const platforms = {instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn', other: 'Weitere Plattform'};
  const owners = {provider: 'Behandler:in', practice: 'Praxis / Einrichtung'};
  const demo = ['localhost', 'localhost.', '127.0.0.1', '[::1]'].includes(location.hostname)
    && new URLSearchParams(location.search).get('social_demo') === '1';
  const examples = [
    {platform: 'instagram', url: 'https://example.com/instagram', owner: 'practice'},
    {platform: 'youtube', url: 'https://example.com/youtube', owner: 'provider'},
    {platform: 'facebook', url: 'https://example.com/facebook', owner: 'practice'}
  ];

  function setup(container, initial = []) {
    container.innerHTML = '<div class="doctor-social-rows"></div><button type="button" class="doctor-social-action">+ Social-Media-Link hinzufügen</button>';
    const rows = container.firstElementChild;
    const add = container.lastElementChild;
    function addRow(profile = {}, focus = false) {
      const row = document.createElement('fieldset');
      row.className = 'doctor-social-row';
      row.innerHTML = `
        <legend>Profil</legend>
        <label>Plattform<select data-platform required><option value="">Bitte auswählen</option>${Object.entries(platforms).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label data-other hidden>Plattformname<input maxlength="50"></label>
        <label>Profil-URL<input data-url type="url" pattern="https?://.+" required maxlength="500" placeholder="https://…"></label>
        <label>Gehört zu<select data-owner><option value="">Keine Angabe</option>${Object.entries(owners).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <button type="button" class="doctor-social-action" data-remove>Profil entfernen</button>`;
      const platform = row.querySelector('[data-platform]');
      const other = row.querySelector('[data-other]');
      const label = other.querySelector('input');
      platform.value = profile.platform || '';
      label.value = profile.label || '';
      row.querySelector('[data-url]').value = profile.url || '';
      row.querySelector('[data-owner]').value = profile.owner || '';
      const updatePlatform = () => {
        other.hidden = platform.value !== 'other';
        label.required = !other.hidden;
      };
      platform.addEventListener('change', updatePlatform);
      updatePlatform();
      row.querySelector('[data-remove]').addEventListener('click', () => {
        row.remove();
        add.disabled = false;
        add.focus();
      });
      rows.append(row);
      add.disabled = rows.children.length >= 10;
      if (focus) platform.focus();
    }
    add.addEventListener('click', () => addRow({}, true));
    initial.forEach(profile => addRow(profile));

    return () => [...rows.children].map(row => ({
      platform: row.querySelector('[data-platform]').value,
      url: row.querySelector('[data-url]').value.trim(),
      owner: row.querySelector('[data-owner]').value,
      label: row.querySelector('[data-other] input').value.trim()
    }));
  }

  window.LCNDoctorSocialProfiles = {setup, platforms, owners, demo, examples};
})();
