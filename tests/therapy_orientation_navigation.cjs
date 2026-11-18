const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const base = 'http://localhost/lcn/';
const therapy = id => `${base}therapie_detail.php?treatment_id=${id}#alternativen`;

async function testNavigation(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());

  try {
    const dialog = page.locator('dialog.therapy-orientation[open]');
    const current = dialog.locator('[role="option"][aria-selected="true"]');
    const dismissOrientation = dialog.getByRole('button', {name: 'Ich brauche keine Orientierung', exact: true});
    const restoreOrientation = page.getByRole('button', {name: 'Orientierung zurückholen', exact: true});
    const guideState = id => page.evaluate(id => JSON.parse(sessionStorage.getItem('lcn_therapy_guide:' + id)), id);

    await page.goto(therapy(169));
    await current.getByText('Meine Erfahrung teilen', {exact: true}).waitFor();
    await dismissOrientation.click();
    await restoreOrientation.click();
    await current.getByText('Meine Erfahrung teilen', {exact: true}).waitFor();
    await dialog.getByRole('listbox').press('End');
    await current.getByText('Therapiealternativen', {exact: true}).waitFor();
    await dialog.getByRole('listbox').press('Enter');
    await dialog.getByRole('button', {name: 'Alternativen ansehen →', exact: true}).click();
    await page.locator('#alternativen .therapy-guide-note').waitFor();

    await page.evaluate(() => {
      sessionStorage.setItem('lcn_therapy_guide:84', JSON.stringify({
        mode: 'review', minimized: true, finishedSections: {termin: true}
      }));
    });
    await page.locator('[data-stage-node="84"] a.ux-stage-name').click();
    await page.waitForURL(therapy(84));
    await page.locator('#alternativen .therapy-guide-note').waitFor();
    assert.equal(await dialog.count(), 0);
    const inherited = await guideState(84);
    assert.equal(inherited.mode, 'alternatives');
    assert.equal(inherited.minimized, false);
    assert.deepEqual(inherited.finishedSections, {termin: true});

    await page.evaluate(() => sessionStorage.setItem('lcn_therapy_guide:169', JSON.stringify({mode: 'review'})));
    await page.reload();
    await page.locator('#alternativen .therapy-guide-note').waitFor();
    assert.equal((await guideState(84)).mode, 'alternatives');
    await page.goBack();
    await page.waitForURL(therapy(169));
    await page.locator('#alternativen .therapy-guide-note').waitFor();
    assert.equal((await guideState(169)).mode, 'review');
    await page.goForward();
    await page.waitForURL(therapy(84));
    await page.locator('#alternativen .therapy-guide-note').waitFor();
    assert.equal((await guideState(84)).mode, 'alternatives');

    await page.locator('.side-nav [data-view="ueberblick"]').click();
    await page.getByRole('heading', {name: 'Orientierung fortsetzen'}).waitFor();
    assert.equal(await page.locator('[data-therapy-welcome] [role="listbox"]').count(), 0);
    await page.getByRole('button', {name: 'Anliegen ändern', exact: true}).click();
    await current.getByText('Therapiealternativen', {exact: true}).waitFor();
    await dialog.getByRole('listbox').press('Escape');
    await restoreOrientation.waitFor();

    await page.goto(base + 'therapien_suche.html');
    const link = page.locator(':is(.treatment-table-detail-link, .treatment-card-title-link)'
      + '[href^="therapie_detail.php?treatment_id="]:not([href$="=169"], [href$="=84"], [href$="=346"]):visible').first();
    const resultUrl = new URL(await link.getAttribute('href'), base);
    const resultId = resultUrl.searchParams.get('treatment_id');
    await link.click();
    await page.waitForURL(resultUrl.href);
    await page.locator('[data-therapy-welcome] [role="option"][aria-selected="true"]')
      .getByText('Therapiealternativen', {exact: true}).waitFor();
    assert.equal(await guideState(resultId), null);
    await page.locator('.side-nav [data-view="alternativen"]').click();
    await current.getByText('Therapiealternativen', {exact: true}).waitFor();
    assert.equal(await guideState(resultId), null);

    await dismissOrientation.click();
    await restoreOrientation.waitFor();
    await page.goto(therapy(84));
    await restoreOrientation.waitFor();
    await page.locator('[data-stage-node="169"] a.ux-stage-name').click();
    await page.waitForURL(therapy(169));
    await restoreOrientation.waitFor();
    assert.equal(await dialog.count(), 0);

    await page.goto(therapy(346));
    await restoreOrientation.waitFor();
    assert.equal(await dialog.count(), 0);
    await page.goto(base + 'therapien_suche.html');
    await link.click();
    await page.waitForURL(resultUrl.href);
    await restoreOrientation.waitFor();
    assert.equal(await page.locator('[data-therapy-welcome] [role="listbox"]').count(), 0);
    await restoreOrientation.click();
    await page.getByRole('heading', {name: 'Orientierung fortsetzen'}).waitFor();
    assert.equal((await guideState(resultId)).mode, 'alternatives');

    await page.goto(therapy(346));
    await current.getByText('Therapiealternativen', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: linked therapies inherit orientation, and opting out and restoring work across detail pages`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1440, 390]) await testNavigation(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
