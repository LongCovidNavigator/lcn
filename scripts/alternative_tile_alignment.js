/* Size shared rows from all cards, including alternatives outside the scroll viewport. */
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.ux-alternative-strip').forEach(strip=>{
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
