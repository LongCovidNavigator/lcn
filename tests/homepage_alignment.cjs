const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();
  await page.goto('http://localhost/lcn/index.html');
  await page.waitForSelector('.home-ranking-doctor .home-top-card');
  for(const width of [1440,1280,1000,760,390]) {
   await page.setViewportSize({width,height:1000});
   const boxes=await page.locator('.home-page > :is(.quick-start,#empfehlung,#hausarzt,#suche,#ergaenzung,#projekt)').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {id:node.id||node.className,left:r.left,right:r.right};}));
   for(const box of boxes) {
    assert.ok(Math.abs(box.left-boxes[0].left)<1,`${width}: left edge ${box.id}`);
    assert.ok(Math.abs(box.right-boxes[0].right)<1,`${width}: right edge ${box.id}`);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}: horizontal overflow`);
   for(const id of ['hausarzt','ergaenzung','empfehlung']) {
    await page.locator(`.home-section-nav a[href="#${id}"]`).click();
    await page.waitForFunction(id=>document.querySelector('.home-section-nav [aria-current="location"]')?.hash==='#'+id,id,{timeout:3000}).catch(async error=>{console.error({width,id,state:await page.evaluate(()=>({active:document.querySelector('.home-section-nav [aria-current]')?.hash,positions:[...document.querySelectorAll('.home-page>section[id]')].map(x=>[x.id,x.getBoundingClientRect().top])}))});throw error;});
   }
  }
  assert.equal(await page.locator('.home-contribution-actions a[href="behandlung_vorschlagen.html"]').count(),1);
  assert.equal(await page.locator('.home-contribution-actions a[href="arzt_vorschlagen.html"]').count(),1);
  console.log('PASS: matching content edges at five widths, no overflow, chapter jumps and active navigation, contribution links');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
