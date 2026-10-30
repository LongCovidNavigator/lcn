const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1536,390]){
   await page.setViewportSize({width,height:1000});
   for(const id of [169,25,271,515,63,869,65,205,397,67,609]){
    const response=await page.goto(`http://localhost/lcn/therapie_detail.php?treatment_id=${id}#alternativen`);
    assert.equal(response.status(),200);
    const section=page.locator('[data-relationship-stages]');await section.waitFor();
    await page.waitForTimeout(180);
    assert.equal(await section.locator('.is-current').count(),1,`current entry ${id}`);
    if(id===515)assert.equal(await section.locator('[data-stage="1"] .is-current').count(),1,'EMDR stays a therapy in the middle');
    if(id===63){
     const form=section.locator('.ux-stage-block[data-relationship-kind="has_form"]');
     const variant=section.locator('.ux-stage-block[data-relationship-kind="has_variant"]');
     assert.match(await form.innerText(),/Magnesium-Infusion/);
     assert.match(await variant.innerText(),/Magnesiumphosphat/);
     assert.doesNotMatch(await variant.innerText(),/Magnesium-Infusion/);
    }
    if(id===609)assert.match(await section.innerText(),/Verbindungsart noch nicht spezifiziert/);
    if(width===1536){
     const overlap=await section.evaluate(section=>{
      const blocks=[...section.querySelectorAll('[data-stage="2"] .ux-stage-block')].filter(b=>b.getClientRects().length);
      return blocks.slice(1).some((block,i)=>block.getBoundingClientRect().top<blocks[i].getBoundingClientRect().bottom-1);
     });
     assert.equal(overlap,false,`overlapping blocks ${id}`);
     if([63,271,515,869,609].includes(id))await section.screenshot({path:`output/explicit-couplings-${id}.png`});
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}/${id}`);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: 22 desktop/mobile diagram pages, typed blocks, EMDR middle, unspecified links, no overlap or page overflow, no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
