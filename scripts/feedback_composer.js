import * as reference from './feedback_page_reference.js?v=reference-first-2';
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
 await Promise.all(['styles/feedback.css?v=ai-images-20261106-1','styles/feedback_community.css?v=ai-images-20261106-1','styles/feedback_composer.css?v=alignment-2'].map(href=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=reject;document.head.append(link);}))); 
 const response=await fetch('components/feedback_composer.html?v=private-3');if(!response.ok)throw Error('Das Formular konnte nicht geladen werden.');
 const template=document.createElement('template');template.innerHTML=await response.text();
 const composer=template.content.querySelector('dialog');document.body.append(composer);
 const config=await api({action:'config'});
 let composeTrigger;
 composer.openMode=(mode,trigger)=>{if(!['#idee','#privat'].includes(mode))return;$('#idee').hidden=mode!=='#idee';$('#privat').hidden=mode!=='#privat';composer.setAttribute('aria-labelledby',mode==='#idee'?'fb-idea-title':'fb-private-title');composer.querySelectorAll('[data-compose-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.composeMode===mode)));if(!composer.open){composeTrigger=trigger;composer.showModal();}};
 composer.querySelectorAll('[data-compose-mode]').forEach(b=>b.onclick=()=>composer.openMode(b.dataset.composeMode));
 composer.querySelector('[data-compose-close]').onclick=()=>composer.close();
 composer.addEventListener('close',()=>{if(['#idee','#privat'].includes(location.hash))history.replaceState(null,'',location.pathname+location.search);requestAnimationFrame(()=>composeTrigger?.focus());});
 const origin=context||reference.initialReference();reference.mountReference($('#fb-idea-form'),origin);reference.mountReference($('#fb-report-form'),origin);
 function bindSubmit(form,action,done){form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('[type=submit]'),result=form.querySelector('[data-form-result]');button.disabled=true;result.textContent='Wird gesendet …';try{const d=await api({...Object.fromEntries(new FormData(form)),action},true);done();result.textContent=d.message||'Danke! Dein Beitrag ist eingegangen.';}catch(err){result.textContent=err.message;}finally{button.disabled=false;}});}
 for(const form of composer.querySelectorAll('form')){const result=document.createElement('p');result.dataset.formResult='';result.setAttribute('role','status');result.setAttribute('aria-live','polite');form.append(result);}
 bindSubmit($('#fb-idea-form'),'create',()=>{$('#fb-idea-form').reset();$('#fb-similar').hidden=true;resetImage();});
 bindSubmit($('#fb-report-form'),'report',()=>$('#fb-report-form').reset());
  const ideaForm=$('#fb-idea-form'),imagePicker=$('#fb-image-picker');
  let imageDraft=crypto.randomUUID().replaceAll('-',''),imageBusy=false,imageAttempts=0;
  const setImage=(id,choice,url)=>{ideaForm.elements.image_id.value=id;ideaForm.elements.image_choice.value=choice;const preview=$('#fb-image-preview');preview.hidden=!url;if(url)preview.querySelector('img').src=url;else preview.querySelector('img').removeAttribute('src');$('#fb-image-options').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.imageChoice===String(choice))));};
  function resetImage(){imageDraft=crypto.randomUUID().replaceAll('-','');imageAttempts=0;setImage('','','');$('#fb-image-status').textContent='';$('#fb-image-generate').disabled=false;$('#fb-image-generate').textContent='Bild erstellen';}
  if(imagePicker&&config.image_selection){
   imagePicker.hidden=false;$('#fb-ai-options').hidden=!config.image_generation;$('#fb-ai-options').addEventListener('toggle',()=>{if($('#fb-ai-options').open&&!$('#fb-image-prompt').value)$('#fb-image-prompt').value=ideaForm.elements.title.value.slice(0,500);});
   if(!config.image_generation)$('#fb-image-status').textContent='Eigene KI-Bilder sind noch nicht freigeschaltet. Du kannst eines der vorhandenen Motive wählen.';
   const motifs=['Klemmbrett','Lupe','Sprechblasen','Landkarte','Buch','Kalender','Verbindungen','Glühbirne','Schutzschild','Einstellungen','Kompass','Weg','Ordner','Puzzle','Pflanze','Brief','Helfende Hände','Lesezeichen','Brücke','Formenkreis'];
   $('#fb-image-options').innerHTML=motifs.map((name,i)=>`<button type="button" data-image-choice="${i+1}" aria-label="Motiv ${esc(name)} auswählen" aria-pressed="false"><img src="assets/images/feedback/idea-${String(i+1).padStart(2,'0')}.webp" alt="" width="100" height="100" loading="lazy"></button>`).join('');
   $('#fb-image-options').addEventListener('click',e=>{const b=e.target.closest('[data-image-choice]');if(!b||imageBusy)return;setImage('',b.dataset.imageChoice,b.querySelector('img').getAttribute('src'));});
   $('#fb-image-remove').onclick=()=>{if(!imageBusy)setImage('','','');};
   $('#fb-image-generate').onclick=async()=>{
    const prompt=$('#fb-image-prompt'),consent=$('#fb-image-consent'),status=$('#fb-image-status');
    if(imageBusy)return;if(prompt.value.trim().length<5){status.textContent='Bitte beschreibe dein Wunschmotiv mit mindestens fünf Zeichen.';prompt.focus();return;}
    if(!consent.checked){status.textContent='Bitte bestätige die Übermittlung deiner Bildbeschreibung an Cloudflare.';consent.focus();return;}
    imageBusy=true;imageAttempts++;const button=$('#fb-image-generate'),submit=ideaForm.querySelector('[type=submit]');button.disabled=true;submit.disabled=true;imagePicker.setAttribute('aria-busy','true');status.textContent='Dein Bild wird erstellt. Das kann einen Moment dauern …';
    try{const response=await fetch('api/feedback_image.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt.value.trim(),draft_id:imageDraft})});const d=await response.json();if(!response.ok||!d.ok)throw Error(d.error||'Das Bild konnte nicht erstellt werden.');setImage(d.image_id,'',d.url);imageAttempts=2-Number(d.remaining);status.textContent='Das Bild ist ausgewählt und wird mit deinem Vorschlag eingereicht.';}
    catch(err){status.textContent=err.message+' Deine bisherige Bildauswahl bleibt erhalten.';}
    finally{imageBusy=false;imagePicker.removeAttribute('aria-busy');button.disabled=imageAttempts>=2;submit.disabled=false;button.textContent=imageAttempts>=2?'Zwei Versuche verwendet':'Weitere Variante erstellen';}
   };
  }
  let similarTimer,similarSeq=0;$('#fb-idea-form').elements.title.addEventListener('input',e=>{clearTimeout(similarTimer);const seq=++similarSeq,title=e.target.value;similarTimer=setTimeout(async()=>{const node=$('#fb-similar');if(title.length<5){node.hidden=true;return;}try{const d=await api({action:'list',q:title});if(seq!==similarSeq)return;node.hidden=!d.items.length;node.innerHTML='<strong>Gibt es deine Idee schon?</strong><p>Du kannst einen vorhandenen Vorschlag öffnen und unterstützen.</p><ul>'+d.items.slice(0,4).map(r=>`<li><a href="mitgestalten.html?id=${r.id}">${esc(r.title)}</a> · ${Number(r.votes)} Unterstützungen</li>`).join('')+'</ul>';}catch(_){node.hidden=true;}},350);});

 return composer;
}
