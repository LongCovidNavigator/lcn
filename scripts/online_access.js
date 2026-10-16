/* One shared online-appointment indicator for all maps and provider lists. */
(()=>{
 if(window.LCNOnline)return;
 let doctors={},scheduled=false;const markers=new Set();
 const get=id=>doctors[Number(id)]||{first:false,follow:false,complete:false};
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="#248965" stroke="#176748" d="M12.5 40C10 34 1 23 1 13a11.5 11.5 0 0 1 23 0c0 10-9 21-11.5 27Z"/><circle cx="12.5" cy="13" r="5" fill="white"/></svg>';
 const green='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 function paint(record){if(!window.L)return;if(!record.ids.some(id=>get(id).first)){if(record.painted)record.marker.setIcon(record.original);record.painted=false;return;}record.painted=true;const n=record.ids.length;record.marker.setIcon(n>1?L.divIcon({className:'lcn-online-marker',html:'<img src="'+green+'" alt=""><span>'+n+'</span>',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[0,-35]}):L.icon({iconUrl:green,iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[0,-35]}));}
 function decorate(){scheduled=false;
   document.querySelectorAll('.doctor-card a[href*="arzt_detail"],.nd-map-results a[href*="arzt_detail"],.doctor-table-name a[href*="arzt_detail"],.leaflet-popup-content a[href*="arzt_detail"],#featured-experts-list a[href*="arzt_detail"]').forEach(link=>{
     const id=new URL(link.href,location.href).searchParams.get('id'),access=get(id);let badge=link.nextElementSibling?.classList.contains('lcn-online-badge')?link.nextElementSibling:null;
     if(!access.first){badge?.remove();return;}if(!badge){badge=document.createElement('span');badge.className='lcn-online-badge';link.after(badge);}const label=access.complete?'Erst- und Folgetermine online':'Online-Ersttermin';if(badge.textContent!==label)badge.textContent=label;
   });
   document.querySelectorAll('#profile-map + .lcn-online-legend').forEach(legend=>legend.remove());
   document.querySelectorAll('.leaflet-container:not(#profile-map)').forEach(canvas=>{const provider=canvas.closest('.nd-provider-map');if(provider?.querySelector('.lcn-online-legend')||canvas.parentElement.querySelector(':scope > .lcn-online-legend'))return;const legend=document.createElement('div');legend.className='lcn-online-legend';legend.innerHTML='<span><i class="online-green"></i>Online-Ersttermin möglich (bei Gruppen mindestens ein Anbieter)</span><span><i class="online-blue"></i>Online-Ersttermin nicht bestätigt</span><span><i class="online-red"></i>Dein Standort</span>';if(provider?.querySelector('.nd-map-notes'))provider.querySelector('.nd-map-notes').prepend(legend);else canvas.after(legend);});
 }
 const queue=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(decorate);}};
 window.LCNOnline={get,track:(marker,ids)=>{const record={marker,original:marker.options.icon,painted:false,ids:[...new Set((Array.isArray(ids)?ids:[ids]).map(Number).filter(Boolean))]};markers.add(record);marker.on('remove',()=>markers.delete(record));paint(record);return marker;},update:(id,access)=>{doctors[id]=access;markers.forEach(paint);queue();},fromQuestions:(id,questions)=>{const access={...get(id)};for(const [kind,key] of [['first','appointment-0-2'],['follow','appointment-1-2']]){const options=questions?.[key]?.options||[],yes=Number(options[0]?.count||0),no=Number(options[1]?.count||0);if(yes+no>=10)access[kind]=yes>no;}access.complete=access.first&&access.follow;return access;}};
 const css=document.createElement('link');css.rel='stylesheet';css.href='styles/online_access.css?v=1';document.head.append(css);
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
 fetch('api/doctor_online.php?demo='+(new URLSearchParams(location.search).get('demo')==='1'?'1':'0')).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!data.ok)throw Error();doctors=data.doctors||{};markers.forEach(paint);queue();window.dispatchEvent(new Event('lcn-online-ready'));}).catch(()=>{});
})();
