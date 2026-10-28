/* Persisted cost preferences; display conversion never changes answer categories. */
(()=>{
 const storageKey='lcn_cost_preferences';
 const currencies={EUR:['€','Euro'],CHF:['CHF','Schweizer Franken'],USD:['$','US-Dollar'],GBP:['£','Britisches Pfund']};
 const systems={DE:[['GKV','GKV'],['PKV','PKV'],['DE-ABROAD','Aus dem Ausland']],AT:[['AT-PUBLIC','Kassenarzt'],['AT-ELECTIVE','Wahlarzt'],['AT-ABROAD','Aus dem Ausland']],CH:[['CH-BASIC','Grundversicherung'],['CH-EXTRA','Zusatzversicherung'],['CH-ABROAD','Aus dem Ausland']]};
 let prefs={currency:'EUR',country:'DE',insurance:'GKV',customCountry:'',customCountryCode:''},reference=null,rateError=false;
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved){prefs.customCountry=String(saved.customCountry||'').slice(0,100);prefs.customCountryCode=/^[A-Z]{2}$/.test(saved.customCountryCode||'')?saved.customCountryCode:'';if(currencies[saved.currency])prefs.currency=saved.currency;if(systems[saved.country])prefs.country=saved.country;if(systems[prefs.country].some(([v])=>v===saved.insurance))prefs.insurance=saved.insurance;else prefs.insurance=systems[prefs.country][0][0];}}catch{}
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{}};
 const nativeCurrency=country=>(country||prefs.country)==='CH'?'CHF':'EUR';
 const amount=(label,currency=nativeCurrency())=>label.replaceAll('€',currencies[currency][0]);
 const converted=(label,base=nativeCurrency())=>{
   if(base===prefs.currency||!label.includes('€'))return '';
   if(!reference)return rateError?'Umrechnung nicht verfügbar':'Umrechnung lädt …';
   return '≈ '+label.replace(/[\d.]+/,match=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(Number(match.replaceAll('.',''))*reference.rates[prefs.currency]/reference.rates[base])).replaceAll('€',currencies[prefs.currency][0]);
 };
 const flag=country=>{
  const shapes={DE:'<path fill="#161616" d="M0 0h24v5H0z"/><path fill="#db2636" d="M0 5h24v5H0z"/><path fill="#ffcf40" d="M0 10h24v5H0z"/>',AT:'<path fill="#d92335" d="M0 0h24v15H0z"/><path fill="#fff" d="M0 5h24v5H0z"/>',CH:'<path fill="#d92335" d="M0 0h24v15H0z"/><path fill="#fff" d="M10 3h4v9h-4zM7 6h10v3H7z"/>'};
  return '<svg class="cost-country-flag" viewBox="0 0 24 15" aria-hidden="true">'+(shapes[country]||'<path fill="#e6eef6" d="M0 0h24v15H0z"/>')+'</svg>';
 };
 window.LCNCost={systems,currencies,get:()=>({...prefs}),nativeCurrency,amount,converted,flag,
 set:patch=>{if(/^[A-Z]{2}$/.test(patch.customCountryCode||''))prefs.customCountryCode=patch.customCountryCode;if(typeof patch.customCountry==='string')prefs.customCountry=patch.customCountry.trim().slice(0,100);if(patch.currency&&currencies[patch.currency])prefs.currency=patch.currency;if(patch.country&&systems[patch.country]){prefs.country=patch.country;if(!systems[prefs.country].some(([v])=>v===prefs.insurance))prefs.insurance=systems[prefs.country][0][0];}if(patch.insurance&&systems[prefs.country].some(([v])=>v===patch.insurance))prefs.insurance=patch.insurance;save();},
 context:()=>prefs.insurance+(nativeCurrency()==='EUR'?'':'-CHF'),
 label:()=>({DE:'Deutschland',AT:'Österreich',CH:'Schweiz',OTHER:prefs.customCountry||'Anderes Land'}[prefs.country])+' · '+systems[prefs.country].find(([v])=>v===prefs.insurance)[1]+' · '+nativeCurrency(),
 rateNote:base=>{if((base||nativeCurrency())===prefs.currency)return '';return reference?'EZB-Referenzkurs · '+reference.date.split('-').reverse().join('.')+(reference.cached?' · zuletzt verfügbar':''):(rateError?'Wechselkurs derzeit nicht verfügbar':'Wechselkurs wird geladen …');},
 countryControl:()=>'<label class="cost-preference cost-country-picker"><span class="cost-setting-label">Krankenversicherungssystem (Land)</span>'+flag(prefs.country)+'<select data-cost-country aria-label="Krankenversicherungssystem (Land)">'+Object.entries({DE:'Deutschland',AT:'Österreich',CH:'Schweiz'}).map(([v,label])=>'<option value="'+v+'"'+(v===prefs.country?' selected':'')+'>'+label.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</option>').join('')+'</select></label>',
 currencyControl:()=>'<label class="cost-preference cost-currency-picker" title="Zusätzliche Anzeigewährung"><span class="cost-setting-label">Währung</span><span class="cost-currency-symbol" aria-hidden="true">'+currencies[prefs.currency][0]+'</span><select data-cost-currency aria-label="Währung">'+Object.entries(currencies).map(([v,[symbol,name]])=>'<option value="'+v+'"'+(prefs.currency===v?' selected':'')+'>'+symbol+' '+name+'</option>').join('')+'</select></label>'};
 fetch('api/exchange_rates.php').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!data.ok||!data.rates||!['EUR','CHF','USD','GBP'].every(k=>Number.isFinite(data.rates[k])&&data.rates[k]>0))throw Error();reference=data;}).catch(()=>{rateError=true;}).finally(()=>window.dispatchEvent(new Event('lcn-exchange-rates')));
})();
