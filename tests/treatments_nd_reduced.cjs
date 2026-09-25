const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost/lcn/treatment_nd_test.php?id=2',{waitUntil:'domcontentloaded'});
 assert.match(await page.locator('h1').innerText(),/Naltrexon/);
 assert.equal(await page.locator('.side-nav [data-view]').count(),5);
 assert.equal(await page.locator('.nd-panel:visible').count(),1);
 assert.equal(await page.locator('[data-question=effect] [data-option]').count(),4);
 await page.locator('[data-view=termin]').click();
 await page.locator('[data-question=pem] [data-option="2"]').click();
 assert.equal(await page.locator('[data-question=pem] [data-option="2"]').getAttribute('aria-pressed'),'true');
 await page.locator('#nd-demo-header-toggle').click();
 assert.match(await page.locator('[data-question=pem] [data-community-note]').innerText(),/Dummy.*100 Angaben/);
 await page.locator('[data-view=zugang]').click();
 const cost=page.locator('[data-question=unit_cost]');
 await cost.locator('[data-unit]').fill('Packung');
 await cost.locator('[data-option="2"]').click();
 await cost.locator('[data-insurance=PKV]').click();
 assert.equal(await cost.locator('[data-option="2"]').getAttribute('aria-pressed'),'false');
 await cost.locator('[data-unit]').fill('Rezeptur');
 await cost.locator('[data-option="4"]').click();
 await cost.locator('[data-insurance=GKV]').click();
 assert.equal(await cost.locator('[data-unit]').inputValue(),'Packung');
 assert.equal(await cost.locator('[data-option="2"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-view=wirkung]').click();
 await page.locator('[data-question=effect] [data-option="2"]').click();
 await page.locator('[data-segment="1"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('[data-question=gamechanger] [data-option="1"]').getAttribute('aria-pressed'),'true');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('[data-question=gamechanger] [data-option="1"]').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'C:/xampp/htdocs/lcn/tests/nd-reduced-desktop.png',fullPage:true});
 await page.locator('[data-view=alternativen]').click();
 assert.equal(await page.locator('.ux-alias-discovery .ux-peer-grid>a').count(),3);
 const aliases=await page.locator('.ux-alias-discovery .ux-peer-grid>a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).sort());
 assert.deepEqual(aliases,['therapie_detail.html?treat_id=64','therapie_detail.html?treat_id=65','therapie_detail.html?treat_id=94']);
 assert.equal(await page.locator('.nd-panel:visible').count(),1);
 await page.goBack({waitUntil:'domcontentloaded'});
 for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   for(const view of ['ueberblick','termin','zugang','wirkung','alternativen']){
    await page.locator('[data-view='+view+']').click();
    assert.equal(await page.locator('.nd-panel:visible').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width+' '+view);
   }
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view=zugang]').click();
 await page.screenshot({path:'C:/xampp/htdocs/lcn/tests/nd-reduced-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: five views, selections, persistence, cost contexts, donut keyboard, desktop/mobile overflow; no JS errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});


