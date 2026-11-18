const {chromium,expect}=require('playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   const requests=[];
   await page.route('**/api/catalog_relation_feedback.php',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{ok:true,feedback:{}}});
    const {key,stance}=route.request().postDataJSON();
    const fail=await new Promise(resolve=>{requests.push({stance,release:resolve});});
    await route.fulfill(fail?{status:500,json:{ok:false}}:{json:{ok:true,feedback:{[key]:{confirm:stance===1?1:0,oppose:stance===-1?1:0,own:stance}}}});
   });
   await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=65#alternativen');
   const box=page.locator('[data-relationship-stages] [data-relation-feedback]').first();
   await box.waitFor();
   await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
   const yes=box.locator('[data-stance="1"]'),no=box.locator('[data-stance="-1"]');
   await yes.click();
   assert.equal(await yes.textContent(),'✓ 1');
   assert.equal(await yes.getAttribute('aria-pressed'),'true');
   assert.equal(await yes.isDisabled(),false);
   await expect.poll(()=>requests.length).toBe(1);
   // Withdraw while the first save is still waiting on the server.
   await yes.click();
   assert.equal(await yes.textContent(),'✓ 0');
   assert.equal(await yes.getAttribute('aria-pressed'),'false');
   assert.equal(requests.length,1);
   requests[0].release(false);
   await expect.poll(()=>requests.length).toBe(2);
   assert.equal(requests[1].stance,0);
   assert.equal(await yes.textContent(),'✓ 0');
   requests[1].release(false);
   await page.waitForResponse(r=>r.url().includes('catalog_relation_feedback.php')&&r.request().method()==='POST');
   await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
   await no.click();
   assert.equal(await yes.textContent(),'✓ 0');
   assert.equal(await no.textContent(),'× 1');
   await expect.poll(()=>requests.length).toBe(3);
   requests[2].release(true);
   await expect(no).toHaveText('× 0');
   assert.equal(await yes.textContent(),'✓ 0');
   console.log('PASS',width,'immediate withdrawal during pending save, ordered persistence, rollback on failure');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
