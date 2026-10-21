const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function open(id) {
      await page.goto(`http://localhost/lcn/therapie_detail.php?treatment_id=${id}#alternativen`, { waitUntil: 'domcontentloaded' });
      await page.locator('#alternativen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.ux-symptom-discovery,.ux-alias-discovery').count(), 0);
      assert.equal(await page.locator('#alternativen a[href*="treatment_id=0"]').count(), 0);
    }
    async function screenshot(name) {
      const output = path.join(os.tmpdir(), `lcn-discovery-${name}.png`);
      await page.screenshot({ path: output, fullPage: true });
      console.log(output);
    }
    async function follow(name) {
      await page.locator('.ux-alias-navigation').getByRole('link', { name, exact: false }).first().click();
      await page.locator('#alternativen').waitFor({ state: 'visible' });
    }
    await open(169);
    assert.equal(await page.locator('.ux-alias-navigation .ux-relationship-table a').count(), 9);
    await follow('Desloratadin');
    await page.locator('.ux-alias-navigation').getByRole('heading', { name: /^(Handelsnamen dieses Wirkstoffs|Handelsnamen für Desloratadin)$/ }).waitFor();
    await follow('Aerius');
    await page.locator('[data-alias-role=trade]').waitFor();
    assert.equal(await page.locator('.ux-alias-navigation a').count(), 1);
    await follow('Desloratadin');
    await page.locator('.ux-alias-navigation').getByRole('heading', { name: /^(Handelsnamen dieses Wirkstoffs|Handelsnamen für Desloratadin)$/ }).waitFor();
    await screenshot('generic');
    await open(447);
    await follow('Sortis');
    await page.locator('.ux-alias-navigation').getByRole('heading', { name: 'Weitere Handelsnamen desselben Wirkstoffs' }).waitFor();
    assert.equal(await page.locator('.ux-alias-navigation').getByRole('link', { name: /Lipitor/ }).count(), 1);
    await open(271);
    await follow('EMDR');
    assert.equal(await page.locator('.ux-alias-navigation').getByRole('link', { name: 'Psychotherapie', exact: true }).count(), 1);
    await screenshot('procedure');
    await open(869);
    await follow('NAD⁺ (oral)');
    assert.equal(await page.locator('.ux-alias-navigation').getByRole('link', { name: /NAD⁺ \(subkutan\)/ }).count(), 1);
    await screenshot('forms');
    await open(22);
    await follow('Maraviroc & Pravastatin');
    await page.locator('[data-alias-role=combination]').waitFor();
    assert.equal(await page.locator('.ux-alias-navigation .ux-relationship-table a').count(), 2);
    await screenshot('combination');
    await open(78);
    await follow('Nirmatrelvir & Ritonavir');
    assert.equal(await page.locator('.ux-unlinked-entry').count(), 2);
    await screenshot('unlinked-components');
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of [169, 84, 693, 271, 515, 176, 479, 65, 869, 23, 94, 98, 451, 447]) {
        await open(id);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow: ${id} at ${width}`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: group/member/brand/form/combination round trips, missing targets as text, 42 responsive page checks, no JS errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
