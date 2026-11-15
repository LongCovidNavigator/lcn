const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({viewport: {width, height: 1000}});
      await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=346');
      const host = page.locator('[data-therapy-welcome]');
      await host.locator('.therapy-wheel-marker').first().waitFor();
      await page.waitForTimeout(400);
      for (let from = 0; from < 5; from++) {
        for (let to = 0; to < 5; to++) {
          if (from === to) continue;
          const result = await host.evaluate(async (host, {from, to}) => {
            const track = host.querySelector('.therapy-intent-track');
            track.scrollTop = (5 + from) * 52;
            await new Promise(resolve => setTimeout(resolve, 200));
            const rows = host.querySelectorAll('.therapy-wheel-visual-option');
            const top = track.scrollTop;
            const deltaY = rows[to].getBoundingClientRect().y - rows[from].getBoundingClientRect().y;
            let target;
            track.scrollTo = options => { target = options.top; };
            rows[to].click();
            delete track.scrollTo;
            return {deltaY, delta: target - top};
          }, {from, to});
          assert.equal(Math.sign(result.delta), Math.sign(result.deltaY), `${width}: ${from + 1} -> ${to + 1}`);
          assert.ok(Math.abs(result.delta) <= 104.5);
        }
      }
      await host.locator('.therapy-wheel-visual-option').nth(1).click();
      await page.waitForTimeout(700);
      await host.locator('.therapy-wheel-visual-option').nth(1).click();
      await page.waitForTimeout(350);
      assert.match(await host.locator('.therapy-intent-reveal-copy p').innerText(), /Wähle einen Ort aus, um Behandler in der Nähe zu finden\./);
      console.log(`PASS ${width}: all 20 click directions, shortest paths and provider copy`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
