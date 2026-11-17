const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage();
for(const width of [1920,390]){
 await p.setViewportSize({width,height:870});
 await p.goto('http://localhost/lcn/aerzte_karte.html?test=1#doctor-map');
 await p.waitForURL('**/behandler_suche.html?test=1#doctor-map');
 await p.waitForFunction(()=>typeof map!=='undefined'&&map);
 await p.waitForFunction(()=>currentDoctors.length>0);await p.waitForTimeout(700);
 assert.equal(await p.title(),'Long Covid Navigator - Behandler:innen-Suche');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.evaluate(()=>document.querySelector('#doctor-map').scrollIntoView({block:'center'}));
 await p.waitForTimeout(600);
 const box=await p.locator('#doctor-map').boundingBox();
 await p.evaluate(()=>map.setView([51,2],6,{animate:false}));
 await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await p.waitForTimeout(500);
 const before=await p.evaluate(()=>({y:scrollY,z:map.getZoom()}));
 await p.mouse.wheel(0,180);await p.waitForTimeout(350);
 const after=await p.evaluate(()=>({y:scrollY,z:map.getZoom()}));
 assert.equal(after.y,before.y,'first wheel after map click must not scroll the page');assert.ok(after.z<before.z,'wheel must zoom the active map');
 await p.mouse.move(5,5);await p.mouse.wheel(0,180);await p.waitForTimeout(350);
 assert.ok(await p.evaluate(()=>scrollY)>after.y,'leaving the map must resume page scrolling');
 await p.evaluate(()=>document.querySelector('#doctor-map').scrollIntoView({block:'center'}));
 await p.waitForTimeout(600);
 const next=await p.locator('#doctor-map').boundingBox();await p.mouse.move(next.x+next.width/2,next.y+next.height/2);
 const zoom=await p.evaluate(()=>map.getZoom());await p.keyboard.down('Control');await p.mouse.wheel(0,-180);await p.keyboard.up('Control');await p.waitForTimeout(500);
 assert.ok(await p.evaluate(()=>map.getZoom())>zoom,'Ctrl + wheel must zoom');
 console.log('PASS map scrolling and Ctrl zoom at '+width);
}
await p.goto('http://localhost/lcn/therapien_karte.html?test=1#search');await p.waitForURL('**/therapien_suche.html?test=1#search');assert.equal(await p.title(),'Long Covid Navigator - Therapien-Suche');console.log('PASS both redirects preserve query and hash; page titles correct');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});




