// A single compact header for all four doctor views.
(() => {
  const host = document.getElementById('header-placeholder');
  const profile = document.querySelector('.profile');
  if (!host || !profile) return;
  document.body.classList.add('compact-doctor-header');
  host.append(profile);
  const brand = document.createElement('a');
  brand.className = 'detail-brand';
  brand.href = 'index.html';
  brand.setAttribute('aria-label', 'LCN – zur Startseite');
  brand.innerHTML = '<img data-lcn-image="brand-logo" alt=""><span>LCN</span>';
  const brandGroup=document.createElement('div');
  brandGroup.className='detail-brand-group';
  const back=document.createElement('a');
  back.href='aerzte_karte.html';
  back.className='detail-back-link';
  back.setAttribute('aria-label','Zurück zur Ärzt:innen-Suche');
  back.title='Zurück zur Ärzt:innen-Suche';
  back.innerHTML='<span aria-hidden="true">←</span><span class="detail-back-label">Ärzt:innen-Suche</span>';
  brandGroup.append(brand,back);
  profile.prepend(brandGroup);
  window.LCNImages?.apply(brand);
  profile.querySelectorAll('[data-contact]').forEach(button => {
    const symbol = button.querySelector('span');
    const label = document.createElement('span');
    label.className = 'contact-label';
    label.textContent = button.dataset.contact;
    button.replaceChildren(symbol, label);
    button.setAttribute('aria-label', button.dataset.contact);
    button.title = button.dataset.contact;
  });
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'detail-menu-toggle';
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-controls','detail-main-menu');
  toggle.setAttribute('aria-label','Hauptnavigation öffnen');
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  profile.append(toggle);
  const menu = document.createElement('nav');
  menu.id = 'detail-main-menu';
  menu.className = 'detail-main-menu';
  menu.setAttribute('aria-label','Hauptnavigation');
  menu.hidden = true;
  menu.innerHTML = '<ul><li><a href="index.html">Startseite</a></li><li><a href="aerzte_karte.html">Ärzt:innen suchen</a></li></ul>';
  host.append(menu);
  function close(restoreFocus=false) {
    menu.hidden=true; toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','Hauptnavigation öffnen');
    if(restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click',()=>{
    menu.hidden=!menu.hidden;
    toggle.setAttribute('aria-expanded',String(!menu.hidden));
    toggle.setAttribute('aria-label',menu.hidden?'Hauptnavigation öffnen':'Hauptnavigation schließen');
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden)close(true);});
  document.addEventListener('click',event=>{if(!host.contains(event.target))close();});
  menu.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  host.addEventListener('focusout',event=>{if(event.relatedTarget&&!host.contains(event.relatedTarget))close();});
  new ResizeObserver(()=>{
    document.documentElement.style.setProperty('--detail-header-height',host.getBoundingClientRect().height+'px');
  }).observe(host);
  fetch('components/header.html?v=4').then(r=>{if(!r.ok)throw Error();return r.text();}).then(html=>{
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const list=parsed.querySelector('.main-nav > ul');
    if(list){list.querySelectorAll('[class]').forEach(el=>el.removeAttribute('class'));menu.replaceChildren(list);}
  }).catch(()=>{});
  fetch('components/footer.html').then(r=>r.ok?r.text():'').then(html=>{
    document.getElementById('footer-placeholder').innerHTML=html;
    window.LCNImages?.apply(document.getElementById('footer-placeholder'));
  }).catch(()=>{});
})();
