(() => {
  'use strict';
  const toolbar = document.querySelector('.nd-demo-toolbar');
  if (!toolbar) return;
  // Deliberately synthetic, fixed n=100 per question. Never submitted or copied into answers.
  const profiles = {
    ldn: {name:'LDN', application:[12,76,18,3,0,0,0,0,0,0,0,4], titration:[84,16], taper:[28,72], dose_adjustment:[68,32], rating:[68,18,14], effect:[14,18,62,6], gamechanger:[32,68], onset:[4,12,51,23,10], pem:[48,34,13,5], setting:[82,14,28,6], gkv:[18,82], pharmacy:[86,14], duration_band:[90,6,3,1], frequency_band:[2,4,86,8], count_band:[1,5,14,80], total_duration_band:[2,10,28,60]},
    ivabradin: {name:'Ivabradin', application:[94,4,3,0,0,0,0,0,0,0,0,2], titration:[58,42], taper:[36,64], dose_adjustment:[54,46], rating:[54,28,18], effect:[18,28,50,4], gamechanger:[24,76], onset:[12,38,28,10,12], pem:[35,40,18,7], setting:[76,8,38,12], gkv:[62,38], pharmacy:[12,88], duration_band:[92,5,2,1], frequency_band:[1,3,24,72], count_band:[2,8,20,70], total_duration_band:[5,15,35,45]},
  };
  const toggle = document.getElementById('nd-demo-toggle');
  const select = document.getElementById('nd-demo-profile');
  const params = new URLSearchParams(location.search);
  toggle.checked = params.get('demo') !== '0';
  select.value = Object.hasOwn(profiles, params.get('demo_profile')) ? params.get('demo_profile') : (document.querySelector('[data-treatment-id]').dataset.treatmentId === '5' ? 'ivabradin' : 'ldn');
  function render() {
    const p = profiles[select.value];
    document.querySelectorAll('[data-distribution-percent]').forEach(el => { el.textContent = toggle.checked ? p[el.dataset.distributionPercent][Number(el.dataset.index)] + ' %' : '–'; });
    document.querySelectorAll('[data-distribution-bar]').forEach(el => { el.style.height = (toggle.checked ? p[el.dataset.distributionBar][Number(el.dataset.index)] * 1.5 : 0) + 'px'; });
    document.querySelectorAll('[data-distribution-width]').forEach(el => { el.style.width = (toggle.checked ? p[el.dataset.distributionWidth][Number(el.dataset.index)] : 0) + '%'; });
    document.querySelectorAll('[data-distribution-note]').forEach(el => { el.textContent = toggle.checked ? 'Fiktive Nutzerwerte · ' + p.name + ' · n = 100' : 'Keine Community-Daten · eigene Auswahl weiterhin möglich'; });
    document.querySelectorAll('[data-effect-percent]').forEach(el => { el.textContent = toggle.checked ? p.effect[Number(el.dataset.effectPercent)] + ' %' : '–'; });
    document.querySelectorAll('[data-effect-bar]').forEach(el => { el.style.height = (toggle.checked ? p.effect[Number(el.dataset.effectBar)] * 1.5 : 0) + 'px'; });
    document.getElementById('nd-effect-data-label').textContent = toggle.checked ? 'Fiktive Nutzerwerte · n = 100' : 'Keine Community-Daten';
    const headerToggle = document.getElementById('nd-demo-header-toggle');
    headerToggle.textContent = toggle.checked ? 'Dummydaten: an' : 'Dummydaten: aus';
    headerToggle.setAttribute('aria-pressed', String(toggle.checked));
    document.getElementById('nd-no-community').hidden = toggle.checked;
    document.getElementById('nd-demo-state').textContent = toggle.checked ? 'Nutzer-Dummydaten eingeschaltet. Eigene Eingaben und Recherchewerte bleiben unverändert.' : 'Nutzer-Dummydaten ausgeschaltet. Es werden keine simulierten Ergebnisse gezeigt.';
  }
  function change() {
    const url = new URL(location.href);
    url.searchParams.set('demo', toggle.checked ? '1' : '0');
    url.searchParams.set('demo_profile', select.value);
    history.replaceState(null,'',url);
    render();
  }
  document.getElementById('nd-demo-header-toggle').addEventListener('click', () => { toggle.checked = !toggle.checked; change(); });
  toggle.addEventListener('change',change);
  select.addEventListener('change',change);
  toolbar.hidden = false;
  render();
})();
