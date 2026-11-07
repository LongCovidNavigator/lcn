const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ hasTouch: true, viewport: { width: 390, height: 650 } });
    await page.route('http://lcn.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/styles/') || path === '/scripts/online_access.js') {
        return route.fulfill({ path: '.' + path });
      }
      if (path.startsWith('/api/')) return route.fulfill({ json: { ok: true, doctors: {} } });
      return route.fulfill({ contentType: 'text/html', body: `
        <link rel="stylesheet" href="styles/arzt_detail_konzept.css">
        <link rel="stylesheet" href="styles/detail_layout_shared.css">
        <link rel="stylesheet" href="styles/therapien_karte.css">
        <script src="scripts/online_access.js" defer></script>
        <body class="compact-doctor-header">
          <span id="badge" data-lcn-tooltip="Appointment help" tabindex="0">Online</span>
          <span class="treatment-nav-info" data-tooltip="Filter help" tabindex="0">i</span>
          <span class="ux-heading-info">
            <button aria-describedby="heading-help">i</button>
            <p id="heading-help" role="tooltip">Heading help</p>
          </span>
          <span class="adaptation-heading-help">
            <button class="heading-help-trigger" aria-describedby="adaptation-help">Adaptation</button>
            <span id="adaptation-help" class="heading-help-info" role="tooltip">Adaptation help</span>
          </span>
          <button id="sort" data-lcn-tooltip="Sort help" onclick="this.dataset.sorted='yes'">Sort</button>
          <div id="outside">Outside</div>
        </body>` });
    });
    await page.goto('http://lcn.test/');
    const box = page.locator('#lcn-shared-tooltip');
    const badge = page.locator('#badge');
    const filter = page.locator('.treatment-nav-info');
    const heading = page.locator('.ux-heading-info > button');
    const adaptation = page.locator('.heading-help-trigger');
    async function expectBox(text) {
      assert.equal(await box.isVisible(), true);
      assert.equal(await box.textContent(), text);
      const bounds = await box.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width);
    }

    for (const width of [390, 900]) {
      await page.setViewportSize({ width, height: 650 });
      for (const [trigger, text] of [
        [badge, 'Appointment help'], [filter, 'Filter help'],
        [heading, 'Heading help'], [adaptation, 'Adaptation help']
      ]) {
        await trigger.tap();
        await expectBox(text);
        assert.equal(await page.locator('#heading-help').isVisible(), false);
        assert.equal(await page.locator('#adaptation-help').isVisible(), false);
        assert.equal(await filter.evaluate(node => getComputedStyle(node, '::before').display), 'none');
        await trigger.tap();
        assert.equal(await box.isVisible(), false);
      }
      await badge.tap();
      await filter.tap();
      await expectBox('Filter help');
      await page.locator('#outside').tap();
      assert.equal(await box.isVisible(), false);

      await badge.tap();
      await page.locator('#sort').tap();
      assert.equal(await page.locator('#sort').getAttribute('data-sorted'), 'yes');
      assert.equal(await box.isVisible(), false);

      await badge.tap();
      await badge.hover({ position: { x: 2, y: 2 } });
      await expectBox('Appointment help');
      await page.mouse.move(1, 350);
      assert.equal(await box.isVisible(), false);

      await filter.hover();
      assert.notEqual(await filter.evaluate(node => getComputedStyle(node, '::before').display), 'none');
      await heading.hover();
      await page.locator('#heading-help').waitFor();
      assert.equal(await box.isVisible(), false);
    }
    console.log('PASS touch toggle, mouse hover, input switching, viewport bounds and action buttons');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

