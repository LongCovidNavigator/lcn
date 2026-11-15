const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}); const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346');
 await page.waitForTimeout(1800);
 console.log(width,await page.locator('[data-therapy-welcome]').innerText());
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();
 await page.locator('dialog').getByRole('button',{name:/Bei welchen Symptomen/}).click();
 console.log('symptom',await page.locator('#symptome').isVisible(),'overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:`output/therapy-orientation-${width}.png`,fullPage:false});
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();
 await page.locator('dialog').getByRole('button',{name:/Erfahrungen anderer ansehen/}).click();
 console.log('empty-dialog',await page.locator('dialog').count());
 if(await page.locator('dialog').count())await page.locator('dialog').getByRole('button',{name:'Trotzdem umsehen'}).click();
 await page.getByRole('button',{name:'Orientierung',exact:true}).click();
 await page.locator('dialog').getByRole('button',{name:/Meine Erfahrung teilen/}).click();
 console.log('review',await page.locator('#wirkung .therapy-guide-note').innerText());
}
console.log('errors',errors);await browser.close();if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
