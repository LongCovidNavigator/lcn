/* One shared online-appointment indicator for all maps and provider lists. */
(()=>{
 if(window.LCNOnline)return;
 let doctors={},scheduled=false;const markers=new Set();
 const get=id=>doctors[Number(id)]||{first:false,follow:false,complete:false};
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="#248965" stroke="#176748" d="M12.5 40C10 34 1 23 1 13a11.5 11.5 0 0 1 23 0c0 10-9 21-11.5 27Z"/><circle cx="12.5" cy="13" r="5" fill="white"/></svg>';
 const green='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 function paint(record){if(!window.L)return;if(!record.ids.some(id=>get(id).complete)){if(record.painted)record.marker.setIcon(record.original);record.painted=false;return;}record.painted=true;const n=record.count||record.ids.length;record.marker.setIcon(n>1?L.divIcon({className:'lcn-online-marker',html:'<img src="'+green+'" alt=""><span>'+n+'</span>',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[0,-35]}):L.icon({iconUrl:green,iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[0,-35]}));}
 const quietTableHints='.nd-provider-table thead,.nd-provider-table .catalog-rating-number,.nd-provider-table .nd-show-provider,.nd-provider-table .catalog-report-column';
 function clearTableHint(node){if(node.dataset.feedbackAction)return;node.removeAttribute('title');delete node.dataset.lcnTooltip;}
 function decorate(){scheduled=false;
   document.querySelectorAll(quietTableHints).forEach(host=>{clearTableHint(host);host.querySelectorAll('[title],[data-lcn-tooltip]').forEach(clearTableHint);});
   document.querySelectorAll('.doctor-card a[href*="arzt_detail"],.nd-map-results a[href*="arzt_detail"],.doctor-table-name a[href*="arzt_detail"],.leaflet-popup-content a[href*="arzt_detail"],#featured-experts-list a[href*="arzt_detail"]').forEach(link=>{
     const id=new URL(link.href,location.href).searchParams.get('id'),access=get(id);const cardHeader=link.closest('.nd-provider-heading');let badge=cardHeader?.querySelector('.lcn-online-badge')||(link.nextElementSibling?.classList.contains('lcn-online-badge')?link.nextElementSibling:null);
     if(!access.complete){badge?.remove();return;}if(!badge){badge=document.createElement('span');badge.className='lcn-online-badge';if(cardHeader)cardHeader.append(badge);else link.after(badge);}const label='Online-Behandlung möglich';badge.dataset.lcnTooltip='Vorne stehen Behandler, bei denen Erst- und Folgetermin online möglich sind. Online-Behandlung bedeutet nicht automatisch, dass immer alle Behandlungen online durchgeführt werden können.';badge.tabIndex=0;if(badge.textContent!==label)badge.textContent=label;if(cardHeader)cardHeader.querySelector('.nd-provider-distance')?.remove();
   });
   document.querySelectorAll('#profile-map + .lcn-online-legend').forEach(legend=>legend.remove());
   document.querySelectorAll('.leaflet-container:not(#profile-map)').forEach(canvas=>{
     const provider=canvas.closest('.nd-provider-map');
     let legend=provider?.querySelector('.lcn-online-legend')||canvas.parentElement.querySelector(':scope > .lcn-online-legend');
     if(!legend){legend=document.createElement('div');legend.className='lcn-online-legend';if(provider?.querySelector('.nd-map-notes'))provider.querySelector('.nd-map-notes').prepend(legend);else canvas.after(legend);}
     const colors=new Set();
     canvas.querySelectorAll('.leaflet-marker-icon').forEach(icon=>{
       const img=icon.matches('img')?icon:icon.querySelector('img');const src=img?.getAttribute('src')||'';
       if(icon.classList.contains('lcn-online-marker')||src===green)colors.add('green');
       else if(src.includes('map_marker_red')||icon.classList.contains('nd-local-origin'))colors.add('red');
       else colors.add('blue');
     });
     const html=[['green','Video-/Telefontermine möglich'],['blue','Weitere Standorte'],['red','Dein Standort']].filter(([color])=>colors.has(color)).map(([color,label])=>'<span><i class="online-'+color+'"></i>'+label+'</span>').join('');
     if(legend.innerHTML!==html)legend.innerHTML=html;
     legend.hidden=!html;
   });
 }
 const queue=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(decorate);}};
 window.LCNOnline={get,track:(marker,ids,count)=>{const record={count,marker,original:marker.options.icon,painted:false,ids:[...new Set((Array.isArray(ids)?ids:[ids]).map(Number).filter(Boolean))]};markers.add(record);marker.on('remove',()=>markers.delete(record));paint(record);return marker;},update:(id,access)=>{doctors[id]=access;markers.forEach(paint);queue();},fromQuestions:(id,questions)=>{const access={...get(id)};for(const [kind,key] of [['first','appointment-0-2'],['follow','appointment-1-2']]){const options=questions?.[key]?.options||[],yes=Number(options[0]?.count||0),no=Number(options[1]?.count||0);if(yes+no>=10)access[kind]=yes>no;}access.complete=access.first&&access.follow;return access;}};
 // Use the same styled explanation for native title hints throughout these pages.
 const tooltip=document.createElement('div');tooltip.className='lcn-shared-tooltip';tooltip.id='lcn-shared-tooltip';tooltip.role='tooltip';tooltip.hidden=true;document.body.append(tooltip);
 let tooltipTarget=null,tooltipHideTimer;
 function scheduleTooltipHide(){clearTimeout(tooltipHideTimer);tooltipHideTimer=setTimeout(hideTooltip,250);}
 tooltip.addEventListener('mouseenter',()=>clearTimeout(tooltipHideTimer));
 tooltip.addEventListener('mouseleave',scheduleTooltipHide);
 function hideTooltip(){clearTimeout(tooltipHideTimer);tooltip.hidden=true;if(tooltipTarget){const ids=(tooltipTarget.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==tooltip.id);if(ids.length)tooltipTarget.setAttribute('aria-describedby',ids.join(' '));else tooltipTarget.removeAttribute('aria-describedby');}tooltipTarget=null;}
 function showTooltip(event){if(tooltip.contains(event.target)){clearTimeout(tooltipHideTimer);return;}const target=event.target.closest('[title],[data-lcn-tooltip]');if(!target||target.closest('.leaflet-container'))return;if(target.closest(quietTableHints)&&!target.dataset.feedbackAction){clearTableHint(target);hideTooltip();return;}const text=target.getAttribute('title')||target.dataset.lcnTooltip;if(!text)return;if(target.hasAttribute('title')){target.dataset.lcnTooltip=text;target.removeAttribute('title');}hideTooltip();tooltipTarget=target;tooltip.textContent=text;tooltip.classList.toggle('lcn-feedback-tooltip',!!target.dataset.feedbackAction);delete tooltip.dataset.tone;if(target.dataset.feedbackAction){tooltip.dataset.tone=target.dataset.feedbackTone;const action=document.createElement('strong'),subject=document.createElement('span');action.className='catalog-feedback-action';action.textContent=target.dataset.feedbackAction+':';subject.className='catalog-feedback-subject';subject.textContent=target.dataset.feedbackSubject;if(target.dataset.stance==='-1'){const text=target.dataset.feedbackSubject||'',index=text.indexOf('nicht');if(index>=0){const negation=document.createElement('u');negation.textContent='nicht';subject.replaceChildren(document.createTextNode(text.slice(0,index)),negation,document.createTextNode(text.slice(index+5)));}}tooltip.replaceChildren(action,subject);}tooltip.classList.toggle('is-interactive',!!target.lcnTooltipAction);tooltip.setAttribute('role',target.lcnTooltipAction?'dialog':'tooltip');if(target.lcnTooltipAction){const button=document.createElement('button');button.type='button';button.className='lcn-tooltip-action';button.textContent=target.lcnTooltipAction.label;button.addEventListener('click',()=>{const callback=target.lcnTooltipAction.onClick;hideTooltip();callback();});tooltip.append(button);}tooltip.hidden=false;const rect=target.getBoundingClientRect();tooltip.style.left=Math.max(12,Math.min(rect.left,innerWidth-tooltip.offsetWidth-12))+'px';tooltip.style.top=(rect.bottom+8+tooltip.offsetHeight<innerHeight?rect.bottom+8:Math.max(12,rect.top-tooltip.offsetHeight-8))+'px';target.setAttribute('aria-describedby',((target.getAttribute('aria-describedby')||'')+' '+tooltip.id).trim());}
 document.addEventListener('mouseover',showTooltip);document.addEventListener('focusin',showTooltip);
 document.addEventListener('mouseout',event=>{if(tooltipTarget&&!tooltipTarget.contains(event.relatedTarget)&&!tooltip.contains(event.relatedTarget)){if(tooltipTarget.lcnTooltipAction)scheduleTooltipHide();else hideTooltip();}});document.addEventListener('focusout',event=>{if(tooltipTarget?.lcnTooltipAction){if(!tooltip.contains(event.relatedTarget)&&!tooltipTarget.contains(event.relatedTarget))scheduleTooltipHide();}else hideTooltip();});document.addEventListener('click',hideTooltip);document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});window.addEventListener('scroll',hideTooltip,true);
 const css=document.createElement('link');css.rel='stylesheet';css.href='styles/online_access.css?v=shared-styled-tooltips-20261027';document.head.append(css);
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
 let onlineRequest=0,lastDemo=new URLSearchParams(location.search).get('demo')==='1';
 async function loadOnline(demo){const request=++onlineRequest;try{const response=await fetch('api/doctor_online.php?demo='+(demo?'1':'0'),{cache:'no-store'});const data=await response.json();if(request!==onlineRequest||!response.ok||!data.ok)return;doctors=data.doctors||{};markers.forEach(paint);queue();window.dispatchEvent(new Event('lcn-online-ready'));}catch{}}
 loadOnline(lastDemo);
 document.addEventListener('DOMContentLoaded',()=>{const toggle=document.getElementById('nd-demo-header-toggle');if(!toggle)return;new MutationObserver(()=>{const demo=toggle.getAttribute('aria-pressed')==='true';if(demo!==lastDemo){lastDemo=demo;loadOnline(demo);}}).observe(toggle,{attributes:true,attributeFilter:['aria-pressed']});});
})();
