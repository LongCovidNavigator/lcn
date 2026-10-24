const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();
  // Search and controls must work even if every external host is unavailable.
  const remoteScripts=[];
  await context.route(/^https?:\/\//,route=>{const u=new URL(route.request().url());if(u.hostname==='localhost')return route.continue();if(route.request().resourceType()==='script')remoteScripts.push(u.href);return route.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const q of ['Cetirizin','Mestinon','H1-Antihistaminika','LDN','no-such-therapy-749201']){
   const r=await context.request.get('http://localhost/lcn/api/treatments_search.php?alias_suggest=smart&q='+encodeURIComponent(q));
   assert.equal(r.status(),200);const data=await r.json();assert.equal(data.ok,true);assert.ok(Array.isArray(data.suggestions));
   if(q!=='no-such-therapy-749201')assert.ok(data.suggestions.length>0,q);
  }
  for(const [q,expected] of [['Cetirizn','Cetirizin'],['Ivabardin','Ivabradin'],['Mestinno','Mestinon']]) {
   const d=await (await context.request.get('http://localhost/lcn/api/treatments_search.php?alias_suggest=smart&q='+q)).json();
   assert.ok(d.suggestions.some(x=>x.label===expected&&x.fuzzy_match),q);
  }
  const fuzzyAlias=await (await context.request.get('http://localhost/lcn/api/treatments_search.php?alias_suggest=smart&q=H1-Antihistaminka')).json();
  assert.ok(fuzzyAlias.suggestions.some(x=>x.group_key==='extended'&&x.label.includes('Cetirizin')));
  await page.goto('http://localhost/lcn/therapien_karte.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof currentTreatments!=='undefined'&&currentTreatments.length>10);
  const input=page.locator('#treatment-alias-smart-input');
  await input.fill('Ivabradin');await input.press('Enter');
  await page.waitForFunction(()=>currentTreatments.length===1&&currentTreatments[0].behandlung==='Ivabradin');
  assert.ok(await page.getByRole('link',{name:'Ivabradin',exact:true}).count()>0);
  await input.fill('Ivabardin');await input.press('Enter');await page.waitForFunction(()=>currentTreatments.length===1&&currentTreatments[0].behandlung==='Ivabradin');
  await input.fill('');await page.waitForFunction(()=>currentTreatments.length>10);
  await input.fill('H1-Antihistaminika');
  await page.locator('.treatment-alias-smart-group[data-group-key="extended"] .treatment-alias-smart-item:not(.treatment-alias-smart-item-empty)').first().waitFor();
  await page.locator('.treatment-alias-smart-group-button[data-group-key="extended"]').click();
  await page.waitForFunction(()=>currentTreatments.some(n=>n.behandlung==='Cetirizin')&&currentTreatments.some(n=>n.behandlung==='Loratadin'));
  await input.fill('no-such-therapy-749201');await input.press('Enter');await page.waitForFunction(()=>currentTreatments.length===0);
  await input.fill('');await page.waitForFunction(()=>currentTreatments.length>10);
  await page.setViewportSize({width:390,height:844});await input.fill('Cetirizin');await input.press('Enter');await page.waitForFunction(()=>currentTreatments.some(n=>n.behandlung==='Cetirizin')&&currentTreatments.length<5);
  await page.goto('http://localhost/lcn/aerzte_karte.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof currentDoctors!=='undefined'&&currentDoctors.length>1);
  const doctor=page.locator('#doctor-search-input');await doctor.fill('Kacik');
  await page.waitForFunction(()=>currentDoctors.length===1&&currentDoctors[0].dr_display_name.includes('Kacik'));
  assert.ok(await page.getByRole('link',{name:/Michael Kacik/}).count()>0);
  await doctor.fill('Kacikk');await page.waitForFunction(()=>currentDoctors.length===1&&currentDoctors[0].dr_display_name.includes('Kacik'));
  await doctor.fill('Kacki');await page.waitForFunction(()=>currentDoctors.length===1&&currentDoctors[0].dr_display_name.includes('Kacik'));
  await doctor.fill('no-such-doctor-749201');await page.waitForFunction(()=>currentDoctors.length===0);
  await doctor.fill('');await page.waitForFunction(()=>currentDoctors.length>1);
  assert.deepEqual(remoteScripts,[],'Search still depends on external scripts.');assert.deepEqual(errors,[]);
  console.log('PASS: therapy smart API, name/alias/group search, Enter, no matches, clear/reset, mobile input; doctor search/no matches/reset; both pages with all external hosts blocked and no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
