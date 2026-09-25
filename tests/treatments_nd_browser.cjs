// Run: node tests/treatments_nd_browser.cjs (installed Edge, no browser download).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.LCN_TEST_URL || 'http://localhost/lcn/';
    await page.goto(base + 'treatments_nd_test.php');
    assert.ok(await page.locator('.nd-result').count() > 0);
    await page.locator('#nd-search').fill('Psychologische Begleitung');
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    assert.deepEqual(await page.locator('.nd-result h2').allTextContents(), ['Psychotherapie']);
    await page.getByRole('link', { name: 'Behandlung ansehen' }).click();
    assert.match(await page.locator('h1').textContent(), /Psychotherapie/);
    await page.goto(base + 'treatment_nd_test.php?id=2');
    await page.locator('.side-nav a[data-view=ueberblick]').click();
    assert.ok(await page.getByRole('heading', { name: 'Anwendung des Medikaments' }).isVisible());
    await page.locator('.side-nav a[data-view=zugang]').click();
    assert.equal(await page.locator('#apotheken li').count(), 2);
    assert.ok(await page.locator('#anbieter li').count() > 0);
    await page.locator('.side-nav a[data-view=zugang]').press('Home');
    assert.equal(await page.locator('.side-nav a[data-view=ueberblick]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.side-nav a').count(), 5);
    await page.locator('.side-nav a[data-view=wirkung]').click();
    assert.ok(await page.locator('#wirkung').isVisible());
    await page.locator('.side-nav a[data-view=dashboard]').click();
    assert.ok(await page.locator('#apotheken').isVisible());
    await page.locator('.side-nav a[data-view=ueberblick]').click();
    await page.screenshot({ path: process.env.TEMP + '/lcn-nd-desktop.png', fullPage: true });
    await page.goto(base + 'treatment_nd_test.php?id=1');
    await page.locator('.side-nav a[data-view=termin]').click();
    assert.equal(await page.getByRole('heading', { name: 'Anwendung des Medikaments' }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.TEMP + '/lcn-nd-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto(base + 'treatments_nd_test.php');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS: browser search, detail navigation, tabs/keyboard, LDN, Pacing, mobile overflow and JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
