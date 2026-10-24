const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();let saved=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/treatment_relationship_proposals.php*',async route=>{
  if(route.request().method()==='POST'){saved=true;return route.fulfill({json:{ok:true,submission_id:999999}});}
  const response=await route.fetch(),data=await response.json();assert.equal(data.ok,true,data.error);
  data.pending=data.pending.filter(n=>n.kind!=='alternative');
  if(saved)data.pending.push({submission_id:999999,kind:'alternative',left_id:5,right_id:4,description:'LDA als alternative Therapie zu Ivabradin'});
  await route.fulfill({json:data});
 });
 try{
  await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=5#alternativen');
  await page.locator('.ux-alternative-add').click();const dialog=page.locator('.treatment-relation-dialog');
  await dialog.getByRole('combobox').fill('LDA');await dialog.getByRole('option',{name:/Aripiprazol/}).first().click();
  await dialog.getByRole('button',{name:'Vorschlagen',exact:true}).click();
  await dialog.getByText('Dein Vorschlag ist gespeichert und erscheint mit „Prüfung ausstehend“.', {exact:true}).waitFor();
  const tile=page.locator('[data-pending-alternative="999999"]');await tile.waitFor({state:'attached'});
  assert.match(await tile.innerText(),/Prüfung ausstehend/);assert.match(await tile.innerText(),/Aripiprazol/);
  await page.reload();await tile.waitFor();assert.equal(await tile.count(),1);
  await tile.locator('.catalog-feedback button').first().waitFor();
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('lcn-treatment-relations-changed')));
  await page.waitForResponse(r=>r.url().includes('treatment_relationship_proposals.php?id='));
  assert.equal(await tile.count(),1);assert.deepEqual(errors,[]);
  console.log('PASS: alternative visible immediately after submission, after reload, with pending label and feedback, without duplicates.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
