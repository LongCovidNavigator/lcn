(()=>{
 if(window.lcnFloatingFeedback)return;window.lcnFloatingFeedback=true;
 const css=document.createElement('link');css.rel='stylesheet';css.href='styles/feedback_floating.css?v=responsive-footer-20261107';document.head.append(css);
 const button=document.createElement('button');button.type='button';button.className='lcn-feedback-float';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','fb-idea-dialog');button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span>Feedback</span>';document.body.append(button);
 function positionAboveFooter(){
  const footer=document.querySelector('.lcn-site-footer');
  const bounds=footer?.getBoundingClientRect();
  const clearance=bounds?.height ? Math.max(0, innerHeight - bounds.top + 12) : 0;
  button.style.setProperty('--lcn-footer-clearance', `${clearance}px`);
 }
 window.addEventListener('scroll', positionAboveFooter, {passive:true});
 window.addEventListener('resize', positionAboveFooter);
 const footerLayout=new ResizeObserver(positionAboveFooter);
 footerLayout.observe(document.body);
 const footerPlaceholder=document.getElementById('footer-placeholder');
 if(footerPlaceholder)footerLayout.observe(footerPlaceholder);

 let lastArea=null;
 const areaFor=node=>node?.closest?.('main .card,main article,main section,.nd-panel .card,.nd-panel section');
 document.addEventListener('pointerdown',e=>{if(e.target.closest('.lcn-feedback-float,#fb-idea-dialog'))return;lastArea=areaFor(e.target);},true);
 document.addEventListener('focusin',e=>{if(!e.target.closest('#fb-idea-dialog,.lcn-feedback-float'))lastArea=areaFor(e.target)||lastArea;});
 const text=node=>node?.textContent?.replace(/\s+/g,' ').trim().slice(0,180)||'';
 function capture(){
  const query=new URLSearchParams(location.search),file=location.pathname.split('/').pop();let type,id;
  if(file==='arzt_detail.html'){type='doctor';id=query.get('id');}else if(file==='therapie_detail.php'||file==='therapie_detail.html'){type='treatment';id=query.get('treatment_id')||query.get('nd_id')||query.get('treat_id');}
  const active=document.querySelector('[data-view][aria-current="page"],[data-view].is-active,[data-view].active');
  const rawTab=active?.dataset.view||location.hash.slice(1),tab=/^[a-z][a-z0-9_-]{0,63}$/i.test(rawTab)?rawTab:'',label=text(active?.querySelector('strong')||active)||tab;
  let area=lastArea;const visible=n=>{if(!n?.isConnected)return false;const r=n.getBoundingClientRect();return r.height>0&&r.bottom>100&&r.top<innerHeight&&!n.closest('[hidden]');};
  if(!visible(area)){area=[...document.querySelectorAll('main .card,main article,main section,.nd-panel:not([hidden]) section')].filter(visible).sort((a,b)=>Math.abs(a.getBoundingClientRect().top-innerHeight*.35)-Math.abs(b.getBoundingClientRect().top-innerHeight*.35))[0];}
  const heading=text(area?.querySelector('h2,h3,h4'));const name=text(document.querySelector('.profile h1'))||text(document.querySelector('h1'))||document.title;
  // Only allowlisted identifiers and the active section enter the reference URL.
  const safe=new URLSearchParams();if(type&&/^\d+$/.test(id||''))safe.set(type==='doctor'?'id':file.endsWith('.php')?'treatment_id':query.has('nd_id')?'nd_id':'treat_id',id);
  const path=file+(safe.size?'?'+safe:'')+(tab?'#'+encodeURIComponent(tab):'');
  return {entity_type:type,entity_id:id,name,tab:label,heading,element:area?.id||'',page_path:path.slice(0,500)};
 }
 function sync(){const hidden=!!document.querySelector('dialog[open],[aria-modal="true"]:not([hidden])');if(button.hidden!==hidden)button.hidden=hidden;}
 new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','aria-modal']});document.addEventListener('focusin',sync);document.addEventListener('focusout',()=>setTimeout(sync,0));
 document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(!link)return;try{const target=new URL(link.href,location.href);if(target.origin===location.origin&&target.pathname.endsWith('/mitgestalten.html')&&!location.pathname.endsWith('/mitgestalten.html'))sessionStorage.setItem('lcn-feedback-source',JSON.stringify({...capture(),time:Date.now()}));}catch{}});
 async function open(mode){try{const {openComposer}=await import('./feedback_composer.js?v=responsive-20261107');await openComposer(mode,capture());}catch(error){console.error(error);button.title=error.message;}}
 button.onclick=()=>open(location.pathname.endsWith('/mitgestalten.html')?'#idee':'#privat');
 document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const target=new URL(link.href,location.href);if(target.origin!==location.origin||!['#idee','#privat'].includes(target.hash))return;if(target.pathname!==location.pathname&&!target.pathname.endsWith('/mitgestalten.html'))return;e.preventDefault();open(target.hash);});
})();
