document.addEventListener('DOMContentLoaded', () => {
  for (const [id, url] of [['header-placeholder','components/header.html?v=two-add-links-20261105'],['footer-placeholder','components/footer.html?v=f320b7bc85']]) fetch(url).then(r=>r.text()).then(html=>document.getElementById(id).innerHTML=html);
  const form=document.getElementById('entry-form'), message=document.getElementById('entry-message');
  const nameField=form.elements.name, practiceField=form.elements.organization;
  function validateIdentity(){
    nameField.setCustomValidity(nameField.value.trim() || practiceField.value.trim() ? '' : 'Bitte gib einen Namen oder eine Praxis / Institution an.');
  }
  for(const field of [nameField,practiceField])field.addEventListener('input',validateIdentity);
  validateIdentity();
  const doctor=form.querySelector('[name="provider_types"][value="doctor"]');
  const primary=form.elements.primary_care;
  const chips=form.querySelector('.provider-type-chips');
  function updateTypes(){
    const selected=[...form.querySelectorAll('[name="provider_types"]:checked')];
    chips.replaceChildren();
    for(const input of selected){
      const chip=document.createElement('button');chip.type='button';chip.className='provider-type-chip';
      const label=input.nextElementSibling.textContent;
      chip.textContent=label+' ×';chip.setAttribute('aria-label',label+' entfernen');
      chip.addEventListener('click',()=>{input.checked=false;updateTypes();form.querySelector('.provider-type-picker summary').focus();});chips.append(chip);
    }
    primary.closest('label').hidden=!doctor.checked;
    if(!doctor.checked)primary.checked=false;
  }
  if(new URLSearchParams(location.search).get('primary_care')==='1'){doctor.checked=true;primary.checked=true;}
  form.querySelectorAll('[name="provider_types"]').forEach(input=>input.addEventListener('change',updateTypes));
  updateTypes();
  form.querySelector('.provider-type-picker').addEventListener('keydown',event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary').focus();}});
  for (const field of [form.elements.name,form.elements.organization]) {
    const box=document.createElement('div');box.className='duplicate-check';box.setAttribute('aria-live','polite');field.closest('label').after(box);
    let timer,controller,revision=0;
    field.addEventListener('input',()=>{
      clearTimeout(timer);controller?.abort();const current=++revision;box.replaceChildren();
      const query=field.value.trim();if(query.length<2)return;
      box.textContent='Vorhandene Einträge werden geprüft …';
      timer=setTimeout(async()=>{
        controller=new AbortController();
        try {
          const response=await fetch('api/submission_duplicate_search.php?type=doctor&catalog=current&q='+encodeURIComponent(query),{signal:controller.signal,cache:'no-store'});
          const data=await response.json();if(current!==revision)return;if(!response.ok||!data.ok)throw Error();
          box.replaceChildren();
          if(!data.items.length){box.textContent='Kein passender vorhandener Eintrag gefunden.';return;}
          const heading=document.createElement('strong');heading.textContent='Vielleicht bereits vorhanden:';box.append(heading);
          for(const item of data.items){const article=document.createElement('article'),text=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('small'),link=document.createElement('a');name.textContent=item.label;meta.textContent=item.meta;link.href=item.detail_url;link.textContent='Eintrag öffnen →';text.append(name,meta);article.append(text,link);box.append(article);}
        }catch(error){if(error.name!=='AbortError'&&current===revision)box.textContent='Prüfung gerade nicht verfügbar. Du kannst den Eintrag trotzdem ausfüllen.';}
      },300);
    });
  }
  const suggestedName=new URLSearchParams(location.search).get('name');
  if(suggestedName){form.elements.name.value=suggestedName.slice(0,180);form.elements.name.dispatchEvent(new Event('input'));}
  validateIdentity();
  form.addEventListener('submit',async event=>{
    event.preventDefault(); validateIdentity(); if(!form.reportValidity())return;
    const button=form.querySelector('.entry-submit');button.disabled=true;message.textContent='Wird gespeichert …';
    let website=form.elements.website.value.trim();if(!/^https?:\/\//i.test(website))website='https://'+website;
    try {
      const response=await fetch('api/create_submission.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'doctor',simple_doctor:true,treatment_ids:window.LCNCatalogEntry?.treatmentIds()||[],name:form.elements.name.value.trim(),website,organization:form.elements.organization.value.trim(),primary_care:form.elements.primary_care.checked,address:form.elements.address.value.trim(),provider_type:form.querySelector('[name="provider_types"]:checked')?.value||'',provider_types:[...form.querySelectorAll('[name="provider_types"]:checked')].map(input=>input.value),country:form.elements.country.value.trim(),phone:form.elements.phone.value.trim(),email:form.elements.email.value.trim(),company:form.elements.company.value})});
      const data=await response.json();if(!response.ok||!data.ok||!data.submission_id)throw Error(data.error||'Eintrag konnte nicht gespeichert werden.');
      if(window.LCNCatalogEntry?.saved(data))return;
      location.href='arzt_detail.html?submission_id='+data.submission_id+'&neu=1';
    }catch(error){message.textContent=error.message;button.disabled=false;}
  });
});
function toggleMobileMenu(){document.querySelector('.main-nav ul')?.classList.toggle('show');}
// Reveal invalid fields inside collapsed optional sections before browser validation.
document.getElementById('entry-form')?.addEventListener('invalid', event => {
  const section = event.target.closest('.entry-step');
  if (section) section.open = true;
}, true);
