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
const treatments = {Diagnostik: [{treat_id: 42, behandlung: 'Testdiagnostik'}]};
const answerTotal = total => ({total, options: []});

async function routeFixture(page) {
  let selected = false;
  let ownAnswers = {};
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(base)) return route.abort();
    const file = new URL(url).pathname.slice('/lcn/'.length);
    if (file.startsWith('api/')) {
      let json = {ok: true, items: [], pending: [], linked: []};
      if (file === 'api/doctor_detail.php') {
        json = {ok: true, item: doctor, research: {locations: [doctor]}, treatments_grouped: treatments};
      } else if (['api/doctor_community.php', 'api/doctor_community_answer.php'].includes(file)) {
        if (route.request().method() === 'POST') {
          const {action, question, value} = route.request().postDataJSON();
          if (action === 'reset') ownAnswers = {};
          else if (action === 'clear') delete ownAnswers[question];
          else ownAnswers[question] = value;
          if (new URL(url).searchParams.get('response') === 'question') {
            const count = (ownAnswers[question] ? 1 : 0) + 3;
            return route.fulfill({json: {ok: true, own_answer: ownAnswers[question] ?? null,
              question: {total: count, options: [{count}, {count: 0}]}}});
          }
        }
        json = {ok: true, community: {include_dummy: false, questions: {
          effect: answerTotal(3), 'appointment-0-0': answerTotal(3), 'appointment-1-2': answerTotal(1),
          'costs-gkv': answerTotal(2), 'costs-at-public': answerTotal(4)
        }}, own_answers: ownAnswers, has_own_symptom_answers: selected};
      } else if (file === 'api/catalog_relation_feedback.php') {
        json = {ok: true, feedback: {}};
      } else if (file === 'api/geocode_location.php') {
        json = {ok: true, result: {lat: 52.45, lng: 13.33, formatted: 'Steglitz', city: 'Berlin'}};
      } else if (file === 'api/doctor_symptom_help.php') {
        if (route.request().method() === 'POST') selected = route.request().postDataJSON().action === 'answer';
        json = {ok: true, symptom_help: {catalog: [], symptoms: [
          {id: 3, name: 'Test-Symptom', count: selected ? 2 : 1, selected},
          {id: 4, name: 'Gesamtzustand', count: 0, selected: false, pinned: true}
        ]}};
      }
      return route.fulfill({json});
    }
    const path = resolve(root, file);
    if (!path.startsWith(root + sep) || !existsSync(path)) return route.fulfill({status: 404});
    const type = {'.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html'}[extname(path)];
    return route.fulfill({path, contentType: type});
  });
}

async function checkIndependentDesktopScroll(page) {
  const rail = page.locator('.side-nav .nav-items');
  const pageBottom = await page.evaluate(() => {
    const bottom = document.scrollingElement.scrollHeight - innerHeight;
    window.scrollTo(0, bottom);
    return bottom;
  });
  assert.ok(pageBottom > 0);
  await page.waitForFunction(() => {
    const first = document.querySelector('.nav-items [data-view="ueberblick"]');
    const header = document.getElementById('header-placeholder');
    return first.getBoundingClientRect().top >= header.getBoundingClientRect().bottom;
  });
  const box = await rail.boundingBox();
  const railPosition = await rail.evaluate(node => {
    node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2);
    return node.scrollTop;
  });
  assert.ok(railPosition > 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await rail.evaluate(node => node.scrollTop), railPosition);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('view-content')).overflowY), 'visible');

  await page.evaluate(bottom => window.scrollTo(0, bottom), pageBottom);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 2000);
  await page.waitForFunction(() => {
    const rail = document.querySelector('.nav-items');
    return rail.scrollTop > 0 && rail.scrollHeight - rail.clientHeight - rail.scrollTop < 1;
  });
  await page.mouse.wheel(0, -2000);
  await page.waitForFunction(() => document.querySelector('.nav-items').scrollTop === 0);
  await page.mouse.wheel(0, -2000);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => scrollY), pageBottom);
  await page.evaluate(() => window.scrollTo(0, 0));
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
  const checkmark = view => nav.locator(`[data-view="${view}"].therapy-section-complete`);
  const answer = (question, value = 0) => page.locator(`[data-choice="${question}"][data-value="${value}"]:visible`).first();
  async function checkTopicDisclosure(view, title) {
    const guide = page.locator(`#${view} .therapy-guide-note`);
    const summary = guide.locator('details > summary').filter({hasText: title});
    const details = summary.locator('..');
    await summary.waitFor();
    assert.equal(await guide.locator('details :is(a[href], button)').count(), 0);
    assert.equal(await guide.getByRole('button', {name: /^(Zum Bereich|Zur Karte) ↓$/, includeHidden: true}).count(), 0);
    const wasOpen = await details.evaluate(node => node.open);
    const url = page.url();
    await summary.click();
    assert.equal(await details.evaluate(node => node.open), !wasOpen);
    assert.equal(await summary.evaluate(node => node === document.activeElement), true);
    assert.equal(page.url(), url);
    assert.equal(await noOverflow(), true);
    await summary.press('Space');
    assert.equal(await details.evaluate(node => node.open), wasOpen);
  }
  async function toggleAnswer(question, pressed) {
    const option = answer(question);
    await option.click();
    await option.and(page.locator(`[aria-pressed="${pressed}"]:enabled:not([aria-disabled="true"])`)).waitFor();
  }

  try {
    await page.goto(url + '#ueberblick');
    const welcome = page.locator('[data-doctor-welcome]');
    await welcome.getByRole('heading', {name: 'Was führt dich hierher?'}).waitFor();
    await page.waitForFunction(() => {
      const overview = document.querySelector('#ueberblick .overview-structured');
      const header = document.getElementById('header-placeholder');
      return overview && overview.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1;
    });
    const overviewPrecedesWelcome = () => welcome.evaluate(node =>
      node.previousElementSibling?.matches('.overview-structured') &&
      node.previousElementSibling.getBoundingClientRect().bottom <= node.getBoundingClientRect().top
    );
    assert.equal(await overviewPrecedesWelcome(), true);
    assert.deepEqual(await nav.locator('a:visible').evaluateAll(links => links.map(link => link.getAttribute('aria-label'))), [
      'Überblick', 'Erfahrungen aus der Community', 'Belastungseinschätzung',
      'Kosten und Verfügbarkeit', 'Therapien', 'Anreise', 'Symptome'
    ]);
    assert.equal(await noOverflow(), true);
    assert.equal(await page.locator('#ueberblick .effect-chart').count(), 0);
    assert.equal(await page.locator('#treatment-section').count(), 0);
    assert.deepEqual(await welcome.getByRole('option').locator('strong').allTextContents(), [
      'Meine Erfahrung teilen', 'Anreise', 'Bei welchem Symptom berichtet die Community von einer Linderung?',
      'Erfahrungen der Community ansehen', 'Therapien dieser Praxis'
    ]);
    const overviewWheel = welcome.getByRole('listbox');
    await overviewWheel.press('ArrowDown');
    await welcome.getByRole('option', {name: 'Anreise', selected: true}).waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('lcn-exchange-rates')));
    assert.equal(await overviewWheel.evaluate(wheel => document.activeElement === wheel), true);
    assert.equal(await overviewPrecedesWelcome(), true);
    await page.keyboard.press('ArrowDown');
    await welcome.getByRole('option', {name: 'Bei welchem Symptom berichtet die Community von einer Linderung?', selected: true}).waitFor();
    await overviewWheel.press('Home');
    await welcome.getByRole('option', {name: 'Meine Erfahrung teilen', exact: true}).click();
    await welcome.getByRole('button', {name: 'Erfahrung teilen →', exact: true}).click();
    await active('wirkung');
    await page.locator('#wirkung .effect-chart').waitFor();
    if (width > 1100) await checkIndependentDesktopScroll(page);
    assert.equal(await page.locator('#treatment-section').count(), 0);
    assert.equal(await page.locator('[data-doctor-symptom-help]').count(), 0);
    assert.equal(await checkmark('wirkung').count(), 0);
    await toggleAnswer('effect', true);
    await page.getByRole('button', {name: 'Weiter zu Belastungseinschätzung →'}).click();
    await active('termin');
    await page.locator('#termin .appointment-variant').waitFor();
    assert.equal(await page.locator('#doctor-detail-map').count(), 0);
    assert.equal(await checkmark('wirkung').count(), 1);
    await checkTopicDisclosure('termin', 'Long-Covid-gerechter Termin');

    await toggleAnswer('adaptation', true);
    await toggleAnswer('appointment-0-0', true);
    assert.equal(await checkmark('termin').count(), 1);
    await page.getByRole('button', {name: 'Weiter zu Kosten und Verfügbarkeit →'}).click();
    await active('zugang');
    await toggleAnswer('wait', true);
    assert.equal(await checkmark('zugang').count(), 1);
    await toggleAnswer('wait', false);
    assert.equal(await checkmark('zugang').count(), 0);
    await page.getByRole('button', {name: '← Zurück zu Belastungseinschätzung'}).click();
    await toggleAnswer('adaptation', false);
    assert.equal(await checkmark('termin').count(), 1);
    await toggleAnswer('appointment-0-0', false);
    assert.equal(await checkmark('termin').count(), 0);
    assert.match(await page.locator('#termin .therapy-guide-progress').innerText(), /0 von 2/);
    await go('wirkung');
    await toggleAnswer('effect', false);
    assert.equal(await checkmark('wirkung').count(), 0);
    await page.getByRole('button', {name: 'Weiter zu Belastungseinschätzung →'}).click();
    await page.reload();
    await page.locator('#termin .therapy-guide-note').waitFor();
    assert.equal(await checkmark('wirkung').count(), 0);
    assert.equal(await checkmark('termin').count(), 0);

    await page.getByRole('button', {name: 'Weiter zu Kosten und Verfügbarkeit →'}).click();
    await page.getByRole('button', {name: 'Weiter zu Therapien →'}).click();
    await active('therapien');
    const offer = page.locator('#therapien #treatment-section');
    await offer.getByRole('link', {name: 'Testdiagnostik', exact: true}).waitFor();
    await checkTopicDisclosure('therapien', 'Therapien');
    const therapyGuide = page.locator('#therapien .therapy-guide-note');
    assert.equal(await therapyGuide.locator('details').count(), 1);
    assert.deepEqual(await therapyGuide.locator('.therapy-guide-annotation .therapy-guide-feedback-symbol').allTextContents(), ['✓', '×']);
    await offer.getByRole('searchbox', {name: 'Therapie suchen'}).fill('Kein Treffer');
    assert.match(await offer.getByRole('status').first().innerText(), /0 von 1/);
    await offer.getByRole('button', {name: 'Zurücksetzen'}).click();
    await offer.locator('.treatment-view-switch').getByRole('button', {name: 'Liste'}).click();
    await offer.locator('table:visible').getByRole('link', {name: 'Testdiagnostik', exact: true}).waitFor();
    await offer.locator('table:visible [data-relation-feedback]').waitFor();
    await offer.locator('.catalog-relation-add').waitFor();
    assert.equal(await noOverflow(), true);
    await page.reload();
    await active('therapien');
    await offer.locator('table:visible').getByRole('link', {name: 'Testdiagnostik', exact: true}).waitFor();

    await page.getByRole('button', {name: 'Weiter zu Anreise →'}).click();
    await active('anreise');
    const map = page.locator('#anreise #doctor-detail-map');
    await map.locator('.leaflet-marker-icon').first().waitFor();
    const travelGuide = page.locator('#anreise .therapy-guide-note');
    const travelInstruction = travelGuide.locator('details');
    assert.equal(await travelInstruction.count(), 1);
    assert.equal(await travelInstruction.locator('summary').innerText(), 'Anreiseaufwand');
    assert.deepEqual(await travelInstruction.locator('u').allTextContents(), [
      'Adresse, PLZ oder Ort', 'Standort übernehmen', 'Anreiseaufwand'
    ]);
    await page.locator('#own-location').fill('Steglitz');
    await page.locator('#location-form button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#own-distance')?.textContent.includes('km'));
    const travelHeading = page.locator('#anreise .travel-estimate-heading');
    assert.equal(await travelHeading.locator('strong').innerText(), 'Anreiseaufwand');
    assert.match(await travelHeading.locator('span').innerText(), / km Luftlinie$/);
    assert.equal(await page.locator('#anreise .travel-scale [aria-current=true] b').innerText(), 'Deine Entfernung');
    assert.equal(await noOverflow(), true);
    await page.goBack();
    await active('therapien');
    await page.goForward();
    await active('anreise');
    await page.reload();
    await page.locator('#anreise .therapy-guide-note').waitFor();
    assert.equal(await page.locator('#own-location').inputValue(), 'Steglitz');
    await page.getByRole('button', {name: 'Weiter zu Symptome →'}).click();
    await active('symptome');
    const symptom = page.locator('#symptome [data-symptom-id="3"]:enabled');
    const completion = page.locator('#symptome .therapy-guide-progress');
    await symptom.waitFor();
    await checkTopicDisclosure('symptome', 'Bei welchen Symptomen hat dir die behandelnde Person geholfen?');
    assert.equal(await page.locator('#symptome [data-symptom-id]').first().getAttribute('data-symptom-id'), '4');
    await symptom.click();
    await page.waitForFunction(() => document.querySelector('#symptome [data-symptom-id="3"]')?.getAttribute('aria-pressed') === 'true');
    assert.match(await completion.innerText(), /Angaben sind gespeichert/);
    assert.equal(await checkmark('symptome').count(), 1);
    await go('anreise');
    await page.reload();
    await checkmark('symptome').waitFor();
    await go('symptome');
    await symptom.click();
    await page.waitForFunction(() => document.querySelector('#symptome [data-symptom-id="3"]')?.getAttribute('aria-pressed') === 'false');
    assert.match(await completion.innerText(), /0 von 1/);
    await page.getByRole('button', {name: 'Ich bin fertig', exact: true}).click();
    await page.getByRole('button', {name: 'Hier bleiben', exact: true}).click();
    assert.equal(await checkmark('symptome').count(), 0);
    assert.equal(await noOverflow(), true);
    await page.getByRole('button', {name: '← Zurück zu Anreise'}).click();
    await active('anreise');
    await page.getByRole('button', {name: 'Ich brauche keine Orientierung', exact: true}).click();
    await go('ueberblick');
    await page.getByRole('button', {name: 'Orientierung zurückholen'}).click();
    await welcome.getByRole('option', {name: 'Meine Erfahrung teilen', selected: true}).waitFor();
    assert.equal(await welcome.getByRole('button', {name: 'Erfahrung teilen →', exact: true}).isVisible(), false);

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
    await page.locator('#anreise .therapy-guide-note summary').getByText('Karte', {exact: true}).click();
    assert.deepEqual(await page.locator('#anreise .therapy-guide-note details[open] u').allTextContents(), [
      'Adresse, PLZ oder Ort', 'Standort übernehmen'
    ]);

    await go('ueberblick');
    const wheel = welcome.getByRole('listbox');
    await wheel.press('End');
    await wheel.press('ArrowUp');
    await wheel.press('Enter');
    await welcome.getByRole('button', {name: 'Erfahrungen ansehen →'}).click();
    await active('wirkung');
    const assessment = page.locator('#wirkung .therapy-guide-note details');
    await assessment.getByText('(3 Angaben)', {exact: true}).waitFor();
    await assessment.locator('summary').press('Space');
    assert.deepEqual(await assessment.locator('li strong').allTextContents(), ['Verschlechterung:', 'Neutral:', 'Verbesserung:', 'Heilung:']);
    await page.reload();
    await assessment.and(page.locator('[open]')).waitFor();
    await page.locator('#wirkung .therapy-guide-sharing strong').getByText('Kennst du jemanden, der hier behandelt wurde?').waitFor();

    await go('termin');
    await page.locator('#termin .therapy-guide-note summary').getByText('(4 Einzelangaben)', {exact: true}).waitFor();
    await checkTopicDisclosure('termin', 'Terminform');
    await go('zugang');
    const costs = page.locator('#zugang .therapy-guide-note details').first();
    await costs.getByText('(2 Angaben)', {exact: true}).waitFor();
    await costs.locator('summary').press('Space');
    await page.locator('#zugang select[data-cost-country]').selectOption('AT');
    await costs.getByText('(4 Angaben)', {exact: true}).waitFor();
    await costs.getByText('Für Österreich stehen zur Auswahl:').waitFor();
    assert.match(await costs.innerText(), /Die Auswertung zeigt die selbst getragenen Kosten für das gewählte Land/);
    await page.locator('#zugang [data-choice="wait-followup"]').first().waitFor();

    await go('symptome');
    await page.locator('#symptome .therapy-guide-note summary').getByText('(bis zu 1 Angabe je Symptom)', {exact: true}).waitFor();
    await go('ueberblick');
    await wheel.press('End');
    await wheel.press('Enter');
    await welcome.getByRole('button', {name: 'Therapien ansehen →'}).click();
    await active('therapien');
    const assignments = page.locator('#therapien .therapy-guide-note details').last();
    assert.equal(await therapyGuide.locator('details').count(), 2);
    assert.equal(await therapyGuide.locator('.therapy-guide-annotation').count(), 0);
    await assignments.locator('summary').getByText('Zuordnungen prüfen und ergänzen').click();
    assert.deepEqual(await assignments.locator('p strong').allTextContents(), ['Zustimmen (✓)', 'Widersprechen (×)']);
    await page.getByRole('button', {name: 'Ich bin hier fertig', exact: true}).click();
    const finish = page.getByRole('dialog', {name: 'Danke, dass du dich umgesehen hast!'});
    await finish.getByRole('button', {name: 'Hier bleiben', exact: true}).click();
    assert.equal(await noOverflow(), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: guided navigation, symptom voting, therapy tab, travel map, back/forward and reload`);
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
