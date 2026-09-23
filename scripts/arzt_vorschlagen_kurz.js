document.addEventListener('DOMContentLoaded', () => {
  for (const [id, url] of [['header-placeholder','components/header.html'],['footer-placeholder','components/footer.html']]) fetch(url).then(r=>r.text()).then(html=>document.getElementById(id).innerHTML=html);
  const form=document.getElementById('entry-form'), message=document.getElementById('entry-message');
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
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(!form.reportValidity())return;
    const button=form.querySelector('button');button.disabled=true;message.textContent='Wird gespeichert …';
    let website=form.elements.website.value.trim();if(!/^https?:\/\//i.test(website))website='https://'+website;
    try {
      const response=await fetch('api/create_submission.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'doctor',simple_doctor:true,name:form.elements.name.value.trim(),website,organization:form.elements.organization.value.trim(),primary_care:form.elements.primary_care.checked,address:form.elements.address.value.trim(),company:form.elements.company.value})});
      const data=await response.json();if(!response.ok||!data.ok||!data.submission_id)throw Error(data.error||'Eintrag konnte nicht gespeichert werden.');
      location.href='arzt_detail.html?submission_id='+data.submission_id+'&neu=1';
    }catch(error){message.textContent=error.message;button.disabled=false;}
  });
});
function toggleMobileMenu(){document.querySelector('.main-nav ul')?.classList.toggle('show');}
