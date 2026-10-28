const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.route('https://**/*',route=>route.abort());
 await p.goto('http://localhost/lcn/therapie_detail.php?treatment_id=1&demo=1#termin',{waitUntil:'domcontentloaded'});
 await p.waitForSelector('.top-map-location-layout');
 const result=await p.evaluate(()=>{const canvas=document.querySelector('.nd-map-canvas'),host=document.querySelector('.top-map-location-controls'),radius=document.querySelector('[data-radius]'),city=document.querySelector('[data-provider-city]');return {map:canvas.getBoundingClientRect().toJSON(),control:host.getBoundingClientRect().toJSON(),radius:radius.getBoundingClientRect().toJSON(),city:city.getBoundingClientRect().toJSON(),styles:[...document.styleSheets].map(s=>s.href),radiusStyle:{width:getComputedStyle(radius).width,minWidth:getComputedStyle(radius).minWidth},root:document.querySelector('.ux-detail').className};});
 assert(result.map.height>=450);
 assert.equal(result.control.height,result.map.height);
 assert.equal(result.radius.width,58);
 assert(result.radius.right<=result.control.right&&result.city.right<=result.control.right);
 const sidebarPositions=()=>p.locator('.top-map-location-controls').first().evaluate(host=>{const y=host.getBoundingClientRect().top;return ['.nd-location-title','.nd-map-location','.nd-location-mode-switch','.nd-location-summary'].map(selector=>host.querySelector(selector).getBoundingClientRect().top-y);});
 const radiusPositions=await sidebarPositions();
 await p.locator('[data-location-mode=city]').click();
 assert.equal(await p.locator('[data-provider-city]').evaluate(e=>e.getBoundingClientRect().height),32);
 const cityPositions=await sidebarPositions();
 radiusPositions.forEach((position,i)=>assert(Math.abs(position-cityPositions[i])<1,'Common sidebar sections must stay in place'));
 await p.locator('[data-location-mode=radius]').click();
 assert.equal(result.radius.height,30);
 const radiusOrder=await p.locator('[data-location-radius-controls]').evaluate(e=>[...e.children].map(n=>n.className));
 assert.equal(radiusOrder[0],'nd-radius-value');assert.equal(radiusOrder[1],'nd-radius-toggle');
 console.log('PASS: shared sidebar sections stay stationary across radius/city modes; radius input precedes activation switch.');

 assert(await p.locator('.nd-location-heading [data-map-clear]').count());
 assert.match(await p.locator('[data-location-provider-count]').innerText(),/\d+ von \d+/);
 console.log('PASS: desktop map 450px high, matching controls, radius 58px wide, city selector inside sidebar.');
 const order=await p.locator('.top-map-location-controls').first().evaluate(e=>[...e.children].map(n=>n.className));
 assert(order.indexOf('nd-map-location')<order.indexOf('nd-location-mode-switch'));
 assert.equal(await p.locator('.nd-location-title').innerText(),'Standortsuche');
 await p.route('**/api/geocode_location.php**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,result:{lat:51.65,lng:7.09,formatted:'Marl',city:'Marl'}})}));
 await p.locator('.nd-map-location input[name=location]').fill('Marl');
 await p.locator('.nd-map-location input[name=location]').press('Escape');
 await p.locator('.nd-location-submit').click();
 await p.waitForFunction(()=>JSON.parse(localStorage.getItem('lcn_shared_location_preference')||'null')?.label==='Marl');
 await p.locator('[data-radius-enabled]').check();
 assert(await p.locator('[data-radius-enabled]').isChecked());
 assert.equal(await p.locator('[data-include-no-coords]').isDisabled(),false);
 await p.waitForSelector('.nd-map-canvas svg path[stroke="#0875ee"]');
 assert.equal(await p.locator('.nd-map-canvas svg path[stroke="#0875ee"]').getAttribute('stroke-dasharray'),null);
 await p.locator('[data-radius-enabled]').uncheck();
 assert.equal(await p.locator('[data-include-no-coords]').isDisabled(),true);
 assert.equal(await p.locator('.nd-map-canvas svg path[stroke="#0875ee"]').count(),0);
 console.log('PASS: address before mode switch; radius toggle draws and removes solid circle and updates dependent controls.');
 await p.locator('[data-location-mode=city]').click();
 await p.locator('[data-provider-city]').selectOption({label:'Köln'});
 let cityCount=await p.locator('[data-location-provider-count]').innerText();
 assert.equal(Number(cityCount.split(' von ')[0]),1);
 await p.locator('[data-provider-city]').selectOption('');
 cityCount=await p.locator('[data-location-provider-count]').innerText();
 const [shown,total]=cityCount.split(' von ').map(Number);assert(shown>0);assert.equal(shown,total);
 console.log('PASS: Köln filters to one provider; All cities restores every provider despite origin Marl.');
 await p.locator('[data-location-mode=radius]').click();

 await p.locator('[data-provider-view=table]').click();
 await p.waitForSelector('.nd-provider-table .catalog-rating-negative .provider-value-unit');
 const numeric=await p.locator('.nd-provider-table').evaluate(table=>{
  const rows=[...table.tBodies[0].rows].filter(r=>!r.classList.contains('nd-provider-group-row'));
  return {color:getComputedStyle(table.querySelector('.catalog-rating-negative')).color,columns:[3,4,5,6].map(index=>rows.flatMap(row=>{const cell=row.cells[index],value=cell.querySelector('.provider-numeric-value');if(!value)return [];const unit=value.querySelector('.provider-value-unit').getBoundingClientRect(),num=value.querySelector('.provider-value-number');return [{unitLeft:unit.left,numberRight:num.getBoundingClientRect().right,text:num.textContent,centerDelta:Math.abs(value.getBoundingClientRect().left+value.getBoundingClientRect().width/2-cell.getBoundingClientRect().left-cell.getBoundingClientRect().width/2)}];}))};
 });
 assert.equal(numeric.color,'rgb(164, 62, 87)');
 for(const column of numeric.columns){assert(column.length>1);for(const value of column){assert(!value.text.includes(','));assert(Math.abs(value.unitLeft-column[0].unitLeft)<1);assert(Math.abs(value.numberRight-column[0].numberRight)<1);assert(value.centerDelta<1);}}
 console.log('PASS: red worsening percentages; centered integer values with aligned digits and units in all four numeric columns.');
 const feedbackHeader=await p.locator('.nd-provider-table thead th').last().evaluate(cell=>{const range=document.createRange();range.selectNodeContents(cell.querySelector('button'));const text=range.getBoundingClientRect(),box=cell.getBoundingClientRect();return {left:text.left-box.left,right:box.right-text.right};});
 assert(feedbackHeader.left>=0&&feedbackHeader.right>=0,'Feedback heading must fit inside its column');
 assert.equal(await p.locator('.provider-distance-cell .provider-numeric-value').first().evaluate(e=>e.style.getPropertyValue('--number-width')),'2ch');
 console.log('PASS: feedback heading fully visible; distance groups centered on a two-digit number slot.');
 await p.waitForSelector('.nd-map-notes .lcn-online-legend');
 const legendPosition=await p.evaluate(()=>{const legend=document.querySelector('.nd-map-notes .lcn-online-legend').getBoundingClientRect(),map=document.querySelector('.nd-map-canvas').getBoundingClientRect();return {left:legend.left-map.left,gap:legend.top-map.bottom};});
 assert(Math.abs(legendPosition.left)<1);assert(legendPosition.gap>=0&&legendPosition.gap<=8);
 await p.locator('[data-provider-search]').fill('no-matching-provider-xyz');
 await p.waitForFunction(()=>document.querySelector('.nd-map-notes .lcn-online-legend')?.textContent==='Dein Standort');
 await p.locator('[data-map-clear]').click();
 await p.waitForFunction(()=>document.querySelector('.nd-map-notes .lcn-online-legend')?.hidden===true);
 await p.locator('[data-provider-search]').fill('');
 console.log('PASS: legend directly below map; empty provider filter shows only red, clearing own location hides the empty legend.');




 await p.setViewportSize({width:390,height:844});
 const mobile=await p.evaluate(()=>{const control=document.querySelector('.top-map-location-controls').getBoundingClientRect(),radius=document.querySelector('[data-radius]').getBoundingClientRect(),city=document.querySelector('[data-provider-city]').getBoundingClientRect();return {height:document.querySelector('.nd-map-canvas').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth,contained:radius.right<=control.right&&city.right<=control.right};});
 assert.equal(mobile.height,380);assert(mobile.contained);assert(!mobile.overflow);
 console.log('PASS: mobile map 380px high, controls contained, no page overflow.');
 await p.setViewportSize({width:1440,height:1000});
 for(const [file,prefix] of [['aerzte_karte.html','doctor'],['therapien_karte.html','treatment']]){
  await p.goto('http://localhost/lcn/'+file,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('.'+prefix+'-location-mode-button.is-active');
  assert.equal(await p.locator('.'+prefix+'-location-mode-button.is-active').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(8, 120, 227)');
  assert.equal(await p.locator('.lcn-map-submit').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(8, 120, 227)');
  console.log('PASS: blue active mode and submit button on '+file);
 }


}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
