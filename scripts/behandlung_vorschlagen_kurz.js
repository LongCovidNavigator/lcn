document.addEventListener('DOMContentLoaded', () => {
  for (const [id, url] of [['header-placeholder','components/header.html'],['footer-placeholder','components/footer.html']]) fetch(url).then(r=>r.text()).then(html=>document.getElementById(id).innerHTML=html);
  const form=document.getElementById('entry-form'), message=document.getElementById('entry-message');
  for (const field of [form.elements.name]) {
    const box=document.createElement('div');box.className='duplicate-check';box.setAttribute('aria-live','polite');field.closest('label').after(box);
    let timer,controller,revision=0;
    field.addEventListener('input',()=>{
      clearTimeout(timer);controller?.abort();const current=++revision;box.replaceChildren();
      const query=field.value.trim();if(query.length<2)return;
      box.textContent='Vorhandene Einträge werden geprüft …';
      timer=setTimeout(async()=>{
        controller=new AbortController();
        try {
          const response=await fetch('api/submission_duplicate_search.php?type=treatment&catalog=current&q='+encodeURIComponent(query),{signal:controller.signal,cache:'no-store'});
          const data=await response.json();if(current!==revision)return;if(!response.ok||!data.ok)throw Error();
          box.replaceChildren();
          if(!data.items.length){box.textContent='Kein passender vorhandener Eintrag gefunden.';return;}
          const heading=document.createElement('strong');heading.textContent='Vielleicht bereits vorhanden:';box.append(heading);
          for(const item of data.items){const article=document.createElement('article'),text=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('small'),link=document.createElement('a');name.textContent=item.label;meta.textContent=item.meta;link.href=item.detail_url;link.textContent='Eintrag öffnen →';text.append(name,meta);article.append(text,link);box.append(article);}
        }catch(error){if(error.name!=='AbortError'&&current===revision)box.textContent='Prüfung gerade nicht verfügbar. Du kannst den Eintrag trotzdem ausfüllen.';}
      },300);
    });
  }
  const existingId=Number(new URLSearchParams(location.search).get('existing_target_id'));
  if(existingId>0)fetch('api/submission_existing_detail.php?type=treatment&id='+existingId).then(r=>r.json()).then(data=>{const entry=data.item||data.data;if(entry){form.elements.name.value=entry.name||'';form.elements.website.value=entry.website||'';}}).catch(()=>{});
  let saving=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(saving||!form.reportValidity())return;saving=true;
    const button=form.querySelector('button');button.disabled=true;message.textContent='Wird gespeichert …';
    let website=form.elements.website.value.trim();if(website && !/^https?:\/\//i.test(website))website='https://'+website;
    try {
      const response=await fetch('api/create_submission.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'treatment',simple_treatment:true,name:form.elements.name.value.trim(),website,company:form.elements.company.value,existing_target_id:Number(new URLSearchParams(location.search).get('existing_target_id'))||undefined})});
      const data=await response.json();if(!response.ok||!data.ok||!data.submission_id)throw Error(data.error||'Eintrag konnte nicht gespeichert werden.');
      form.reset();form.elements.name.dispatchEvent(new Event('input'));
      message.textContent=existingId>0?'Danke! Dein Änderungsvorschlag wurde zur Prüfung gespeichert.':'Danke! Dein Vorschlag wurde gespeichert und erscheint als noch nicht geprüft im Katalog. Wir übernehmen die weitere Recherche.';button.disabled=false;
    }catch(error){message.textContent=error.message;button.disabled=false;}finally{saving=false;}
  });
});
function toggleMobileMenu(){document.querySelector('.main-nav ul')?.classList.toggle('show');}
