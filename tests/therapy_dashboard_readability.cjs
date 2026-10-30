const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1536,height:1100}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let mode='distance';
    await page.addInitScript(()=>localStorage.setItem('lcn_shared_location_preference',JSON.stringify({lat:50,lng:7})));
    await page.route('**/api/treatment_answer.php?*',async route=>{
      const response=await route.fetch(),data=await response.json();
      const profile=data.comparison_profiles.find(p=>p.id===2);
      assert.ok(profile);
      profile.independent_at_home=mode==='home';profile.online_at_home=mode==='online'||mode==='prescription-online';profile.home_delivery=mode.startsWith('prescription')||mode==='free-home';profile.prescription_required=mode.startsWith('prescription')||mode==='home-visit';profile.home_visit_setting=mode==='home-visit';profile.freely_available=mode==='free-home';
      profile.providers=mode==='missing'?[]:[{id:1,lat:50,lng:7}];
      await route.fulfill({response,json:data});
    });
    for(mode of ['distance','home','online','missing','prescription','prescription-online','free-home','home-visit']){
      await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=2&demo=1&check='+mode+'#dashboard');
      const travel=page.locator('[data-dashboard-question=distance]');
      await page.waitForFunction(()=>document.querySelector('[data-dashboard-question=unit_cost] .therapy-cost-table tbody tr'));
      await page.waitForFunction(()=>document.querySelector('.ux-answer-status')?.textContent==='');
      assert.match(await travel.innerText(),mode==='missing'?/kein bestätigter Anbieter/:mode==='prescription'?/14,5\s*\/ 15 Punkte/:mode==='distance'?/14\s*\/ 15 Punkte/:/15\s*\/ 15 Punkte/);
      for(const key of ['unit_cost','total_cost']){
        const rows=page.locator(`[data-dashboard-question=${key}] .therapy-cost-table tbody tr`);
        assert.equal(await rows.count(),10);
        assert.equal(await rows.first().locator('.therapy-cost-maximum').innerText(),'20');
        assert.equal(await rows.locator('.therapy-cost-contribution').count(),10);
      }
    }
    mode='distance';await page.reload();await page.waitForFunction(()=>document.querySelector('.ux-answer-status')?.textContent==='');await page.waitForTimeout(1000);
    assert.equal(await page.locator('#dashboard .score-parts .therapy-calculation-help').count(),0);
    assert.equal(await page.locator('#dashboard .score-explanation').getByText('Entfernung',{exact:false}).count(),0);
    for(const key of ['setting','pem','access','effect','gamechanger','distance','unit_cost','total_cost']){
      assert.equal(await page.locator(`[data-dashboard-question=${key}]>.therapy-calculation-help`).count(),1);
    }
    const help=page.locator('[data-dashboard-question=distance]>.therapy-calculation-help');
    await help.locator('summary').click();assert.equal(await help.getAttribute('open'),'');
    assert.match(await help.innerText(),/einmaligen Vor-Ort-Termin/);
    await help.locator('summary').click();
    const box=key=>page.locator(`[data-dashboard-question=${key}]`).boundingBox();
    const setting=await box('setting'),pem=await box('pem'),travel=await box('distance');
    assert.equal(setting.y,pem.y);assert.ok(travel.y>setting.y);assert.ok(travel.width>setting.width*1.8);
    const totalCost=await box('total_cost'),unitCost=await box('unit_cost');
    assert.equal(totalCost.y,unitCost.y);
    assert.equal(await page.locator('.therapy-cost-pair>.is-cost-basis').count(),1);
    for(const key of ['setting','pem','access','effect']){
      const card=page.locator(`[data-dashboard-question=${key}]`);
      assert.equal(await card.locator('.therapy-distribution-heading>span').count(),4);
      assert.match(await card.locator('.therapy-stage-maximum').first().innerText(),/^\d+(,\d+)?$/);
      assert.match(await card.locator('.therapy-stage-contribution').first().innerText(),/^\d+(,\d+)?$/);
    }
    const effect=await box('effect'),game=await box('gamechanger');
    assert.equal(effect.y,game.y);assert.ok(Math.abs(effect.height-game.height)<2);
    const levels=await page.locator('.dashboard-travel-scale>li').all();
    assert.equal((await levels[0].boundingBox()).y,(await levels[6].boundingBox()).y);
    await page.screenshot({path:'output/therapy-dashboard-desktop.png',fullPage:true});
    for(const width of [1024,768,390]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
      assert.ok(await page.locator('.therapy-distribution-row').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<=13);
    }
    await page.screenshot({path:'output/therapy-dashboard-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: readable dashboard, both cost point scales, local/online/home/missing travel, responsive widths, no browser errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

