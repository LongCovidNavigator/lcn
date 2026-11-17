const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 for(const width of [1440,1920,390]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 const css=['arzt_detail_konzept','treatments_nd','treatments_nd_chrome','detail_layout_shared','detail_responsive','therapy_scroll'].map(n=>fs.readFileSync(`styles/${n}.css`,'utf8')).join('\n');
 await page.setContent(`<style>${css}\nbody{margin:0;--detail-header-height:96px}#header-placeholder{position:sticky;top:0;height:96px;background:white;z-index:50}#footer-placeholder{height:100px}.test-content{height:2200px}</style><body class="nd-detail ux-page compact-doctor-header"><div id="header-placeholder">Header</div><main class="nd-shell"><div class="detail-layout ux-detail"><nav class="side-nav"><div class="nav-items">${Array.from({length:7},(_,i)=>`<a href="#"><span>${i+1}</span><strong>Kapitel ${i+1}</strong></a>`).join('')}</div></nav><div id="view-content"><div class="test-content">Inhalt</div></div></div></main><div id="footer-placeholder">Impressum</div></body>`);
 await page.addScriptTag({content:fs.readFileSync('scripts/therapy_scroll.js','utf8')});
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await page.waitForTimeout(100);
 const state=await page.evaluate(()=>{const n=document.querySelector('.nav-items'),h=document.querySelector('#header-placeholder');n.scrollTop=9999;n.scrollTop=0;return {scroll:scrollY,navTop:n.getBoundingClientRect().top,headerBottom:h.getBoundingClientRect().bottom,firstTop:n.firstElementChild.getBoundingClientRect().top,footer:document.querySelector('#footer-placeholder').getBoundingClientRect().bottom,overflow:getComputedStyle(document.querySelector('#view-content')).overflowY}});
 assert(state.scroll>0);assert(state.navTop>=state.headerBottom);assert.equal(state.overflow,'visible');assert(state.footer<=901);if(width>1100)assert.equal(state.firstTop,state.navTop);
 console.log('PASS',width,state);await page.close();
 }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

