const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of [1440,390])for(const id of [64,65,717]){
const page=await browser.newPage({viewport:{width,height:1000}});
await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
await page.addInitScript(()=>{for(const id of [64,65,717])sessionStorage.setItem('lcn_therapy_guide:'+id,JSON.stringify({mode:'review',minimized:false}));});
await page.goto(`http://localhost/lcn/therapie_detail.php?treatment_id=${id}#alternativen`,{waitUntil:'domcontentloaded'});
const section=page.locator('[data-relationship-stages]');await section.waitFor();
assert.equal(await section.locator('.is-current').count(),1);
assert.equal(await section.locator('.is-current').getAttribute('data-node-level'),'2');
assert.equal(await section.locator('[data-stage="1"] h4').innerText(),'Substanz');
const add=section.getByRole('button',{name:'Weitere Substanz zuordnen',exact:true});
assert.equal(await add.count(),1);
assert.equal(await add.evaluate(n=>n.closest('[data-stage]').dataset.stage),'1');
assert.equal(await add.getAttribute('data-source-id'),String(id));
assert.equal(await add.getAttribute('data-kind'),id===717?'variant_of':'form_of');
assert.equal(await section.locator('.is-current [data-treatment-relation-add]').count(),0);
const edges=JSON.parse(await section.locator('[data-stage-edges]').textContent());
assert.ok(edges.some(([from,,to,child])=>from===1&&to===2&&child===id));
assert.ok(!edges.some(([,parent])=>parent===id));
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
if(width<650)await section.locator('.ux-stage-canvas').evaluate(n=>{n.scrollLeft=n.scrollWidth;});
await section.screenshot({path:`output/fixed-substance-${id}-${width}.png`});
console.log('PASS',width,id,'substance in middle, current on right, sibling edges and no overflow');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
