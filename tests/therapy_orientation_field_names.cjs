const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../scripts/experience_guide.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles/experience_guide.css'), 'utf8');
const url = 'http://lcn.test/therapie_detail.php?treatment_id=1';

async function renderGuide(page, labels, current, populated, {mode = 'explore', rightKind = ''} = {}) {
  const columns = labels.map((label, index) => {
    const node = index === current
      ? '<div class="ux-stage-node" aria-current="page"><button data-stage-classification></button></div>'
      : populated.includes(index) ? `<div class="ux-stage-node" data-relationship-kind="${index === 2 ? rightKind : ''}"></div>` : '';
    return `<section class="ux-stage-column" aria-label="${label}">${node}</section>`;
  });
  await page.route(url, route => route.fulfill({contentType: 'text/html', body: `
    <!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <main data-treatment-id="1" id="view-content">
      <span data-therapy-welcome></span>
      <section id="anreise" class="nd-panel" hidden><script class="nd-map-data" type="application/json">[]</script></section>
      <section id="alternativen" class="nd-panel" aria-label="Alternativen und Ausgestaltung">
        <section data-relationship-stages><h3>Therapieansatz und Umsetzung</h3>${columns.join('')}</section>
      </section>
    </main>`}), {times: 1});
  await page.goto(url);
  await page.evaluate(mode => sessionStorage.setItem('lcn_therapy_guide:1', JSON.stringify({mode})), mode);
  await page.addStyleTag({content: styles});
  await page.addScriptTag({content: source});
  const classification = page.locator('.therapy-guide-classification');
  await classification.locator(':scope > summary').click();
  return classification;
}

async function checkText(paragraph, expected, underlines) {
  assert.match(await paragraph.innerText(), expected);
  assert.deepEqual(await paragraph.locator('u').evaluateAll(nodes => nodes.map(node => [
    node.textContent, getComputedStyle(node).textDecorationLine
  ])), underlines.map(label => [label, 'underline']));
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({viewport: {width, height: 900}});
      page.setDefaultTimeout(4000);
      try {
        const paragraphs = '.therapy-guide-classification > p';
        await renderGuide(page, ['Gruppen', 'Wirkstoffe und Substanzen (Kombination)', 'Anwendungsformen'], 1, []);
        await checkText(page.locator(paragraphs), /Leider ist im Feld links noch keine übergeordnete Gruppe hinterlegt\. Auch im Feld rechts unter Anwendungsformen sind noch keine Einträge hinterlegt\./, ['Gruppe', 'Anwendungsformen']);
        assert.equal(await page.locator(`${paragraphs} strong`).innerText(), 'Wirkstoffe und Substanzen (Kombination)');

        await renderGuide(page, ['Gruppen', 'Verfahren', 'Anwendung'], 0, [1]);
        await checkText(page.locator(paragraphs), /schau im mittleren Feld unter Verfahren nach\. Leider sind noch keine Einträge zur Anwendung im Feld ganz rechts hinterlegt\./, ['Verfahren', 'Anwendung']);

        await renderGuide(page, ['Gruppen', 'Verfahren', 'Anwendung'], 1, [2], {rightKind: 'has_detail'});
        await checkText(page.locator(paragraphs), /^Die Community ordnet diese Therapie bei Verfahren ein\. Im Feld rechts findest du konkrete Anwendungen\. Leider ist im Feld links noch keine übergeordnete Gruppe hinterlegt\.$/, ['Anwendungen', 'Gruppe']);
        assert.equal(await page.locator(`${paragraphs} strong`).innerText(), 'Verfahren');

        await renderGuide(page, ['Wirkstoffgruppen', 'Wirkstoffe', 'Handelsnamen'], 0, []);
        await checkText(page.locator(paragraphs), /im mittleren Feld unter Wirkstoffe hinterlegt\. Auch im Feld ganz rechts unter Handelsnamen/, ['Wirkstoffe', 'Handelsnamen']);

        await renderGuide(page, ['Wirkstoffgruppen', 'Wirkstoffe und Substanzen', 'Anwendungsformen'], 2, [0, 1]);
        await checkText(page.locator(paragraphs), /ganz links ins Feld Wirkstoffgruppen\. Den zugehörigen Wirkstoff bzw\. die Substanz findest du im mittleren Feld\./, ['Wirkstoffgruppen', 'Wirkstoff', 'Substanz']);

        await renderGuide(page, ['Übergeordnete Substanz', 'Anwendungsform', 'Weitere Anwendungsformen'], 1, [0, 2]);
        await checkText(page.locator(paragraphs), /links ins Feld Übergeordnete Substanz\. Im Feld rechts unter Weitere Anwendungsformen findest du/, ['Übergeordnete Substanz', 'Weitere Anwendungsformen']);

        const review = await renderGuide(page, ['Gruppen', 'Wirkstoffe', 'Handelsnamen'], 1, [0, 2], {mode: 'review'});
        const topic = review.locator('[data-guide-stage="1"]');
        await topic.locator('summary').click();
        await checkText(topic.locator('p').nth(1), /im Feld links unter Gruppen\..+im Feld rechts unter Handelsnamen\./, ['links', 'Gruppen', 'rechts', 'Handelsnamen']);

        const substanceReview = await renderGuide(page, ['Wirkstoffgruppen', 'Wirkstoffe und Substanzen', 'Anwendungsformen'], 1, [2], {mode: 'review', rightKind: 'has_form'});
        const substanceTopic = substanceReview.locator('[data-guide-stage="1"]');
        await substanceTopic.locator('summary').click();
        await checkText(substanceTopic.locator('p').nth(1), /^Im Feld rechts unter Anwendungsformen findest du Applikationen zu dieser Therapie\.$/, ['rechts', 'Anwendungsformen']);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log(`PASS ${width}px: therapy groups, combinations, substances and medications`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
