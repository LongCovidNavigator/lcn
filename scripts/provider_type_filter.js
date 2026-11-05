/* Canonical categories also persisted by the provider taxonomy migration. */
const providerPersonLabels = ['Ärzt:in','Coach und Berater:in','Ergotherapeut:in','Heilpraktiker:in','Naturheilkundler:in','Pflegeperson','Physiotherapeut:in','Psycholog:in','Psychotherapeut:in','Therapeut:in','Logopäd:in','Ernährungsberater:in','Osteopath:in','Content-Creator:in'];
const providerTypeAliases = {
 "Ärztinnen":"Ärzt:in","Coach und Beraterinnen":"Coach und Berater:in","Ergotherapeutinnen":"Ergotherapeut:in","Heilpraktikerinnen":"Heilpraktiker:in","Naturheilkundlerinnen":"Naturheilkundler:in","Physiotherapeutinnen":"Physiotherapeut:in","Psychologinnen":"Psycholog:in","Psychotherapeutinnen":"Psychotherapeut:in","Therapeutinnen":"Therapeut:in","Logopädinnen":"Logopäd:in","Ernährungsberaterinnen":"Ernährungsberater:in","Osteopathinnen":"Osteopath:in","Content-Creatorinnen":"Content-Creator:in","Pflegepersonen":"Pflegeperson",
 doctor:'Ärzt:in',physician:'Ärzt:in',Arzt:'Ärzt:in',
 'Coach und Berater':'Coach und Berater:in',coach:'Coach und Berater:in','Gesundheitsberaterin / Coach':'Coach und Berater:in','Therapeut\nCoach und Berater':'Coach und Berater:in',
 Ergotherapeut:'Ergotherapeut:in',occupational_therapist:'Ergotherapeut:in','Ergotherapeut\nTherapeut':'Ergotherapeut:in',
 Heilpraktiker:'Heilpraktiker:in',alternative_practitioner:'Heilpraktiker:in',heilpraktiker:'Heilpraktiker:in',
 Naturheilkundler:'Naturheilkundler:in',naturopath:'Naturheilkundler:in','Naturheilkundler\nPhysiotherapeut':'Physiotherapeut:in',
 Physiotherapeut:'Physiotherapeut:in',physiotherapist:'Physiotherapeut:in',Psychologe:'Psycholog:in',psychologist:'Psycholog:in',Psychotherapeut:'Psychotherapeut:in',psychotherapist:'Psychotherapeut:in',
 Therapeut:'Therapeut:in',therapist:'Therapeut:in','Therapeut\nSporttherapeut':'Therapeut:in',sports_therapist:'Therapeut:in',Pflegeperson:'Pflegeperson',
 speech_therapist:'Logopäd:in',nutrition_counsellor:'Ernährungsberater:in',osteopath:'Osteopath:in',content_creator:'Content-Creator:in',
 practice:'Praxis',clinic:'Klinik',therapy_center:'Therapiezentrum',Ambulanz:'Klinik','Klinik / Ambulanz':'Klinik','Klinik/Ambulanz':'Klinik','Online-Praxis':'Praxis',Rehabilitationszentrum:'Reha',
 other:'',Behandler:'',Institution:'','Andere Anlaufstelle':'','Andere Anlaufstellen':''
};
function canonicalProviderType(value) {
 const type=String(value||'').trim();
 return Object.hasOwn(providerTypeAliases,type)?providerTypeAliases[type]:type;
}
function renderProviderTypePicker(doctors, select) {
 const picker=document.getElementById('provider-type-picker');
 if(!picker)return doctors;
 const typeOf=d=>canonicalProviderType(d.dr_type);
 const groupOf=d=>d.dr_entity_kind==='Behandler'?'person':d.dr_entity_kind==='Institution'?'institution':typeOf(d)?(providerPersonLabels.includes(typeOf(d))?'person':'institution'):'';
 const count=rows=>new Set(rows.map(d=>d.dr_id)).size;
 const group=window.providerTypeGroup||'';
 const scoped=group?doctors.filter(d=>groupOf(d)===group):doctors;
 const types=[...new Set(scoped.map(typeOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
 const selected=select.value;
 select.replaceChildren(new Option('Alle Behandlerarten',''),...types.map(t=>new Option(t,t)));
 select.value=types.includes(selected)?selected:'';
 const active=select.value;
 const choose=(value,nextGroup)=>{select.value=value;window.providerTypeGroup=nextGroup;select.dispatchEvent(new Event('change',{bubbles:true}));};
 const button=(label,n,onClick,pressed)=>{
  const el=document.createElement('button');el.type='button';el.className='provider-filter-option';el.setAttribute('aria-pressed',String(pressed));
  const text=document.createElement('span');text.textContent=label;
  const total=document.createElement('span');total.className='provider-filter-count';total.textContent=`(${n})`;el.append(text,total);el.addEventListener('click',onClick);return el;
 };
 picker.querySelector('.provider-filter-groups').replaceChildren(...[['','Alle'],['person','Einzelperson'],['institution','Institution']].map(([g,label])=>button(label,count(g?doctors.filter(d=>groupOf(d)===g):doctors),()=>choose('',g),group===g)));
 picker.querySelector('.provider-filter-options').replaceChildren(button('Alle Behandlerarten',count(scoped),()=>{choose('',group);picker.open=false;},!active),...types.map(t=>button(t,count(scoped.filter(d=>typeOf(d)===t)),()=>{choose(t,group);picker.open=false;},active===t)));
 picker.querySelector('summary').textContent=active||(group==='person'?'Alle Einzelpersonen':group==='institution'?'Alle Institutionen':'Alle Behandlerarten');
 if(!picker.dataset.bound){picker.dataset.bound='1';document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.open=false;});picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});}
 return active?scoped.filter(d=>typeOf(d)===active):scoped;
}
