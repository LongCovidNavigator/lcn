const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const visit=async kind=>{await page.goto('http://localhost/lcn/'+(kind==='doctor'?'behandler_suche.html':'therapien_suche.html'));await page.waitForFunction(()=>typeof L!=='undefined');};
  const expanded=async(kind,value)=>{const b=page.locator('#'+kind+'-navigation-toggle-button');if(await b.getAttribute('aria-expanded')===String(value))await b.click();if(await b.getAttribute('aria-expanded')!==String(value))await b.click();await page.waitForFunction(([k,v])=>localStorage.getItem('lcn_filter_panel_expanded_'+k)===String(v),[kind,value]);};
  const check=async(kind,value)=>{assert.equal(await page.locator('#'+kind+'-navigation-toggle-button').getAttribute('aria-expanded'),String(value));assert.equal(await page.locator('#'+kind+'-navigation-content').evaluate(e=>e.classList.contains('is-collapsed')),!value);};
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await visit('doctor');await expanded('doctor',true);await page.reload();await check('doctor',true);
   await visit('treatment');await expanded('treatment',false);await page.reload();await check('treatment',false);
   await visit('doctor');await check('doctor',true);await expanded('doctor',false);
   await visit('treatment');await check('treatment',false);await expanded('treatment',true);
   await visit('doctor');await check('doctor',false);await page.reload();await check('doctor',false);
   await visit('treatment');await check('treatment',true);await page.reload();await check('treatment',true);
  }
  assert.deepEqual(errors,[]);console.log('PASS: independent open/closed filter state survives reload and page navigation on desktop and mobile.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
