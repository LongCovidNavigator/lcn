/* Add the search page's foldable table header to independently rendered lists. */
(() => {
 let number=0;
 const mount=()=>document.querySelectorAll('.gp-directory-scroll,.featured-experts-table-wrap,.featured-treatments-table-wrap').forEach(content=>{
  if(content.dataset.searchFrameMounted)return;
  content.dataset.searchFrameMounted='true';
  const frame=document.createElement('div');frame.className='lcn-recommendation-table-frame';
  content.before(frame);
  const button=document.createElement('button');button.type='button';button.className='lcn-search-table-toggle';
  button.setAttribute('aria-expanded','true');
  if(!content.id)content.id='recommendation-table-content-'+(++number);
  button.setAttribute('aria-controls',content.id);
  button.innerHTML='<span>▤ &nbsp; Tabelle</span><span class="lcn-search-table-chevron" aria-hidden="true">⌃</span>';
  content.classList.add('lcn-recommendation-table-content');
  frame.append(button,content);
  button.addEventListener('click',()=>{content.hidden=!content.hidden;button.setAttribute('aria-expanded',String(!content.hidden));button.lastElementChild.textContent=content.hidden?'⌄':'⌃';});
 });
 document.addEventListener('DOMContentLoaded',()=>{mount();new MutationObserver(mount).observe(document.querySelector('main'),{childList:true,subtree:true});});
})();
