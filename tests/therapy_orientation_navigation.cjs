const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const base = 'http://localhost/lcn/';
const therapy = id => `${base}therapie_detail.php?treatment_id=${id}#alternativen`;

async function checkEmptyReading(page, guideState) {
  const id = 869;
  await page.route('**/api/treatment_answer.php?*', route => route.fulfill({json: {
    ok: true,
    counts: {effect: [], gamechanger: [], setting: [], pem: [], access: []},
    symptom_help: {symptoms: [], catalog: []}
  }}));
  await page.evaluate(id => {
    localStorage.setItem('lcn_dummy_data_enabled', '0');
    sessionStorage.setItem('lcn_therapy_guide:' + id, JSON.stringify({mode: 'alternatives'}));
  }, id);
  await page.goto(`${base}therapie_detail.php?treatment_id=${id}&demo=0#ueberblick`);

  const welcome = page.locator('[data-therapy-welcome]');
  const wheel = welcome.getByRole('listbox');
  const continueReading = welcome.getByRole('button', {name: 'Erfahrungen ansehen →', exact: true});
  const emptyState = page.getByRole('dialog', {name: 'Noch keine Erfahrungsberichte'});
  async function requestReading() {
    await wheel.press('End');
    await wheel.press('ArrowUp');
    await wheel.press('Enter');
    await continueReading.click();
    await emptyState.waitFor();
  }

  await requestReading();
  await page.keyboard.press('Escape');
  assert.equal(await emptyState.isVisible(), true);
  assert.equal((await guideState(id)).mode, 'alternatives');
  await emptyState.getByRole('button', {name: 'Zurück zum vorherigen Orientierungsmodus'}).click();
  await emptyState.waitFor({state: 'hidden'});
  assert.equal((await guideState(id)).mode, 'alternatives');

  await requestReading();
  await emptyState.getByRole('button', {name: 'Trotzdem wechseln', exact: true}).click();
  await emptyState.waitFor({state: 'hidden'});
  assert.equal((await guideState(id)).mode, 'explore');
  await page.reload();
  const reading = welcome.getByRole('option', {name: 'Erfahrungen der Community ansehen', selected: true});
  await reading.getByText('(Noch keine Angabe vorhanden)', {exact: true}).waitFor();
  assert.ok(await reading.evaluate(option => {
    const row = option.getBoundingClientRect();
    const label = option.querySelector('.therapy-wheel-label').getBoundingClientRect();
    return label.top >= row.top && label.bottom <= row.bottom;
  }));
  assert.equal(await continueReading.isVisible(), false);
  await wheel.press('Enter');
  await continueReading.click();

  for (const [view, expectedCharts] of [['wirkung', 2], ['termin', 2], ['zugang', 3]]) {
    const panel = page.locator('#' + view);
    await panel.locator('.therapy-guide-note').waitFor();
    const charts = panel.locator('.ux-chart');
    assert.equal(await charts.count(), expectedCharts);
    for (const chart of await charts.all()) assert.equal(await chart.isVisible(), true);
    for (const note of await panel.locator('[data-community-note]').allTextContents()) {
      assert.match(note, /Noch keine\s+Community-Angaben/);
    }
    await panel.locator('.therapy-guide-next').click();
  }
  await page.locator('#symptome .ux-symptom-help').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

async function testOverviewWheel(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(10000);
  try {
    const overview = `${base}therapie_detail.php?treatment_id=869#ueberblick`;
    await page.goto(`${base}therapie_detail.php?treatment_id=869&anliegen=erfahrung#ueberblick`);
    const welcome = page.locator('[data-therapy-welcome]');
    const wheel = welcome.getByRole('listbox');
    const selected = name => welcome.getByRole('option', {name, selected: true});
    const reviewButton = welcome.getByRole('button', {name: 'Erfahrung teilen →', exact: true});

    await welcome.getByRole('heading', {name: 'Was führt dich hierher?'}).waitFor();
    await selected('Meine Erfahrung teilen').waitFor();
    assert.equal(await reviewButton.isVisible(), false);
    await wheel.press('Enter');
    await reviewButton.click();
    await page.locator('#wirkung .therapy-guide-note').waitFor();

    await page.locator('.side-nav [data-view="ueberblick"]').click();
    await selected('Meine Erfahrung teilen').waitFor();
    await page.goto(overview);
    await selected('Meine Erfahrung teilen').waitFor();
    await wheel.press('ArrowDown');
    await selected('Behandler:innen finden (Karte)').waitFor();

    for (const [mode, name] of [
      ['providers', 'Behandler:innen finden (Karte)'],
      ['symptoms', 'Bei welchem Symptom berichtet die Community von einer Linderung?']
    ]) {
      await page.evaluate(mode => sessionStorage.setItem('lcn_therapy_guide:869', JSON.stringify({mode})), mode);
      await page.reload();
      await selected(name).waitFor();
      assert.equal(await welcome.getByRole('heading', {name: 'Orientierung fortsetzen'}).count(), 0);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`PASS ${width}px: overview wheel restores contribution, provider and symptom choices`);
  } finally {
    await page.close();
  }
}

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
    await dialog.getByRole('listbox').press('Escape');
    await restoreOrientation.click();
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
    const welcome = page.locator('[data-therapy-welcome]');
    const alternatives = welcome.getByRole('option', {name: 'Therapiealternativen', selected: true});
    await alternatives.waitFor();
    assert.equal(await dialog.count(), 0);

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
    await alternatives.waitFor();
    assert.equal((await guideState(resultId)).mode, 'alternatives');

    await page.goto(therapy(346));
    await current.getByText('Therapiealternativen', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await checkEmptyReading(page, guideState);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: orientation navigation, explicit mode changes and visible charts with no answers`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1440, 390]) {
      await testOverviewWheel(browser, width);
      await testNavigation(browser, width);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
