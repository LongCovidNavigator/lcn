(() => {
  document.querySelectorAll('[data-community-search]').forEach(input => {
    const actions=input.closest('.top-community-actions');
    const results=actions.querySelector('.community-search-results');
    const add=actions.querySelector('.community-search-add');
    const base=add.getAttribute('href');
    const invitation=add.previousElementSibling;
    const field=document.createElement('div');field.className='community-search-field';
    input.before(field);field.append(input,results);invitation.remove();add.remove();
    const inlineLabel = actions.querySelector('.community-inline-label');
    if (inlineLabel) {
      const row = document.createElement('div'); row.className = 'community-inline-search-row';
      inlineLabel.before(row); row.append(inlineLabel, field);
    }
    results.hidden=true;input.setAttribute('aria-expanded','false');
    function open(){results.hidden=false;input.setAttribute('aria-expanded','true');}
    function close(){results.hidden=true;input.setAttribute('aria-expanded','false');}
    input.addEventListener('focus',()=>{if(results.childNodes.length)open();});
    document.addEventListener('pointerdown',event=>{if(!field.contains(event.target))close();});
    field.addEventListener('focusout',event=>{if(!field.contains(event.relatedTarget))close();});
    field.addEventListener('keydown',event=>{
      const links=[...results.querySelectorAll('a')];
      if(event.key==='Escape'){close();input.focus();close();}
      if(event.key==='ArrowDown'&&links.length){event.preventDefault();open();const i=links.indexOf(document.activeElement);links[(i+1)%links.length].focus();}
      if(event.key==='ArrowUp'&&links.length){event.preventDefault();const i=links.indexOf(document.activeElement);if(i<=0)input.focus();else links[i-1].focus();}
    });
    function rankFor(item){
      const section=input.closest('section');
      const list=document.querySelector(input.dataset.communitySearch==='doctor'?'#featured-experts-list':'#featured-treatments-list');
      for(const link of list?.querySelectorAll('a[href]')||[]){
        const url=new URL(link.href),target=new URL(item.detail_url,location.href);
        const id=u=>u.searchParams.get('id')||u.searchParams.get('treat_id')||u.searchParams.get('treatment_id')||u.searchParams.get('submission_id');
        const normalize=value=>value.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
        if(id(url)!==id(target)&&(!item.label||normalize(link.textContent)!==normalize(item.label)))continue;
        const row=link.closest('tr,.featured-expert,.featured-treatment');
        const rank=row?.querySelector('.featured-expert-rank,.featured-treatment-rank,.featured-expert-table-rank,.featured-treatment-table-rank,.home-ranking-number')||row?.querySelector('td:first-child');
        if(rank&&/^\d+$/.test(rank.textContent.trim()))return Number(rank.textContent.trim());
      }
      return null;
    }
    let timer,controller,revision=0;
    const rankingList=document.querySelector(input.dataset.communitySearch==='doctor'?'#featured-experts-list':'#featured-treatments-list');
    if(rankingList)new MutationObserver(()=>{
      for(const name of results.querySelectorAll('strong[data-detail-url]')){
        const rank=rankFor({detail_url:name.dataset.detailUrl,label:name.dataset.label});
        name.textContent=(rank?'Nr. '+rank+' · ':'')+name.dataset.label;
      }
    }).observe(rankingList,{childList:true,subtree:true});
    input.addEventListener('input',()=>{
      clearTimeout(timer);controller?.abort();const current=++revision;
      const query=input.value.trim();results.replaceChildren();
      add.href=base+(query?'?name='+encodeURIComponent(query):'');
      if(query.length<2){close();return;}
      open();
      results.textContent='Einträge werden gesucht …';
      timer=setTimeout(async()=>{
        controller=new AbortController();
        try {
          const response=await fetch('api/submission_duplicate_search.php?catalog=current&type='+input.dataset.communitySearch+'&q='+encodeURIComponent(query),{signal:controller.signal,cache:'no-store'});
          const data=await response.json();if(current!==revision)return;
          if(!response.ok||!data.ok||!Array.isArray(data.items))throw Error();
          results.replaceChildren();
          if(!data.items.length){
            const message=document.createElement('div');message.textContent='Kein passender Eintrag gefunden. Möchtest du '+(input.dataset.communitySearch==='doctor'?'diese Person oder Praxis':'diese Therapie')+' ergänzen?';
            results.append(message,add);return;
          }
          const heading=document.createElement('small');heading.textContent='Passenden Eintrag öffnen und Erfahrung teilen:';results.append(heading);
          const list=document.createElement('ul');
          for(const item of data.items){
            const url=new URL(item.detail_url,location.href);
            if(url.origin!==location.origin||!['arzt_detail.html','therapie_detail.html','therapie_detail.php'].includes(url.pathname.split('/').pop()))continue;
            const row=document.createElement('li'),link=document.createElement('a'),name=document.createElement('strong');
            link.href=url.href;name.dataset.detailUrl=item.detail_url;name.dataset.label=item.label;const rank=rankFor(item);name.textContent=(rank?'Nr. '+rank+' · ':'')+item.label;link.append(name);
            if(item.meta){const meta=document.createElement('small');meta.textContent=item.meta;link.append(meta);}
            row.append(link);list.append(row);
          }
          results.append(list);
        } catch(error){if(error.name!=='AbortError'&&current===revision)results.textContent='Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut.';}
      },300);
    });
  });
})();
