const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('lcn_therapy_guide_disabled', '1'));
    await page.route('**/*', route => new URL(route.request().url()).hostname === 'localhost'
      ? route.continue()
      : route.abort());

    for (const width of [1536, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://localhost/lcn/therapie_detail.php?treatment_id=3#alternativen');
      const diagram = page.locator('[data-relationship-stages]');
      await diagram.locator('svg path.is-right:not(.is-add)').first().waitFor({ state: 'attached' });
      await diagram.locator('.ux-stage-canvas').evaluate(canvas => { canvas.scrollLeft = canvas.scrollWidth; });

      const layout = await page.waitForFunction(() => {
        const section = document.querySelector('[data-relationship-stages]');
        const box = selector => section.querySelector(selector).getBoundingClientRect();
        const center = rect => rect.top + rect.height / 2;
        const ingredient = box('[data-stage="1"] [data-stage-node="454"]');
        const addAction = box('[data-stage="1"] .ux-stage-add');
        const column = box('[data-stage="1"]');
        const brands = [3, 696].map(id => box(`[data-stage="2"] [data-stage-node="${id}"]`));
        const path = section.querySelector('svg path.is-right:not(.is-add)');
        const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
        // The diagram redraws on the next frame when the feedback controls change its layout.
        if (Math.abs(start.y - center(ingredient)) >= 1 || Math.abs(start.x - ingredient.right) >= 1) return false;
        return {
          parent: center(ingredient),
          midpoint: (center(brands[0]) + center(brands[1])) / 2,
          spacing: addAction.top - ingredient.bottom,
          clearance: column.bottom - addAction.bottom,
          diagramRight: section.getBoundingClientRect().right,
          viewportRight: innerWidth,
        };
      }, null, { timeout: 5000 });
      const geometry = await layout.jsonValue();
      await layout.dispose();
      assert.ok(Math.abs(geometry.parent - geometry.midpoint) < 1, `${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.spacing > 0 && geometry.clearance > 0, `${width}px: add action leaves its row`);
      assert.ok(geometry.diagramRight <= geometry.viewportRight, `${width}px: diagram overflows viewport`);
      console.log(`PASS ${width}px: centered connector and add action inside the ingredient column`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
