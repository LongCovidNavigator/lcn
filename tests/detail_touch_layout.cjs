const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const profiles = [
  ['doctor', 627, 'arzt_detail.html?id=627', ['wirkung', 'termin', 'zugang', 'therapien', 'anreise', 'symptome']],
  ['therapy', 23, 'therapie_detail.php?treatment_id=23', ['wirkung', 'termin', 'zugang', 'symptome', 'anreise', 'alternativen']]
];

async function checkDetail(browser, [width, height], [kind, id, url, views]) {
  const page = await browser.newPage({
    viewport: {width, height}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'
  });
  page.setDefaultTimeout(12000);
  try {
    await page.addInitScript(({kind, id}) => {
      sessionStorage.setItem('lcn_' + kind + '_guide:' + id, JSON.stringify({mode: 'explore'}));
    }, {kind, id});
    await page.route('**/*', route => new URL(route.request().url()).hostname === 'localhost'
      ? route.continue() : route.abort());
    await page.goto('http://localhost/lcn/' + url + '#wirkung', {waitUntil: 'domcontentloaded'});
    await page.locator('#wirkung .therapy-guide-note').waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.lcnSiteRole);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      const guide = document.querySelector('#wirkung .therapy-guide-note').getBoundingClientRect();
      const header = document.getElementById('header-placeholder').getBoundingClientRect();
      return guide.top >= header.bottom - 1;
    });

    const profileTitleFits = await page.locator('#header-placeholder .profile').evaluate(profile => {
      const text = document.createRange();
      text.selectNodeContents(profile.querySelector('h1'));
      const controls = profile.querySelectorAll('.detail-brand-group, .lcn-role-toggle, .contact, .detail-menu-toggle');
      return [...text.getClientRects()].every(line => [...controls].every(control => {
        const box = control.getBoundingClientRect();
        const overlapX = Math.min(line.right, box.right) - Math.max(line.left, box.left);
        const overlapY = Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top);
        return overlapX < 1 || overlapY < 1;
      }));
    });
    assert.equal(profileTitleFits, true, kind + ' header at ' + width);

    for (const view of views) {
      const guide = page.locator('#' + view + ' .therapy-guide-note');
      await guide.waitFor();
      await page.waitForFunction(view => {
        const active = document.querySelector('.side-nav [aria-current="page"]');
        if (active?.dataset.view !== view) return false;
        const rail = active.closest('.nav-items').getBoundingClientRect();
        const tab = active.getBoundingClientRect();
        return innerWidth <= 1100
          ? tab.left >= rail.left - 1 && tab.right <= rail.right + 1
          : tab.top >= rail.top - 1 && tab.bottom <= rail.bottom + 1;
      }, view);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, kind + ' ' + view);

      const pair = guide.locator('.therapy-guide-navigation-pair');
      if (width <= 750) {
        assert.equal(await pair.locator('.therapy-guide-navigation-divider').isVisible(), false);
        const buttons = await pair.locator('button').evaluateAll(items => items.map(item => {
          const box = item.getBoundingClientRect();
          return [box.top, box.height];
        }));
        assert.equal(buttons.length, 2);
        assert.ok(Math.abs(buttons[0][0] - buttons[1][0]) < 1, kind + ' ' + view + ' actions belong in one row');
        assert.ok(buttons.every(([, buttonHeight]) => buttonHeight >= 44), kind + ' ' + view + ' touch targets');
      }
      if (view !== views.at(-1)) await pair.locator('.therapy-guide-next').tap();
    }
    console.log('PASS', kind, width, 'heading, touch navigation and active tab');
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const size of [[320, 568], [390, 844], [768, 1024], [844, 390], [1024, 768], [1180, 820], [1366, 1024]]) {
      for (const profile of profiles) await checkDetail(browser, size, profile);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
