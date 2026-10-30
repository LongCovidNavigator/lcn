const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:950});
  for(const [name,url] of [['doctor','arzt_detail.html?id=613&demo=1'],['therapy','therapie_detail.php?treatment_id=869&demo=1']]){
   await page.goto('http://localhost/lcn/'+url+'#dashboard');
   await page.locator('#view-content [data-dashboard-question]').first().waitFor({timeout:60000});
   await page.waitForTimeout(500);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:`output/refresh-${name}-${width}.png`,fullPage:true});
   await page.locator('#view-content .dashboard-score-group').first().screenshot({path:`output/refresh-burden-${name}-${width}.png`});
   console.log(JSON.stringify({name,width,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,narrow:[...document.querySelectorAll('.therapy-distribution-row,.doctor-distribution-table,.ux-dashboard-gamechanger,.doctor-dashboard-appointments')].filter(e=>e.getBoundingClientRect().width).map(e=>({class:e.className,width:Math.round(e.getBoundingClientRect().width),scroll:e.scrollWidth}))}))}));
   await page.locator('#view-content details>summary').evaluateAll(es=>es.forEach(e=>e.parentElement.open=true));
   console.log(JSON.stringify({name,width,expanded:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)}));
  }
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
