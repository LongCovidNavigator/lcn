const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
for(const count of [0,3,12])for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/treatment_answer.php?*',async route=>{const response=await route.fetch();const data=await response.json();for(const key of Object.keys(data.counts||{})){data.counts[key]=data.counts[key].map((_,i)=>i===0?count:0);}data.counts.effect=[count,0,0,0,0,0];data.own_answers={};if(data.symptom_help)data.symptom_help.symptoms=[];await route.fulfill({response,json:data});});
 await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346&demo=0');
 await page.waitForFunction(()=>document.querySelector('[data-question="effect"]').dataset.realAnswerCount!==undefined);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();await page.locator('dialog').getByRole('button',{name:/Erfahrungen anderer ansehen/}).click();
 if(count===0){await page.getByRole('dialog',{name:'Deine Einladung kann den Anfang machen'}).waitFor();assert.match(await page.locator('dialog a[href^="mailto:"]').getAttribute('href'),/anliegen/);await page.getByRole('button',{name:'Trotzdem umsehen'}).click();}
 const status=page.locator('.nd-panel:not([hidden]) .therapy-guide-data-status');assert.equal(await status.getAttribute('data-level'),count>=10?'full':count?'few':'none');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();await page.locator('dialog').getByRole('button',{name:/Behandler finden/}).click();assert.equal(await page.locator('#anreise').isVisible(),true);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();await page.locator('dialog').getByRole('button',{name:/Therapiealternativen/}).click();assert.equal(await page.locator('#alternativen').isVisible(),true);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();await page.locator('dialog').getByRole('button',{name:/Meine Erfahrung teilen/}).click();assert.equal(await page.locator('#wirkung [data-question="effect"]').isVisible(),true);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:`output/therapy-intents-dialog-${width}.png`});await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.locator('dialog').count(),0);
 await page.close();console.log('PASS',count,width);
}
const page=await browser.newPage();await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346&anliegen=erfahrung');assert.equal(await page.locator('#wirkung').isVisible(),true);assert.match(await page.locator('#wirkung .experience-guide-eyebrow').innerText(),/DEINE ERFAHRUNG/);await page.close();assert.deepEqual(errors,[]);await browser.close();console.log('PASS invitation deep link, all intents, 3 data states, mobile/desktop, no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
