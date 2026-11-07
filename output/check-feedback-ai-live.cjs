const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage();
 await page.goto('http://localhost/lcn/mitgestalten.html');
 const config=await (await page.request.get('http://localhost/lcn/api/feedback.php?action=config')).json();
 assert.equal(config.image_generation,true,'KI-Bilderstellung laut Server nicht aktiv');
 await page.locator('.fb-community-heading a[href="#idee"]').click();
 await page.locator('#fb-ai-options summary').click();
 await page.locator('#fb-image-prompt').fill('Eine Lupe über einer gefalteten Landkarte mit einem blauen Weg');
 const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/feedback_image.php')&&r.request().method()==='POST',{timeout:65000}),page.locator('#fb-image-generate').click()]);
 const result=await response.json();
 if(!response.ok()||!result.ok)throw Error('HTTP '+response.status()+': '+result.error);
 const preview=page.locator('#fb-image-preview img');
 await preview.waitFor();
 const size=await preview.evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight]});
 await preview.screenshot({path:'output/feedback-ai-live-test.png'});
 console.log('PASS: Cloudflare generated '+size.join('x')+' image; browser preview decoded; no proposal submitted.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});

