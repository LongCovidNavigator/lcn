const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="host"><form><div class="top-map-location-input-row"><input id="place"><button type="button" data-map-clear>×</button><div class="top-map-location-suggestions is-hidden"></div></div></form><p data-map-status></p></div>');
  const source=fs.readFileSync('scripts/treatments_nd_map.js','utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf("    const input=host.querySelector('input'),suggestions=");
  const end=source.indexOf('\n  });\n  function clearOrigin()',start);
  assert(start>0&&end>start);
  await page.addScriptTag({content:`(()=>{
   const host=document.getElementById('host'),entry={};
   const valid=p=>p.lat!=null&&p.lng!=null;
   const setOrigin=(p,label)=>window.selectedPlace=label;
   const clearOrigin=()=>{};
   window.requests=0;
   window.fetch=async url=>{window.requests++;const query=new URL(url,'http://localhost').searchParams.get('q');await new Promise(resolve=>setTimeout(resolve,250));return {ok:true,json:async()=>({ok:true,results:[{lat:51,lng:7,formatted:query+' Ort'}]})};};
   ${source.slice(start,end)}
  })();`});
  const input=page.locator('#place');
  await input.fill('Marl');
  assert.equal(await input.getAttribute('aria-expanded'),'true');
  assert.match(await page.locator('.location-suggestion-status').innerText(),/gesucht/);
  await page.waitForSelector('[role=option]');
  await input.press('ArrowDown');await input.press('Enter');
  assert.equal(await page.evaluate(()=>selectedPlace),'Marl Ort');
  await input.fill('Marl');
  assert.equal(await page.evaluate(()=>requests),1,'Repeated query uses cache');
  await input.fill('Berlin');await page.waitForTimeout(180);await input.fill('Bonn');
  await page.waitForFunction(()=>document.querySelector('[role=option]')?.textContent==='Bonn Ort');
  await input.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'),'false');
  console.log('PASS: immediate search feedback, keyboard selection, cached results, stale responses ignored, Escape closes suggestions.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
