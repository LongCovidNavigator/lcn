/* Size shared rows from all cards, including alternatives outside the scroll viewport. */
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.ux-alternative-strip').forEach(strip=>{
  const options=strip.querySelector('.ux-alternative-options');
  if(options){
   const label=document.createElement('label');label.className='ux-alternative-sort';
   label.append(document.createTextNode('Sortieren: '));
   const select=document.createElement('select');
   for(const [value,text] of [['original','Standard'],['confirm','Meiste Zustimmung (✓)'],['oppose','Meiste Widersprüche (×)']]){
    const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
   }
   label.append(select);strip.before(label);
   let feedback={};const order=new WeakMap();let next=0;
   function sort(){
    const tiles=[...options.querySelectorAll(':scope > .ux-feedback-relation')];
    tiles.forEach(tile=>{if(!order.has(tile))order.set(tile,next++);});
    const score=tile=>Number(feedback[tile.querySelector('[data-treatment-relation-feedback]')?.dataset.treatmentRelationFeedback]?.[select.value]||0);
    const sorted=[...tiles].sort((a,b)=>(select.value==='original'?0:score(b)-score(a))||order.get(a)-order.get(b));
    if(sorted.every((tile,i)=>tile===tiles[i]))return;
    const anchor=tiles.at(-1)?.nextSibling||null;
    sorted.forEach(tile=>options.insertBefore(tile,anchor));
   }
   select.addEventListener('change',()=>{sort();options.scrollLeft=0;});
   window.addEventListener('lcn-relation-feedback',event=>{feedback=event.detail||{};sort();});
   new MutationObserver(sort).observe(options,{childList:true});sort();
  }
  const rows={role:'small:first-child',name:'.ux-alternative-name,.ux-alternative-current>strong',category:'.ux-alternative-category',subcategory:'.ux-alternative-subcategory'};
  let scheduled=false,lastWidth=-1;
  function align(){
   scheduled=false;if(!strip.getBoundingClientRect().width)return;
   for(const row of Object.keys(rows))strip.style.removeProperty('--alternative-'+row+'-height');
   for(const tile of strip.querySelectorAll('.ux-alternative-tile:not(.ux-alternative-add)')){
    tile.style.removeProperty('--alternative-label-width');
    const labels=[...tile.querySelectorAll('.ux-alternative-category,.ux-alternative-subcategory')];
    const width=Math.max(0,...labels.map(label=>label.getBoundingClientRect().width));
    if(width)tile.style.setProperty('--alternative-label-width',Math.ceil(width)+'px');
   }
   const heights={};
   for(const [row,selector] of Object.entries(rows)){
    heights[row]=Math.max(0,...[...strip.querySelectorAll('.ux-alternative-tile:not(.ux-alternative-add)')].flatMap(tile=>[...tile.querySelectorAll(selector)].map(node=>node.getBoundingClientRect().height)));
   }
   for(const [row,height] of Object.entries(heights))strip.style.setProperty('--alternative-'+row+'-height',Math.ceil(height)+'px');
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(align);}}
  new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule();}}).observe(strip);
  new MutationObserver(schedule).observe(strip,{childList:true,subtree:true,characterData:true});
  document.fonts.ready.then(schedule);schedule();
 });
});
