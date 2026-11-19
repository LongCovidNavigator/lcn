const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const {extname, resolve, sep} = require('node:path');
const {chromium} = require('playwright');

const base = 'http://localhost/lcn/';
const root = resolve(__dirname, '..');
const doctor = {
  dr_id: 627, dr_display_name: 'Testpraxis', dr_type: 'practice', loc_id: 627,
  loc_city: 'Berlin', loc_country: 'DE', loc_plz: '10117', loc_lat: 52.52, loc_lng: 13.405
};

async function routeFixture(page) {
  let selected = false;
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(base)) return route.abort();
    const file = new URL(url).pathname.slice('/lcn/'.length);
    if (file.startsWith('api/')) {
      let json = {ok: true, items: [], pending: [], linked: []};
      if (file === 'api/doctor_detail.php') {
        json = {ok: true, item: doctor, research: {locations: [doctor]}, treatments_grouped: {}};
      } else if (file === 'api/doctor_community.php') {
        json = {ok: true, community: {include_dummy: false, questions: {}}, own_answers: {}};
      } else if (file === 'api/geocode_location.php') {
        json = {ok: true, result: {lat: 52.45, lng: 13.33, formatted: 'Steglitz', city: 'Berlin'}};
      } else if (file === 'api/doctor_symptom_help.php') {
        if (route.request().method() === 'POST') selected = route.request().postDataJSON().action === 'answer';
        json = {ok: true, symptom_help: {catalog: [], symptoms: [{id: 3, name: 'Test-Symptom', count: selected ? 2 : 1, selected}]}};
      }
      return route.fulfill({json});
    }
    const path = resolve(root, file);
    if (!path.startsWith(root + sep) || !existsSync(path)) return route.fulfill({status: 404});
    const type = {'.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html'}[extname(path)];
    return route.fulfill({path, contentType: type});
  });
}

async function check(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  await routeFixture(page);
  const url = base + 'arzt_detail.html?id=627';
  const nav = page.locator('.side-nav');
  const go = view => nav.locator(`[data-view="${view}"]`).click();
  const active = view => nav.locator(`[data-view="${view}"][aria-current="page"]`).waitFor();
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  try {
    await page.goto(url);
    const welcome = page.locator('[data-doctor-welcome]');
    await welcome.getByRole('heading', {name: 'Was führt dich hierher?'}).waitFor();
    assert.deepEqual(await nav.locator('a:visible').evaluateAll(links => links.map(link => link.getAttribute('aria-label'))), [
      'Überblick', 'Erfahrungen aus der Community', 'Belastungseinschätzung',
      'Kosten und Verfügbarkeit', 'Symptome', 'Anreise'
    ]);
    assert.equal(await noOverflow(), true);
    assert.equal(await page.locator('#ueberblick .effect-chart').count(), 0);
    await welcome.getByRole('option', {name: 'Meine Erfahrung teilen', exact: true}).click();
    await welcome.getByRole('button', {name: 'Erfahrung teilen →', exact: true}).click();
    await active('wirkung');
    await page.locator('#wirkung .effect-chart').waitFor();
    assert.equal(await page.locator('[data-doctor-symptom-help]').count(), 0);
    await page.getByRole('button', {name: 'Weiter zu Belastungseinschätzung →'}).click();
    await active('termin');
    await page.locator('#termin .appointment-variant').waitFor();
    assert.equal(await page.locator('#doctor-detail-map').count(), 0);
    assert.equal(await nav.locator('[data-view="wirkung"].therapy-section-complete').count(), 1);

    await go('symptome');
    await active('symptome');
    const symptom = page.locator('#symptome [data-symptom-id="3"]:enabled');
    const completion = page.locator('#symptome .therapy-guide-progress');
    await symptom.click();
    await page.waitForFunction(() => document.querySelector('#symptome [data-symptom-id="3"]')?.getAttribute('aria-pressed') === 'true');
    assert.match(await completion.innerText(), /Angaben sind gespeichert/);
    await symptom.click();
    await page.waitForFunction(() => document.querySelector('#symptome [data-symptom-id="3"]')?.getAttribute('aria-pressed') === 'false');
    assert.match(await completion.innerText(), /0 von 1/);
    assert.equal(await completion.count(), 1);
    assert.equal(await noOverflow(), true);

    await page.getByRole('button', {name: 'Weiter zu Anreise →'}).click();
    await active('anreise');
    const map = page.locator('#anreise #doctor-detail-map');
    await map.locator('.leaflet-marker-icon').first().waitFor();
    await page.getByRole('button', {name: 'Zur Karte ↓'}).click();
    assert.equal(await map.evaluate(element => document.activeElement === element), true);
    await page.locator('#own-location').fill('Steglitz');
    await page.locator('#location-form button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#own-distance')?.textContent.includes('km'));
    assert.equal(await noOverflow(), true);
    await page.goBack();
    await active('symptome');
    await page.goForward();
    await active('anreise');
    await page.reload();
    await page.locator('#anreise .therapy-guide-note').waitFor();
    assert.equal(await page.locator('#own-location').inputValue(), 'Steglitz');
    await page.getByRole('button', {name: 'Ich brauche keine Orientierung', exact: true}).click();
    await go('ueberblick');
    await page.getByRole('button', {name: 'Orientierung zurückholen'}).click();
    await welcome.getByRole('heading', {name: 'Orientierung fortsetzen'}).waitFor();

    await page.evaluate(() => sessionStorage.removeItem('lcn_doctor_guide:627'));
    await page.goto(url + '#anreise');
    await page.reload();
    const dialog = page.getByRole('dialog', {name: 'Was möchtest du tun?'});
    const choices = dialog.getByRole('listbox');
    await choices.press('Home');
    await choices.press('ArrowDown');
    await choices.press('Enter');
    await dialog.getByRole('button', {name: 'Anreise ansehen →'}).click();
    await active('anreise');
    await map.locator('.leaflet-marker-icon').first().waitFor();
    assert.equal(await noOverflow(), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: guided navigation, symptom voting, travel map, back/forward and reload`);
  } catch (error) {
    console.error(await page.locator('#view-content').innerText(), errors);
    throw error;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [1440, 390]) await check(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
