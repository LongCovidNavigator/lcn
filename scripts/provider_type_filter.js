/* Canonical categories also persisted by the provider taxonomy migration. */
const providerPersonLabels = ['Ärztinnen','Coach und Beraterinnen','Ergotherapeutinnen','Heilpraktikerinnen','Naturheilkundlerinnen','Pflegepersonen','Physiotherapeutinnen','Psychologinnen','Psychotherapeutinnen','Therapeutinnen','Logopädinnen','Ernährungsberaterinnen','Osteopathinnen','Content-Creatorinnen'];
const providerTypeAliases = {
 doctor:'Ärztinnen',physician:'Ärztinnen',Arzt:'Ärztinnen',
 'Coach und Berater':'Coach und Beraterinnen',coach:'Coach und Beraterinnen','Gesundheitsberaterin / Coach':'Coach und Beraterinnen','Therapeut\nCoach und Berater':'Coach und Beraterinnen',
 Ergotherapeut:'Ergotherapeutinnen',occupational_therapist:'Ergotherapeutinnen','Ergotherapeut\nTherapeut':'Ergotherapeutinnen',
 Heilpraktiker:'Heilpraktikerinnen',alternative_practitioner:'Heilpraktikerinnen',heilpraktiker:'Heilpraktikerinnen',
 Naturheilkundler:'Naturheilkundlerinnen',naturopath:'Naturheilkundlerinnen','Naturheilkundler\nPhysiotherapeut':'Physiotherapeutinnen',
 Physiotherapeut:'Physiotherapeutinnen',physiotherapist:'Physiotherapeutinnen',Psychologe:'Psychologinnen',psychologist:'Psychologinnen',Psychotherapeut:'Psychotherapeutinnen',psychotherapist:'Psychotherapeutinnen',
 Therapeut:'Therapeutinnen',therapist:'Therapeutinnen','Therapeut\nSporttherapeut':'Therapeutinnen',sports_therapist:'Therapeutinnen',Pflegeperson:'Pflegepersonen',
 speech_therapist:'Logopädinnen',nutrition_counsellor:'Ernährungsberaterinnen',osteopath:'Osteopathinnen',content_creator:'Content-Creatorinnen',
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
 const groupOf=d=>providerPersonLabels.includes(typeOf(d))?'person':'institution';
 const count=rows=>new Set(rows.map(d=>d.dr_id)).size;
 const group=window.providerTypeGroup||'';
 const scoped=group?doctors.filter(d=>typeOf(d)&&groupOf(d)===group):doctors;
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
 picker.querySelector('.provider-filter-groups').replaceChildren(...[['','Alle'],['person','Einzelperson'],['institution','Institution']].map(([g,label])=>button(label,count(g?doctors.filter(d=>typeOf(d)&&groupOf(d)===g):doctors),()=>choose('',g),group===g)));
 picker.querySelector('.provider-filter-options').replaceChildren(button('Alle Behandlerarten',count(scoped),()=>{choose('',group);picker.open=false;},!active),...types.map(t=>button(t,count(scoped.filter(d=>typeOf(d)===t)),()=>{choose(t,group);picker.open=false;},active===t)));
 picker.querySelector('summary').textContent=active||(group==='person'?'Alle Einzelpersonen':group==='institution'?'Alle Institutionen':'Alle Behandlerarten');
 if(!picker.dataset.bound){picker.dataset.bound='1';document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.open=false;});picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});}
 return active?scoped.filter(d=>typeOf(d)===active):scoped;
}
