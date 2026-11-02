const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const open=async file=>{await p.goto('http://localhost/lcn/'+file,{waitUntil:'domcontentloaded'});await p.locator('.doctor-map-viewport-tools select').first().waitFor({state:'attached'});await p.waitForTimeout(1500);};
 await open('behandler_suche.html');
 const select=()=>p.locator('.doctor-map-viewport-tools select').first();
 assert.equal(await select().inputValue(),'de');
 await select().selectOption('at');assert.equal(await p.evaluate(()=>localStorage.getItem('lcn_map_viewport_preference')),'at');
 await p.reload();await select().waitFor();await p.waitForTimeout(1500);assert.equal(await select().inputValue(),'at');assert(await p.evaluate(()=>map.getCenter().lat<50));
 await select().selectOption('ch');await open('therapien_suche.html');assert.equal(await select().inputValue(),'ch');
 await p.locator('.doctor-map-viewport-tools button').first().click();await p.reload();await select().waitFor();await p.waitForTimeout(1500);assert.equal(await p.locator('.doctor-map-viewport-tools button').first().getAttribute('aria-pressed'),'true');
 for(const route of ['hausarzt_suche.html','top_behandler.html','top_behandlungen.html','therapie_detail.php?treatment_id=1&demo=1']){
   await open(route);assert.equal(await p.locator('.doctor-map-viewport-tools button').first().getAttribute('aria-pressed'),'true');await select().selectOption('at',{force:true});assert.equal(await select().inputValue(),'at');await p.locator('.doctor-map-viewport-tools button').first().dispatchEvent('click');console.log('PASS',route);
 }
 await open('behandler_suche.html');await select().selectOption('de');await p.setViewportSize({width:390,height:844});await select().selectOption('ch');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('#doctor-map').screenshot({path:'output/map-country-mobile.png'});
 await p.setViewportSize({width:1440,height:1000});await select().selectOption('de');await p.locator('#doctor-map').screenshot({path:'output/map-country-desktop.png'});
 assert.deepEqual(errors,[]);console.log('PASS defaults, all countries, reload persistence, shared routes, all-results persistence, mobile, no JS errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});



