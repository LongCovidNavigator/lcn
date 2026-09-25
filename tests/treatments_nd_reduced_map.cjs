const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});
 await p.addInitScript(()=>localStorage.setItem('lcn_shared_location_preference',JSON.stringify({lat:50.9375,lng:6.9603,label:'Köln'})));
 await p.goto('http://localhost/lcn/treatment_nd_test.php?id=2#termin',{waitUntil:'domcontentloaded'});
 await p.locator('.leaflet-container').waitFor();
 assert.match(await p.locator('.ux-nearest').innerText(),/km Luftlinie/);
 const cards=await p.locator('.nd-map-results .doctor-card').count();assert.ok(cards>0);
 await p.locator('[data-provider-search]').fill('kein-treffer-xyz');
 await p.getByRole('button',{name:'Alle Anbieter anzeigen',exact:true}).click();
 assert.equal(await p.locator('.nd-map-results .doctor-card').count(),cards);
 await p.locator('.nd-show-provider:not([disabled])').first().click();
 await p.locator('.leaflet-popup').waitFor();
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'C:/xampp/htdocs/lcn/tests/nd-reduced-map.png',fullPage:true});
 console.log('PASS: Leaflet markers, nearest distance, provider filtering/reset and marker popup');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
