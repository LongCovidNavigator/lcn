// Same location wording and explicit submit action on both catalog searches.
document.addEventListener('DOMContentLoaded',()=>{
 for(const prefix of ['doctor','treatment']){
  const input=document.getElementById(prefix+'-location-input');if(!input)continue;
  const label=document.querySelector('label[for="'+input.id+'"]');if(label)label.textContent='Adresse, PLZ oder Ort';
  input.placeholder='z. B. Musterstadt';
  const button=document.createElement('button');button.type='button';button.className='lcn-map-submit';button.textContent='Standort übernehmen';
  button.addEventListener('click',()=>{if(prefix==='doctor')applySearchFromControls(true);else applyTreatmentLocationFromInput();});
  input.closest('div').after(button);
  const hint=document.createElement('p');hint.className='lcn-map-help';hint.textContent='Entfernung als Luftlinie. Dieser Standort wird auf den übrigen LCN-Seiten übernommen.';button.after(hint);
 }
});

// Normalize controls also when a detail card is rendered after page load.
function compactMapLocationControls() {
 document.querySelectorAll('.nd-location-heading').forEach(heading => {
  const clear = heading.querySelector('button');
  const row = heading.parentElement.querySelector('.top-map-location-input-row, .own-location-control');
  heading.classList.add('lcn-location-heading');
  if (clear && row) { row.classList.add('lcn-location-field'); row.append(clear); }
 });
 document.querySelectorAll('.nd-radius-inline:not(.lcn-radius-row)').forEach(row => {
  const value = row.querySelector('.nd-radius-value');
  const toggle = row.querySelector('.nd-radius-toggle');
  if (!value || !toggle) return;
  row.classList.add('lcn-radius-row');
  toggle.querySelector('input')?.setAttribute('aria-label', 'Radius aktivieren');
  toggle.setAttribute('title', 'Radius aktivieren');
 });
 for (const prefix of ['doctor', 'treatment']) {
  const input = document.getElementById(prefix + '-radius-input');
  const label = document.querySelector('label[for="' + prefix + '-radius-input"]');
  const toggle = document.querySelector('label[for="' + prefix + '-radius-enabled-input"]');
  if (!input || !label || !toggle || input.closest('.lcn-catalog-radius-row')) continue;
  const row = document.createElement('div'); row.className = 'lcn-catalog-radius-row';
  label.before(row); label.textContent = 'Radius in Kilometern';
  toggle.querySelector('input').setAttribute('aria-label', 'Radius aktivieren');
  toggle.setAttribute('title', 'Radius aktivieren');
  row.append(label, toggle, input);
 }
}
document.addEventListener('DOMContentLoaded', () => {
 compactMapLocationControls();
 new MutationObserver(records => {
  if (records.some(record => record.addedNodes.length)) compactMapLocationControls();
 }).observe(document.body, {childList:true, subtree:true});
});
