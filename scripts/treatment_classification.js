/* A classification choice is independent of votes on links between entries. */
document.addEventListener('DOMContentLoaded',()=>{
 const labels={group:'Medikamentengruppe',ingredient:'Wirkstoff',brand:'Handelsname'};
 document.querySelectorAll('[data-treatment-classification]').forEach(opener=>opener.addEventListener('click',async()=>{
  const dialog=document.createElement('dialog');dialog.className='catalog-report-dialog ux-classification-dialog';
  const title=document.createElement('h3');title.id='classification-dialog-title';title.textContent='Einordnung prüfen';dialog.setAttribute('aria-labelledby',title.id);
  const description=document.createElement('p');description.textContent='Wie ordnest du „'+opener.dataset.classificationName+'“ ein? Aktuell: '+labels[opener.dataset.classificationCurrent]+'.';
  const help=document.createElement('p');help.textContent='Bestätige die aktuelle Einordnung oder wähle eine andere. Deine Auswahl wird als Rückmeldung gespeichert; die angezeigte Einordnung ändert sich dadurch nicht sofort.';
  const choices=document.createElement('div');choices.className='ux-classification-choices';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Rückmeldungen werden geladen …';
  const close=document.createElement('button');close.type='button';close.textContent='Schließen';close.addEventListener('click',()=>dialog.close());
  let data={},busy=true;
  const buttons=[];
  function paint(){for(const button of buttons){const role=button.dataset.role,value=data[role]||{count:0,own:false};button.textContent=labels[role]+(role===opener.dataset.classificationCurrent?' · Aktuell':'')+' · '+value.count;button.setAttribute('aria-pressed',String(value.own));button.disabled=busy;}}
  async function request(body){const response=await fetch('api/treatment_classification_feedback.php'+(body?'':'?id='+opener.dataset.treatmentClassification),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Rückmeldung konnte nicht gespeichert werden.');return result.choices;}
  for(const role of Object.keys(labels)){const button=document.createElement('button');button.type='button';button.dataset.role=role;buttons.push(button);choices.append(button);button.addEventListener('click',async()=>{const choice=data[role]?.own?'':role;busy=true;paint();try{data=await request({id:Number(opener.dataset.treatmentClassification),choice});status.textContent=choice?'Gespeichert: '+labels[role]+'.':'Deine Rückmeldung wurde zurückgenommen.';}catch(error){status.textContent=error.message;}finally{busy=false;paint();}});}
  paint();dialog.append(title,description,help,choices,status,close);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();opener.focus();});dialog.showModal();
  try{data=await request();busy=false;status.textContent='Eine Auswahl pro Person. Erneut anklicken nimmt deine Rückmeldung zurück.';paint();}catch(error){status.textContent=error.message;}
 }));
});
