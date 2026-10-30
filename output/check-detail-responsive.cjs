const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage();
  for (const width of [390,768,1024,1440]) {
   await page.setViewportSize({width,height:950});
   for (const [name,url] of [['doctor','arzt_detail.html?id=613&demo=1'],['therapy','therapie_detail.php?treatment_id=869&demo=1']]) {
    await page.goto('http://localhost/lcn/'+url);
    await page.waitForTimeout(1600);
    const views = await page.locator('.side-nav [data-view]').evaluateAll(es=>es.map(e=>e.dataset.view));
    for (const view of views) {
     await page.locator(`.side-nav [data-view="${view}"]`).click();
     await page.waitForTimeout(250);
     console.log(JSON.stringify({name,width,view,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,wide:[...document.querySelectorAll('#view-content *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&!e.closest('[hidden]')&&getComputedStyle(e).position!=='absolute';}).slice(0,8).map(e=>e.className)}))}));
     if(view==='ueberblick') {await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`output/responsive-${name}-${width}.png`,fullPage:true});}
    }
   }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
