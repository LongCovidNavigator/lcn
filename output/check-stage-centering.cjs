const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1920,768,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   await page.addInitScript(()=>{for(const id of [68,869,397,64,65,717,346,169,3,2,451,374])sessionStorage.setItem('lcn_therapy_guide:'+id,JSON.stringify({mode:'explore',minimized:true}));});
   await page.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
   for(const id of [68,869,397,64,65,717,346,169,3,2,451,374]){
    await page.goto(`http://localhost/lcn/therapie_detail.php?treatment_id=${id}#alternativen`,{waitUntil:'domcontentloaded'});
    const section=page.locator('[data-relationship-stages]');await section.waitFor();
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
    for(const scroll of [0,180]){
     await page.evaluate(y=>scrollBy(0,y),scroll);await page.waitForTimeout(100);
     const data=await section.evaluate(s=>{
      const center=n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;};
      const middle=[...s.querySelectorAll('.ux-stage-column-1 .ux-stage-node')];
      const blocks=[...s.querySelectorAll('.ux-stage-block')].filter(n=>n.getClientRects().length);
      const rows=blocks.flatMap(n=>[...n.querySelectorAll('.ux-stage-node:not([hidden]),.ux-stage-add')]);
      const current=middle.length===1&&middle[0].classList.contains('is-current');
      const ys=rows.map(center);
      const left=s.querySelector('.ux-stage-column-0 .ux-stage-stack');
      return {overflow:document.documentElement.scrollWidth>innerWidth,
       delta:current&&blocks.length>1&&ys.length?Math.abs(center(middle[0])-(Math.min(...ys)+Math.max(...ys))/2):0,
       leftDelta:current&&!left.querySelector('.ux-stage-node')&&left.querySelectorAll('.ux-stage-add').length===1?Math.abs(center(left.querySelector('.ux-stage-add'))-center(middle[0])):0};
     });
     assert(!data.overflow,`${id}/${width}: overflow`);
     assert(data.delta<1,`${id}/${width}: center ${data.delta}`);
     assert(data.leftDelta<1,`${id}/${width}: left ${data.leftDelta}`);
    }
    if([68,869,397].includes(id))await section.screenshot({path:`output/stage-centered-${id}-${width}.png`});
   }
   console.log('PASS',width,'12 pages, before/after scrolling');await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
