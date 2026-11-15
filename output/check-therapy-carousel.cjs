const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346&demo=0');await page.waitForFunction(()=>document.querySelector('[data-question="effect"]').dataset.realAnswerCount!==undefined);
 const carousel=page.locator('[data-therapy-welcome] .therapy-intent-carousel');
 assert.equal(await carousel.locator('.therapy-intent-slide').count(),5);
 const titles=await carousel.locator('.therapy-intent-title strong').allTextContents();assert.deepEqual(titles.map(t=>t.replace(/^\d+\. /,'')),['Meine Erfahrung teilen','Behandler finden (Karte)','Bei welchem Symptom hilft die Therapie?','Erfahrungen anderer ansehen','Therapiealternativen']);
 await carousel.locator('.therapy-intent-title').first().click();assert.equal(await carousel.locator('.therapy-intent-detail').first().isVisible(),true);assert.equal(await page.locator('#ueberblick').isVisible(),true);
 await page.screenshot({path:`output/therapy-vertical-${width}.png`});
 await carousel.getByRole('button',{name:'Erfahrung teilen →',exact:true}).click();await page.locator('#wirkung').waitFor({state:'visible'});
 assert.equal(await page.locator('.therapy-guide-thanks').count(),0);
 const height=await page.locator('#wirkung .therapy-guide-note').evaluate(n=>n.getBoundingClientRect().height);console.log('guide height',width,height);
 await page.evaluate(()=>{document.querySelectorAll('#wirkung [data-option]').forEach(n=>n.setAttribute('aria-pressed','false'));document.querySelectorAll('#wirkung [data-question]').forEach(card=>card.querySelector('[data-option]').setAttribute('aria-pressed','true'));document.dispatchEvent(new Event('lcn-treatment-answers-rendered'));});
 assert.equal(await page.locator('#wirkung details.is-complete').count(),2);assert.equal(await page.locator('[data-view="wirkung"].therapy-section-complete').count(),1);
 await page.screenshot({path:`output/therapy-progress-${width}.png`});
 await page.locator('#wirkung').getByRole('button',{name:'Ich brauche keine Orientierung',exact:true}).click();assert.equal(await page.locator('.therapy-guide-note,.experience-guide-banner').count(),0);
 await page.locator('[data-view="ueberblick"]').click();assert.equal(await page.locator('.experience-guide-banner').count(),0);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();const dialog=page.locator('dialog.therapy-orientation');await page.waitForTimeout(350);await dialog.getByRole('button',{name:'Nächstes Anliegen'}).click();await page.waitForTimeout(450);await dialog.locator('.therapy-intent-title').nth(1).click();await dialog.getByRole('button',{name:'Behandler suchen →'}).click();assert.equal(await page.locator('#anreise').isVisible(),true);
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(400);
 const sizes=await page.evaluate(()=>{const a=document.querySelector('.therapy-orientation-fab').getBoundingClientRect(),b=document.querySelector('.lcn-feedback-float').getBoundingClientRect();return {aw:a.width,bw:b.width,ah:a.height,bh:b.height,gap:b.top-a.bottom, rightGap:Math.abs(a.right-b.right)}});assert.ok(Math.abs(sizes.aw-sizes.bw)<1);assert.ok(Math.abs(sizes.ah-sizes.bh)<1);assert.ok(sizes.rightGap<1,JSON.stringify(sizes));assert.ok(sizes.gap>=11,JSON.stringify(sizes));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();console.log('PASS carousel, progress, disable/re-enable, button sizing and footer spacing',width);
}
assert.deepEqual(errors,[]);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
