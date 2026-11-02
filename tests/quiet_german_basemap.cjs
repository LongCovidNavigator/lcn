const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const style=require('../assets/lcn-basemap-de.json');
assert(!style.layers.some(l=>l.id.includes('shield')));
for(const l of style.layers.filter(l=>l.type==='symbol'&&l.layout?.['text-field'])){
 assert.equal(l.layout['text-field'][0],'coalesce');
 assert.deepEqual(l.layout['text-field'][1],['get','name:de']);
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['behandler_suche.html','therapien_suche.html','top_behandler.html','therapie_detail.php?treatment_id=1&demo=1']){
  await page.goto('http://localhost/lcn/'+route,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{let loaded=false;document.querySelectorAll('.leaflet-container').forEach(el=>{if(el.querySelector('.maplibregl-canvas'))loaded=true;});return loaded;});
  assert(await page.locator('.leaflet-control-attribution').first().innerText().then(t=>t.includes('OpenFreeMap')));
  assert.equal(await page.locator('img.leaflet-tile[src*="tile.openstreetmap.de"]').count(),0);
  console.log('PASS',route);
 }
 await page.goto('http://localhost/lcn/behandler_suche.html');
 await page.locator('.maplibregl-canvas').waitFor();await page.setViewportSize({width:390,height:844});
 await page.locator('[data-country-toggle]').click();await page.locator('[data-country=ch]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('lcn_map_viewport_preference')),'ch');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS German single labels, no shields, shared maps, mobile controls, no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
