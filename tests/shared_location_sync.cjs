const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const ctx=await b.newContext();await ctx.route('**/api/geocode_location.php?**',route=>{const q=new URL(route.request().url()).searchParams.get('q');const berlin=q.includes('Berlin');const result={lat:berlin?52.52:49.9929,lng:berlin?13.405:8.2473,formatted:berlin?'Berlin':'Mainz',city:berlin?'Berlin':'Mainz'};return route.fulfill({json:{ok:true,result,results:[result]}})});
const specs=[['hausarzt_suche.html','#nearby-gps-location'],['behandler_suche.html','#doctor-location-input'],['therapien_suche.html','#treatment-location-input'],['therapie_detail.php?treatment_id=5','.nd-provider-map input[name=location]'],['arzt_detail.html?id=613#termin','#own-location'],['top_behandler.html','#top-map-location-input']];const tabs=[];for(const [url,selector] of specs){const p=await ctx.newPage();await p.goto('http://localhost/lcn/'+url,{waitUntil:'domcontentloaded'});await p.locator(selector).first().waitFor({state:'attached',timeout:20000});tabs.push({p,selector,url});console.log('OPEN '+url);}
const check=async label=>{for(const {p,selector,url}of tabs){await p.waitForFunction(({selector,label})=>document.querySelector(selector)?.value===label,{selector,label},{timeout:20000});console.log('PASS '+url+' = '+label);}};
await tabs[0].p.locator('#nearby-gps-location').fill('Mainz');await tabs[0].p.locator('#nearby-gps-form button[type=submit]').click();await check('Mainz');
await tabs[1].p.locator('#doctor-location-input').fill('Berlin');await tabs[1].p.locator('.doctor-nav-section-location .lcn-map-submit').click();await check('Berlin');
await tabs[1].p.reload();await tabs[1].p.waitForFunction(()=>document.querySelector('#doctor-location-input').value==='Berlin');console.log('PASS reload restores shared location');
await tabs[2].p.locator('#treatment-location-input').fill('Mainz');await tabs[2].p.locator('.treatment-nav-section-location .lcn-map-submit').click();await check('Mainz');
await tabs[4].p.locator('#own-location').fill('Berlin');await tabs[4].p.locator('#own-location').press('Enter');await check('Berlin');
await tabs[5].p.locator('#top-map-location-input').fill('Mainz');await tabs[5].p.locator('#top-map-location-input').press('Enter');await check('Mainz');
await tabs[3].p.evaluate(()=>{const input=document.querySelector('.nd-provider-map input[name=location]');input.value='Berlin';input.closest('form').requestSubmit();});await check('Berlin');

await tabs[2].p.locator('#treatment-location-clear-button').click();await check('');await tabs[1].p.reload();await tabs[1].p.waitForFunction(()=>document.querySelector('#doctor-location-input')?.value==='');assert.equal(await tabs[1].p.evaluate(()=>localStorage.getItem('lcn_shared_location_preference')),null);console.log('PASS clearing stays cleared after reload');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});




