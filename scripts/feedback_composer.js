import * as reference from './feedback_page_reference.js?v=reference-default-20261107';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(params,write=false)=>{const r=await fetch('api/feedback.php'+(write?'':'?'+new URLSearchParams(params)),{credentials:'same-origin',cache:'no-store',...(write?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}:{})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Die Anfrage ist fehlgeschlagen.');return d;};
let pending;
export async function openComposer(mode='#privat',context){
 const trigger=document.activeElement;
 if(!pending)pending=mount(context).catch(e=>{pending=null;throw e;});
 const composer=await pending;
 composer.openMode(mode,trigger);
}
async function mount(context){
 await Promise.all(['styles/feedback.css?v=image-scene-20261107','styles/feedback_community.css?v=ai-images-20261106-1','styles/feedback_composer.css?v=image-refinement-20261107'].map(href=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=reject;document.head.append(link);})));
 const response=await fetch('components/feedback_composer.html?v=privacy-label-20261107');if(!response.ok)throw Error('Das Formular konnte nicht geladen werden.');
 const template=document.createElement('template');template.innerHTML=await response.text();
 const composer=template.content.querySelector('dialog');document.body.append(composer);
 const config=await api({action:'config'});
 const ideaForm=$('#fb-idea-form'),reportForm=$('#fb-report-form'),imagePicker=$('#fb-image-picker');
 const modeButtons=composer.querySelectorAll('[data-compose-mode]');
 const pageReference=reference.mountReference(ideaForm,context||reference.initialReference());
 const textField=form=>form.elements.description||form.elements.body;
 let activeForm=ideaForm,composeTrigger,submitting=false;
 composer.openMode=(mode,trigger)=>{
  if(submitting||!['#idee','#privat'].includes(mode))return;
  const form=mode==='#idee'?ideaForm:reportForm;
  if(form!==activeForm){
   const title=activeForm.elements.title.value;
   const titleChanged=form.elements.title.value!==title;
   form.elements.title.value=title;
   textField(form).value=textField(activeForm).value;
   form.prepend(pageReference.box);
   activeForm=form;
   if(form===ideaForm)updateImagePreview();
   if(form===ideaForm&&titleChanged){
    $('#fb-similar').hidden=true;
    form.elements.title.dispatchEvent(new Event('input'));
   }
  }
  $('#idee').hidden=mode!=='#idee';$('#privat').hidden=mode!=='#privat';
  composer.setAttribute('aria-labelledby',mode==='#idee'?'fb-idea-title':'fb-private-title');
  modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.composeMode===mode)));
  if(!composer.open){composeTrigger=trigger;composer.showModal();}
 };
 composer.querySelectorAll('[data-compose-mode]').forEach(b=>b.onclick=()=>composer.openMode(b.dataset.composeMode));
 composer.querySelector('[data-compose-close]').onclick=()=>composer.close();
 composer.addEventListener('close',()=>{if(['#idee','#privat'].includes(location.hash))history.replaceState(null,'',location.pathname+location.search);requestAnimationFrame(()=>composeTrigger?.focus());});
 function bindSubmit(form,action,done){
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(submitting||form!==activeForm||(form===ideaForm&&imageBusy))return;
   const button=form.querySelector('[type=submit]'),result=form.querySelector('[data-form-result]');
   const payload={...Object.fromEntries(new FormData(form)),action};
   submitting=true;
   modeButtons.forEach(b=>b.disabled=true);
   button.disabled=true;
   result.textContent='Wird gesendet …';
   try{
    const d=await api(payload,true);
    // Keep edits made while the request was in flight.
    if([...new FormData(form)].every(([name,value])=>payload[name]===value)){
     form.reset();
     pageReference.reset();
     const otherForm=form===ideaForm?reportForm:ideaForm;
     otherForm.elements.title.value='';
     textField(otherForm).value='';
     ideaForm.elements.title.dispatchEvent(new Event('input'));
     $('#fb-similar').hidden=true;
     done?.();
    }
    result.textContent=d.message||'Danke! Dein Beitrag ist eingegangen.';
   }catch(err){result.textContent=err.message;}
   finally{
    submitting=false;
    modeButtons.forEach(b=>b.disabled=false);
    button.disabled=false;
   }
  });
 }
 for(const form of composer.querySelectorAll('form')){const result=document.createElement('p');result.dataset.formResult='';result.setAttribute('role','status');result.setAttribute('aria-live','polite');form.append(result);}
 bindSubmit(ideaForm,'create',resetImage);
 bindSubmit(reportForm,'report');
  let imageBusy=false;
  function updateImagePreview(){
   $('[data-preview-title]').textContent=ideaForm.elements.title.value.trim()||'Dein Vorschlag';
   const description=ideaForm.elements.description.value.trim();
   const previewDescription=$('[data-preview-description]');
   previewDescription.textContent=description.slice(0,240)+(description.length>240?' …':'');
   previewDescription.hidden=!description;
  }
  const setImage=(id,choice,url)=>{
   ideaForm.elements.image_id.value=id;
   ideaForm.elements.image_choice.value=choice;
   const cover=$('#fb-image-preview .fb-card-cover');
   cover.closest('figure').hidden=!url;
   cover.hidden=!url;
   const image=cover.querySelector('img');
   if(url)image.src=url;else image.removeAttribute('src');
   $('#fb-image-options').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!id&&b.dataset.imageChoice===String(choice))));
  };
  function resetImage(){
   setImage('','','');
   $('#fb-image-status').textContent='';
   $('#fb-image-refinement').hidden=true;
   $('#fb-image-generate').disabled=false;
   $('#fb-image-generate').textContent='KI-Bild erstellen';
  }
  if(imagePicker&&config.image_selection){
   imagePicker.hidden=false;
   $('#fb-ai-options').hidden=!config.image_generation;
   $('#fb-image-privacy').hidden=!config.image_generation;
   if(!config.image_generation)$('#fb-image-status').textContent='Eigene KI-Bilder sind noch nicht freigeschaltet. Du kannst eines der vorhandenen Motive wählen.';
   const motifs=['Behandler:innen','Therapien','Symptome','Praxen','Kosten','Entfernung und Anfahrt','Videosprechstunde','Termine','Erfahrungsberichte'];
   $('#fb-image-options').innerHTML=motifs.map((name,i)=>`<button type="button" data-image-choice="${i+1}" aria-label="Motiv ${esc(name)} auswählen" aria-pressed="false"><img src="assets/images/feedback/motif-${String(i+1).padStart(2,'0')}.webp" alt="" width="100" height="100" loading="lazy"></button>`).join('')+
    '<button type="button" data-image-choice="" aria-pressed="true"><span class="fb-image-none"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></svg>Kein Bild</span></button>';
   $('#fb-image-options').addEventListener('click',e=>{
    const button=e.target.closest('[data-image-choice]');
    if(!button||imageBusy)return;
    setImage('',button.dataset.imageChoice,button.querySelector('img')?.getAttribute('src'));
    $('#fb-image-refinement').hidden=true;
    $('#fb-image-prompt').value='';
    $('#fb-image-status').textContent='';
    $('#fb-image-generate').textContent='KI-Bild erstellen';
   });
   ideaForm.elements.title.addEventListener('input',updateImagePreview);
   ideaForm.elements.description.addEventListener('input',updateImagePreview);
   $('#fb-image-generate').onclick=async()=>{
    if(imageBusy||submitting)return;
    const prompt=$('#fb-image-prompt'),status=$('#fb-image-status');
    const button=$('#fb-image-generate'),refinement=$('#fb-image-refinement');
    if(ideaForm.elements.image_id.value&&refinement.hidden){
     refinement.hidden=false;
     button.textContent='Neue Variante erstellen';
     prompt.focus({preventScroll:true});
     refinement.scrollIntoView({block:'nearest'});
     return;
    }
    const title=ideaForm.elements.title.value.trim();
    const description=ideaForm.elements.description.value.trim();
    const subject=Array.from(prompt.value.trim()||[title,description].filter(Boolean).join('\n')).slice(0,500).join('');
    if(subject.length<5){
     status.textContent='Gib zuerst einen Titel oder eine Beschreibung ein.';
     ideaForm.elements.title.focus();
     return;
    }
    imageBusy=true;
    const submit=ideaForm.querySelector('[type=submit]');
    button.disabled=true;
    submit.disabled=true;
    imagePicker.setAttribute('aria-busy','true');
    status.textContent='Dein Bild wird erstellt. Das kann einen Moment dauern …';
    try{
     const response=await fetch('api/feedback_image.php',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:subject})
     });
     const data=await response.json();
     if(!response.ok||!data.ok)throw Error(data.error||'Das Bild konnte nicht erstellt werden.');
     setImage(data.image_id,'',data.url);
     refinement.hidden=true;
     button.textContent='Erneut Bild erstellen';
     status.textContent='Das Bild ist ausgewählt und wird mit deinem Vorschlag eingereicht.';
    }
    catch(err){status.textContent=err.message+' Deine bisherige Bildauswahl bleibt erhalten.';}
    finally{imageBusy=false;imagePicker.removeAttribute('aria-busy');button.disabled=false;submit.disabled=false;}
   };
  }
  let similarTimer,similarSeq=0;$('#fb-idea-form').elements.title.addEventListener('input',e=>{clearTimeout(similarTimer);const seq=++similarSeq,title=e.target.value;similarTimer=setTimeout(async()=>{const node=$('#fb-similar');if(title.length<5){node.hidden=true;return;}try{const d=await api({action:'list',q:title});if(seq!==similarSeq)return;node.hidden=!d.items.length;node.innerHTML='<strong>Gibt es deine Idee schon?</strong><p>Du kannst einen vorhandenen Vorschlag öffnen und unterstützen.</p><ul>'+d.items.slice(0,4).map(r=>`<li><a href="mitgestalten.html?id=${r.id}">${esc(r.title)}</a> · ${Number(r.votes)} Unterstützungen</li>`).join('')+'</ul>';}catch(_){node.hidden=true;}},350);});

 return composer;
}
