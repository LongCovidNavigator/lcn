// Same location wording and explicit submit action on both catalog searches.
document.addEventListener('DOMContentLoaded',()=>{
 for(const prefix of ['doctor','treatment']){
  const input=document.getElementById(prefix+'-location-input');if(!input)continue;
  const label=document.querySelector('label[for="'+input.id+'"]');if(label)label.textContent='Adresse, PLZ oder Ort';
  input.placeholder='z. B. 50667 oder Köln';
  const button=document.createElement('button');button.type='button';button.className='lcn-map-submit';button.textContent='Standort übernehmen';
  button.addEventListener('click',()=>{if(prefix==='doctor')applySearchFromControls();else applyTreatmentLocationFromInput();});
  input.closest('div').after(button);
  const hint=document.createElement('p');hint.className='lcn-map-help';hint.textContent='Entfernung als Luftlinie. Dieser Standort wird auf den übrigen LCN-Seiten übernommen.';button.after(hint);
 }
});
