const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await b.newContext();const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const base='http://localhost/lcn/';
  const summary=await (await context.request.get(base+'api/experience_summary.php?include_dummy=1')).json();
  for(const [type,url] of [['doctor','api/doctors_search.php?lat=51&lng=7&radiusKm=all&'],['treatment','api/treatments_search.php?']]){
   const minKey=type==='doctor'?'minPositiveRatio':'min_positive',healKey=type==='doctor'?'minHealingRatio':'min_healing',negKey=type==='doctor'?'maxNegativeRatio':'max_negative';
   for(const [min,heal,max] of [[0,5,100],[50,0,100],[10,5,20],[0,0,0]]){
    const response=await context.request.get(base+url+`${minKey}=${min}&${healKey}=${heal}&${negKey}=${max}&include_dummy=1`);const data=await response.json();assert.equal(data.ok,true,JSON.stringify(data));
    for(const item of data.items){
     assert.ok(Number(item.positive_ratio)>=min);assert.ok(Number(item.healing_ratio)>=heal);assert.ok(Number(item.negative_ratio)<=max);assert.ok(item.total_votes>0);
     const values=summary.counts[type][item[type==='doctor'?'dr_id':'treat_id']];assert.ok(values);const total=values.reduce((a,b)=>a+b,0);
     assert.equal(Number(item.positive_ratio),Math.round(values[2]*100/total));assert.equal(Number(item.healing_ratio),Math.round(values[3]*100/total));
    }
   }
  }
  await p.goto(base+'arzt_detail.html?id=613&demo=1#wirkung');await p.waitForSelector('#treatment-healing-range');assert.equal(await p.locator('.treatment-rating-controls input[type=range]').count(),3);
  const initial=await p.locator('.treatment-result-count').innerText();
  for(const key of ['positive','healing','negative']){
   const input=p.locator(`#treatment-${key}-number`);await input.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},key==='negative'?'0':'100');assert.equal(await p.locator(`#treatment-${key}-range`).inputValue(),key==='negative'?'0':'100');
   await p.locator('#treatment-reset-filters').click();assert.equal(await p.locator('.treatment-result-count').innerText(),initial);
  }
  await p.setViewportSize({width:390,height:844});assert.ok(await p.locator('.treatment-controls').evaluate(el=>el.scrollWidth<=el.clientWidth));
  for(const [url,prefix] of [['therapien_karte.html','treatment'],['aerzte_karte.html','doctor']]){
   await p.goto(base+url);await p.waitForSelector(`#${prefix}-min-healing-range`);assert.equal(await p.locator(`.${prefix}-rating-control input[type=range]`).count(),3);
   await p.locator(`#${prefix}-min-healing-range`).evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await p.locator(`#${prefix}-min-healing-input`).inputValue(),'25');
   await p.locator(`#${prefix}-filter-reset-button`).click();assert.equal(await p.locator(`#${prefix}-min-healing-input`).inputValue(),'0');
  }
  assert.deepEqual(errors,[]);console.log('PASS: independent improvement/healing/negative API filters match four-category summaries; three detail sliders, synchronization, reset, mobile layout, both search controls; no JS errors.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


