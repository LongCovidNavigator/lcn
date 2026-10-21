const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const key = 'ag:56:t:84';
  let activeVote = false;
  async function open(id) {
    const feedback = page.waitForResponse(r => r.url().includes('api/catalog_relation_feedback.php') && r.request().method() === 'GET');
    await page.goto(`http://localhost/lcn/therapie_detail.php?treatment_id=${id}#alternativen`, { waitUntil: 'domcontentloaded' });
    await page.locator('#alternativen').waitFor({ state: 'visible' });
    assert.equal((await (await feedback).json()).ok, true);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-treatment-relation-feedback]')].every(n => n.querySelectorAll('button').length === 2));
  }
  const control = () => page.locator(`[data-treatment-relation-feedback="${key}"]`);
  async function vote(stance) {
    const response = page.waitForResponse(r => r.url().includes('api/catalog_relation_feedback.php') && r.request().method() === 'POST');
    await control().locator(`[data-stance="${stance}"]`).click();
    const data = await (await response).json();
    assert.equal(data.ok, true, data.error);
    const own = data.feedback[key]?.own || 0;
    activeVote = own !== 0;
    await page.waitForFunction(({ key, own }) => [1, -1].every(stance => document.querySelector(`[data-treatment-relation-feedback="${key}"] [data-stance="${stance}"]`)?.getAttribute('aria-pressed') === String(own === stance)), { key, own });
    return data;
  }
  try {
    await open(169);
    const initial = await control().locator('[data-stance="1"]').innerText();
    const first = await vote(1);
    assert.equal(first.feedback[key].own, 1);
    await open(84); // The inverse group link must use the same stored vote.
    await page.waitForFunction(key => document.querySelector(`[data-treatment-relation-feedback="${key}"] [data-stance="1"]`)?.getAttribute('aria-pressed') === 'true', key);
    const opposed = await vote(-1);
    assert.equal(opposed.feedback[key].own, -1);
    const response = page.waitForResponse(r => r.url().includes('api/catalog_relation_feedback.php') && r.request().method() === 'POST');
    await control().locator('[data-stance="-1"]').click();
    const removed = await (await response).json();
    assert.equal(removed.ok, true, removed.error);
    activeVote = false;
    assert.equal(removed.feedback[key]?.own || 0, 0);
    await open(169);
    assert.equal(await control().locator('[data-stance="1"]').getAttribute('aria-pressed'), 'false');
    assert.equal(await control().locator('[data-stance="1"]').innerText(), initial);
    for (const id of [5, 84, 693, 447, 271, 515, 65, 869, 23, 94, 451, 78]) {
      await open(id);
      const entries = page.locator('.ux-relation-entry');
      assert.equal(await entries.count(), await entries.locator('[data-treatment-relation-feedback]').count(), `Missing entry controls on ${id}`);
      assert.equal(await page.locator('#alternativen a button').count(), 0, 'Buttons must not be nested inside navigation links.');
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow on ${id}/${width}`);
      }
    }
    await open(84);
    const output = path.join(os.tmpdir(), 'lcn-discovery-feedback.png');
    await page.screenshot({ path: output, fullPage: true });
    console.log(output);
    for (const forged of ['ag:56:t:693', 'cp:23:25', 'bn:84:691']) {
      const result = await context.request.post('http://localhost/lcn/api/catalog_relation_feedback.php', { headers: { Origin: 'http://localhost' }, data: { key: forged, stance: 1 } });
      assert.equal(result.status(), 400, `Forged relation accepted: ${forged}`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: actual persisted confirmation, inverse page/reload, opposition, withdrawal/cleanup, all relation field controls, 24 responsive checks, forged requests rejected, no JS errors.');
  } finally {
    if (activeVote) await context.request.post('http://localhost/lcn/api/catalog_relation_feedback.php', { headers: { Origin: 'http://localhost' }, data: { key, stance: 0 } });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
