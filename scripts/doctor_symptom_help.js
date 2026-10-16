(()=>{
 let cached=null,controller=null,timer;
 const doctorId=Number(new URLSearchParams(location.search).get('id'));
 if(!doctorId)return;
 function mount(){
 const root=document.querySelector('[data-doctor-symptom-help]');if(!root||root.dataset.mounted)return;
 controller?.abort();controller=new AbortController();root.dataset.mounted='1';
 let symptomHelp=cached||{symptoms:[],catalog:[]},busy=false,loaded=Boolean(cached);
 function notify(message){const feedback=document.getElementById('feedback');if(!feedback)return;clearTimeout(timer);feedback.textContent=message;feedback.classList.add('visible');timer=setTimeout(()=>feedback.classList.remove('visible'),4000);}
 async function sync(payload){if(busy)return;busy=true;renderSymptomHelp();if(payload)notify('Wird gespeichert …');try{
 const response=await fetch('api/doctor_symptom_help.php'+(payload?'':'?dr_id='+doctorId),payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dr_id:doctorId,symptom_id:Number(payload.question.replace('symptom-help-','')),action:payload.action||'answer'})}:{cache:'no-store'});
 const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Symptome konnten nicht geladen werden.');cached=symptomHelp=data.symptom_help;loaded=true;if(payload)notify(payload.action==='clear'?'Deine Stimme wurde zurückgenommen.':'Deine Angabe wurde gespeichert.');
 }catch(error){notify(error.message);}finally{busy=false;renderSymptomHelp();}}
  let symptomSearch='',symptomOpen=false,symptomActive=-1;
  function closeSymptomPicker(){symptomOpen=false;symptomActive=-1;filterSymptomPicker();}
  function filterSymptomPicker(){
    const picker=root.querySelector('[data-symptom-picker]'),input=root.querySelector('[data-symptom-search]'),toggle=root.querySelector('[data-symptom-toggle]');if(!picker||!input)return;
    const ids=new Set(symptomHelp.symptoms.map(r=>r.id));
    const matches=window.LCNSymptomSearch.search(symptomHelp.catalog.filter(s=>!ids.has(s.id)),symptomSearch);
    picker.replaceChildren();input.disabled=toggle.disabled=busy||!loaded;picker.hidden=!symptomOpen;input.setAttribute('aria-expanded',String(symptomOpen));toggle.setAttribute('aria-expanded',String(symptomOpen));input.removeAttribute('aria-activedescendant');
    if(symptomActive>=matches.length)symptomActive=-1;
    matches.forEach((symptom,i)=>{const option=document.createElement('button');option.type='button';option.id='symptom-option-'+symptom.id;option.dataset.symptomSuggestion=String(symptom.id);option.setAttribute('role','option');option.setAttribute('aria-selected',String(i===symptomActive));option.tabIndex=-1;option.textContent=symptom.name;option.disabled=busy||!loaded;picker.append(option);if(i===symptomActive)input.setAttribute('aria-activedescendant',option.id);});
    if(!matches.length){const empty=document.createElement('p');empty.textContent='Keine passenden weiteren Symptome';empty.setAttribute('role','status');picker.append(empty);}
  }
  function selectSymptom(id){if(busy||!loaded)return;symptomSearch='';root.querySelector('[data-symptom-search]').value='';closeSymptomPicker();sync({question:'symptom-help-'+id,value:'Ja'});}
  root.addEventListener('input',event=>{if(!event.target.matches('[data-symptom-search]'))return;symptomSearch=event.target.value;symptomOpen=true;symptomActive=-1;filterSymptomPicker();});
  root.addEventListener('click',event=>{if(event.target.matches('[data-symptom-search]')){symptomOpen=true;filterSymptomPicker();}const toggle=event.target.closest('[data-symptom-toggle]');if(toggle){symptomOpen=!symptomOpen;filterSymptomPicker();root.querySelector('[data-symptom-search]').focus();}const option=event.target.closest('[data-symptom-suggestion]');if(option)selectSymptom(option.dataset.symptomSuggestion);});
  root.addEventListener('keydown',event=>{if(!event.target.matches('[data-symptom-search]'))return;if(event.key==='Escape'){closeSymptomPicker();return;}if(event.key==='Tab'){closeSymptomPicker();return;}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();symptomOpen=true;const count=root.querySelectorAll('[data-symptom-suggestion]').length;symptomActive=count?(symptomActive+(event.key==='ArrowDown'?1:-1)+count)%count:-1;filterSymptomPicker();root.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'){event.preventDefault();const option=root.querySelector('[role="option"][aria-selected="true"]');if(option)selectSymptom(option.dataset.symptomSuggestion);}});
  document.addEventListener('click',event=>{if(!event.target.closest('[data-symptom-combobox]'))closeSymptomPicker();},{signal:controller.signal});
  function renderSymptomHelp(){
    const list=root.querySelector('[data-symptom-ranking]'),picker=root.querySelector('[data-symptom-picker]');
    if(!list||!picker)return;
    const focused=document.activeElement?.dataset.symptomId;
    const rows=symptomHelp.symptoms.map(symptom=>({...symptom})).sort((a,b)=>b.count-a.count||a.default_order-b.default_order||a.name.localeCompare(b.name,'de'));
    list.replaceChildren();
    rows.forEach(symptom=>{
      const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.symptomId=String(symptom.id);button.setAttribute('aria-pressed',String(symptom.selected));button.disabled=busy||!loaded;
      const label=document.createElement('span');label.textContent=symptom.name;
      const count=document.createElement('strong');count.textContent=symptom.count+' '+(symptom.count===1?'Person':'Personen');
      const check=document.createElement('span');check.className='ux-symptom-check';check.textContent=symptom.selected?'✓':'＋';check.setAttribute('aria-hidden','true');
      button.setAttribute('aria-label',symptom.name+': '+symptom.count+' hilfreiche Erfahrungen'+(symptom.selected?' – eigene Stimme zurücknehmen':' – hat mir geholfen'));
      button.append(label,count,check);li.append(button);list.append(li);
    });
    if(!rows.length){const empty=document.createElement('li');empty.className='ux-symptom-empty';empty.textContent=loaded?'Wähle unten ein Symptom aus, bei dem dir die Therapie geholfen hat.':'Symptome werden geladen …';list.append(empty);}
    filterSymptomPicker();
    if(focused)list.querySelector('[data-symptom-id="'+focused+'"]')?.focus({preventScroll:true});
  }
  root.addEventListener('click',event=>{const button=event.target.closest('[data-symptom-id]');if(!button||busy||!loaded)return;const symptom=symptomHelp.symptoms.find(s=>s.id===Number(button.dataset.symptomId));if(!symptom)return;sync({action:symptom.selected?'clear':'answer',question:'symptom-help-'+symptom.id,value:'Ja'});});

 if(cached)renderSymptomHelp();else sync();
 }
 window.addEventListener('lcn-doctor-rendered',mount);mount();
})();
