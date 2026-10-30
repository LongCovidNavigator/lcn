const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const endpoint='http://localhost/lcn/api/treatment_classification_feedback.php';
 const read=async()=>{const response=await context.request.get(endpoint+'?id=5');const data=await response.json();assert.equal(data.ok,true,JSON.stringify(data));return data.choices;};
 let voted=false;
 try{
  const initial=await read();assert.equal(Object.values(initial).some(v=>v.own),false);
  await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=5#alternativen');
  const opener=page.locator('[data-treatment-classification="5"]');await opener.waitFor();await opener.click();
  const dialog=page.locator('.ux-classification-dialog');await dialog.locator('[data-role="ingredient"]:enabled').waitFor();
  assert.match(await dialog.innerText(),/Aktuell: Wirkstoff/);
  await dialog.locator('[data-role="ingredient"]').click();voted=true;
  await dialog.getByRole('status').filter({hasText:'Gespeichert: Wirkstoff.'}).waitFor();
  let choices=await read();assert.equal(choices.ingredient.own,true);assert.equal(choices.ingredient.count,initial.ingredient.count+1);
  await dialog.locator('[data-role="brand"]').click();await dialog.getByRole('status').filter({hasText:'Gespeichert: Handelsname.'}).waitFor();
  choices=await read();assert.equal(choices.brand.own,true);assert.equal(choices.ingredient.own,false);assert.equal(choices.ingredient.count,initial.ingredient.count);
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();await opener.click();await dialog.locator('[data-role="brand"][aria-pressed="true"]').waitFor();
  assert.equal(await page.locator('.ux-stage-column-1 [data-stage-node="5"]').count(),1,'Feedback must not move the catalog entry');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:950});const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'Dialog overflow at '+width);}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'output/classification-dialog.png'});
  await dialog.locator('[data-role="brand"]').click();await dialog.getByRole('status').filter({hasText:'zurückgenommen'}).waitFor();voted=false;
  assert.deepEqual(await read(),initial);
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.locator('[data-relationship-stages]').screenshot({path:'output/classification-stage.png'});
  const bad=await context.request.post(endpoint,{headers:{Origin:'http://localhost'},data:{id:5,choice:'invalid'}});assert.equal(bad.status(),400);
  assert.deepEqual(errors,[]);
  console.log('PASS: real saved confirmation, exclusive alternative, persistence, undo, unchanged placement, 3 dialog widths, invalid choice, no JS errors.');
 }finally{
  if(voted)await context.request.post(endpoint,{headers:{Origin:'http://localhost'},data:{id:5,choice:''}});
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
