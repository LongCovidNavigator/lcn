const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346&demo=0');
 const host=page.locator('[data-therapy-welcome]');const wheel=host.getByRole('listbox');await wheel.waitFor();await page.waitForTimeout(700);
 assert.equal(await wheel.getByRole('option').count(),5);
 assert.match(await wheel.getByRole('option',{selected:true}).innerText(),/Meine Erfahrung teilen/);
 const measure=await wheel.evaluate(el=>{const active=el.querySelector('.is-current').getBoundingClientRect(),track=el.getBoundingClientRect();return {delta:Math.abs((active.top+active.bottom)/2-(track.top+track.bottom)/2),visible:[...el.children].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>track.top&&r.top<track.bottom}).length}});assert.ok(measure.delta<=3,JSON.stringify(measure));assert.equal(measure.visible,2);assert.equal(await host.getByRole('button',{name:'Vorheriges Anliegen',exact:true}).isDisabled(),true);
 await host.getByRole('button',{name:'Nächstes Anliegen',exact:true}).click();await page.waitForTimeout(600);assert.match(await wheel.getByRole('option',{selected:true}).innerText(),/Behandler finden/);
 await wheel.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(600);assert.match(await wheel.getByRole('option',{selected:true}).innerText(),/Bei welchem Symptom/);
 await page.keyboard.press('Enter');assert.equal(await host.getByRole('button',{name:'Symptome ansehen →',exact:true}).isVisible(),true);
 await page.screenshot({path:`output/therapy-wheel-expanded-${width}.png`});
 await host.getByRole('button',{name:'Symptome ansehen →',exact:true}).click();assert.equal(await page.locator('#symptome').isVisible(),true);
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();const dialog=page.locator('dialog.therapy-orientation');const picker=dialog.getByRole('listbox');await page.waitForTimeout(350);await picker.focus();await page.keyboard.press('ArrowUp');await page.waitForTimeout(300);assert.match(await picker.getByRole('option',{selected:true}).innerText(),/Meine Erfahrung teilen/);await page.keyboard.press('End');await page.waitForTimeout(700);assert.match(await picker.getByRole('option',{selected:true}).innerText(),/Therapiealternativen/);assert.equal(await dialog.getByRole('button',{name:'N�chstes Anliegen',exact:true}).isDisabled(),true);await page.keyboard.press('ArrowDown');await page.waitForTimeout(200);assert.match(await picker.getByRole('option',{selected:true}).innerText(),/Therapiealternativen/);
 await page.keyboard.press('Enter');assert.equal(await dialog.getByRole('button',{name:'Alternativen ansehen →',exact:true}).isVisible(),true);await page.keyboard.press('Enter');
 await page.screenshot({path:`output/therapy-wheel-dialog-${width}.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.locator('[data-view="ueberblick"]').click();await page.waitForTimeout(250);await host.screenshot({path:`output/therapy-wheel-${width}.png`});
 if(width>850){const heights=await page.evaluate(()=>{const a=document.querySelector('.ux-treatment-identity').getBoundingClientRect(),b=document.querySelector('[data-therapy-welcome] > .experience-guide-banner').getBoundingClientRect();return {top:Math.abs(a.top-b.top),bottom:Math.abs(a.bottom-b.bottom)}});assert.ok(heights.top<1&&heights.bottom<1,JSON.stringify(heights));}assert.equal(await host.locator('.experience-guide-art').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(300);const rect=await page.evaluate(()=>{const a=document.querySelector('.therapy-orientation-fab').getBoundingClientRect(),b=document.querySelector('.lcn-feedback-float').getBoundingClientRect();return {right:Math.abs(a.right-b.right),gap:b.top-a.bottom}});assert.ok(rect.right<1&&rect.gap>=11,JSON.stringify(rect));
 await page.close();console.log('PASS',width,'bounded rows, centered selection, arrows/keyboard, height alignment, expansion, navigation, motif and floating buttons');
}
assert.deepEqual(errors,[]);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
