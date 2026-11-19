const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const scripts = ['therapy_alternatives_reading.js', 'therapy_alternatives_contribution.js', 'experience_guide.js']
  .map(name => fs.readFileSync(path.join(__dirname, '../scripts', name), 'utf8'));
const styles = fs.readFileSync(path.join(__dirname, '../styles/experience_guide.css'), 'utf8');
const url = 'http://lcn.test/therapie_detail.php?treatment_id=1';
const addLabel = 'Weiteren Eintrag hinzufügen';

async function renderGuide(page, labels, current, populated, {
  mode = 'explore', rightKind = '', addTo = [], combination = false, rightBlocks = [], groupHint = false
} = {}) {
  const currentNode = '<div class="ux-stage-node" aria-current="page"><button data-stage-classification data-classification-category="Therapie"></button></div>';
  const addButton = `<button data-treatment-relation-add>${addLabel}</button>`;
  const linkedNode = kind => `<div class="ux-stage-node" data-relationship-kind="${kind}"><a class="ux-stage-name" href="?treatment_id=2#alternativen">Beispiel</a><span data-treatment-relation-feedback></span></div>`;
  const columns = labels.map((label, index) => {
    const additions = addTo.includes(index) ? addButton : '';
    if (index === 2 && rightBlocks.length) {
      const blocks = rightBlocks.map(block => `<div class="ux-stage-block" data-relationship-label="${block.label}" data-relationship-kind="${block.kind}">
        ${block.current ? currentNode : linkedNode(block.kind)}${additions}</div>`);
      return `<section class="ux-stage-column" aria-label="${label}">${blocks.join('')}</section>`;
    }
    const node = index === current ? currentNode : populated.includes(index) ? linkedNode(index === 2 ? rightKind : '') : '';
    const hint = index === 0 && groupHint ? '<div class="ux-stage-add-hint">Wähle eine Substanz im mittleren Feld aus.</div>' : '';
    return `<section class="ux-stage-column" aria-label="${label}">${node}${additions}${hint}</section>`;
  });
  await page.route(url, route => route.fulfill({contentType: 'text/html', body: `
    <!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <main data-treatment-id="1" id="view-content">
      <span data-therapy-welcome></span>
      <section id="anreise" class="nd-panel" hidden><script class="nd-map-data" type="application/json">[]</script></section>
      <section id="alternativen" class="nd-panel" aria-label="Alternativen und Ausgestaltung">
        <section class="ux-alternative-section"><h3>Alternative Therapien</h3></section>
        <section data-relationship-stages data-add-entry-label="${addLabel}"><h3>Therapieansatz und Umsetzung</h3>${columns.join('')}</section>
        <section data-combination-section data-is-combination="${combination ? '1' : '0'}">
          <h3>Kombinationstherapien</h3>
          ${combination ? '<div data-combination-tree><div data-combination-parent class="is-current"></div><div data-combination-part></div></div>' : ''}
        </section>
      </section>
    </main>`}), {times: 1});
  await page.goto(url);
  await page.evaluate(mode => sessionStorage.setItem('lcn_therapy_guide:1', JSON.stringify({mode})), mode);
  await page.addStyleTag({content: styles});
  for (const content of scripts) await page.addScriptTag({content});
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

async function checkModeCopy(page, mode) {
  const classification = await renderGuide(page, ['Gruppe', 'Verfahren', 'Anwendung'], 0, [1], {mode, addTo: [1]});
  const guide = page.locator('.therapy-guide-note');
  const topics = guide.locator('.experience-guide-copy > details');
  assert.equal(await topics.count(), 3);
  for (const topic of [topics.first(), topics.last()]) await topic.locator(':scope > summary').click();

  const text = await guide.innerText();
  if (mode === 'review') {
    const current = classification.locator('[data-guide-stage="0"]');
    await current.locator('summary').click();
    assert.equal(await current.locator('p').first().locator('strong').first().innerText(), 'Gruppe');
    assert.match(await current.locator('p').first().innerText(), /Eine Gruppe fasst verwandte Behandlungsverfahren unter einem Oberbegriff zusammen und gibt dir eine erste Orientierung\./);
    await checkText(current.locator('p').nth(1), /^Die Verfahren, die die Community dieser Gruppe zuordnet, findest du im mittleren Feld\.$/, ['Verfahren', 'mittleren']);
    const procedures = classification.locator('[data-guide-stage="1"]');
    await procedures.locator('summary').click();
    assert.equal(await procedures.locator('p').innerText(), 'Ein Verfahren beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie. Mit „Weiteren Eintrag hinzufügen“ kannst du Ergänzungen vorschlagen. Bei vorhandenen Einträgen kannst du Zustimmen (✓) oder Widersprechen (×) wählen.');
    assert.match(text, /Prüfe die vorhandenen Alternativen/);
    assert.match(text, /Ergänze frei, was du für eine Alternative hältst/);
    assert.match(text, /Welche Behandlungen ergeben zusammen mehr/);
    assert.equal(await topics.locator('h4').count(), 2);
    assert.equal(await guide.locator('.therapy-guide-annotation, .therapy-guide-sharing').count(), 0);
    assert.doesNotMatch(text, /Du bist unsicher|Hier sammelt die Community frei vorgeschlagene/);
  } else {
    assert.match(text, /Du bist unsicher/);
    assert.match(text, /Hier sammelt die Community frei vorgeschlagene/);
    assert.match(text, /Hier sammelt die Community Kombinationen/);
    assert.equal(await guide.locator('.therapy-guide-annotation').count(), 1);
    assert.equal(await guide.locator('.therapy-guide-sharing').count(), 1);
    assert.equal(await topics.locator('h4, [data-guide-stage]').count(), 0);
    assert.doesNotMatch(text, /Prüfe die vorhandenen Alternativen|Ergänze frei|Welche Behandlungen ergeben zusammen mehr/);
  }

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  return topics.first().evaluate(topic => {
    const style = getComputedStyle(topic);
    return {background: style.backgroundColor, radius: style.borderRadius, border: style.border};
  });
}

async function openStage(classification, stage) {
  const topic = classification.locator(`[data-guide-stage="${stage}"]`);
  await topic.locator(':scope > summary').click();
  return topic.locator('p');
}

async function checkContributionCases(page) {
  const therapy = ['Gruppe', 'Verfahren', 'Anwendung'];
  const substances = ['Gruppe', 'Wirkstoffe und Substanzen', 'Anwendungsformen'];
  const mode = 'review';
  const combinationText = 'Unter Kombinationstherapien findest du die einzelnen Bestandteile dieser Therapie.';

  let guide = await renderGuide(page, therapy, 0, [1, 2], {mode});
  let text = await openStage(guide, 0);
  await checkText(text.nth(1), /^Die Verfahren, die die Community dieser Gruppe zuordnet, findest du im mittleren Feld\. Die dazugehörigen Anwendungen findest du im rechten Feld\.$/,
    ['Verfahren', 'mittleren', 'Anwendungen', 'rechten']);

  guide = await renderGuide(page, therapy, 1, [0, 2], {mode, combination: true});
  text = await openStage(guide, 1);
  assert.match(await text.first().innerText(), /^Die Community ordnet diese Therapie bei Verfahren ein\. Ein Verfahren beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie\./);
  await checkText(text.nth(1), /^Die zugehörige Gruppe findest du im linken Feld\. Die dazugehörigen Anwendungen findest du im rechten Feld\.$/,
    ['Gruppe', 'linken', 'Anwendungen', 'rechten']);
  assert.equal(await text.nth(2).innerText(), combinationText);

  guide = await renderGuide(page, therapy, 2, [0, 1], {mode});
  text = await openStage(guide, 2);
  assert.match(await text.first().innerText(), /^Die Community ordnet diese Therapie bei Anwendung ein\. Eine Anwendung beschreibt, wie die Therapie konkret durchgeführt werden könnte\./);
  await checkText(text.nth(1), /^Das zugehörige Verfahren findest du im mittleren Feld\. Die Gruppe, der dieses Verfahren zugeordnet ist, findest du im linken Feld\.$/,
    ['Verfahren', 'mittleren', 'Gruppe', 'linken']);

  guide = await renderGuide(page, substances, 0, [1, 2], {mode});
  text = await openStage(guide, 0);
  assert.match(await text.first().innerText(), /Eine Gruppe fasst verwandte Wirkstoffe oder Substanzen unter einem Oberbegriff zusammen/);
  await checkText(text.nth(1), /^Die Wirkstoffe und Substanzen, die die Community dieser Gruppe zuordnet, findest du im mittleren Feld\. Die dazugehörigen Anwendungsformen findest du im rechten Feld\.$/,
    ['Wirkstoffe und Substanzen', 'mittleren', 'Anwendungsformen', 'rechten']);

  const blocks = [
    {label: 'Handelsnamen', kind: 'has_trade', definition: 'Ein Handelsname ist der Produktname eines Präparats, das den übergeordneten Wirkstoff bzw. die Substanz enthält.'},
    {label: 'Applikation', kind: 'has_form', definition: 'Eine Applikation beschreibt, auf welchem Weg ein Wirkstoff bzw. eine Substanz verabreicht wird, etwa oral oder als Infusion.'},
    {label: 'Stoffvarianten', kind: 'has_variant', definition: 'Eine Stoffvariante kann eine andere Form eines Wirkstoffs sowie Extrakte oder Präparate beschreiben, die den übergeordneten Wirkstoff bzw. die Substanz enthalten.'}
  ];
  guide = await renderGuide(page, ['Gruppe', 'Wirkstoffe und Substanzen (Kombination)', 'Anwendungsformen'], 1, [0],
    {mode, combination: true, rightBlocks: blocks, addTo: [2]});
  text = await openStage(guide, 1);
  assert.match(await text.first().innerText(), /^Die Community ordnet diese Therapie bei Wirkstoffe und Substanzen ein\. Ein Wirkstoff bzw\. eine Substanz beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie\./);
  await checkText(text.nth(1), /^Die zugehörige Gruppe findest du im linken Feld\. Die dazugehörigen Anwendungsformen findest du im rechten Feld\.$/,
    ['Gruppe', 'linken', 'Anwendungsformen', 'rechten']);
  assert.equal(await text.nth(2).innerText(), combinationText);
  const application = await openStage(guide, 2);
  assert.deepEqual(await application.allTextContents(), blocks.map(block => block.definition
    + ' Mit „Weiteren Eintrag hinzufügen“ kannst du Ergänzungen vorschlagen. Bei vorhandenen Einträgen kannst du Zustimmen (✓) oder Widersprechen (×) wählen.'));
  const bullets = guide.locator('ul.therapy-guide-application-list > li');
  assert.equal(await bullets.count(), 3);
  const bulletLayout = await bullets.evaluateAll(items => items.map(item => {
    const style = getComputedStyle(item);
    const term = item.querySelector('p > strong');
    return {
      term: term.textContent,
      bold: Number(getComputedStyle(term).fontWeight) >= 700,
      bullet: style.display === 'list-item' && style.listStyleType === 'disc',
      indented: item.getBoundingClientRect().left > item.parentElement.getBoundingClientRect().left
    };
  }));
  assert.deepEqual(bulletLayout, ['Handelsname', 'Applikation', 'Stoffvariante'].map(term =>
    ({term, bold: true, bullet: true, indented: true})));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  for (const block of blocks) {
    guide = await renderGuide(page, substances, 2, [0, 1], {mode, rightBlocks: [{...block, current: true}]});
    text = await openStage(guide, 2);
    assert.ok((await text.first().innerText()).startsWith(`Die Community ordnet diese Therapie bei ${block.label} im Feld Anwendungsformen ein. ${block.definition}`));
    const references = await text.nth(1).innerText();
    assert.match(references, /Die zugehörige Gruppe findest du im linken Feld\./);
    assert.match(references, /findest du im mittleren Feld\./);
  }
}

async function checkEmptyContributionFields(page) {
  const mode = 'review';
  const substances = ['Gruppe', 'Wirkstoffe und Substanzen', 'Anwendungsformen'];
  const groupDefinition = 'Eine Gruppe fasst verwandte Wirkstoffe oder Substanzen unter einem Oberbegriff zusammen und gibt dir eine erste Orientierung.';
  const guide = await renderGuide(page, substances, 2, [1],
    {mode, groupHint: true, rightBlocks: [{label: 'Applikation', kind: 'has_form', current: true}]});
  assert.deepEqual(await guide.locator('[data-guide-stage] > summary').allTextContents(),
    ['Gruppe', 'Wirkstoffe und Substanzen', 'Anwendungsformen (hier eingeordnet)']);
  const group = await openStage(guide, 0);
  assert.equal(await group.innerText(), groupDefinition
    + ' Um eine Gruppe zuzuordnen, öffne den zugehörigen Eintrag im mittleren Feld unter Wirkstoffe und Substanzen.');
  assert.deepEqual(await group.locator('u').allTextContents(), ['mittleren', 'Wirkstoffe und Substanzen']);
  assert.doesNotMatch(await group.innerText(), /Weiteren Eintrag hinzufügen|Zustimmen|Widersprechen/);

  const empty = await renderGuide(page, substances, 1, [], {mode});
  assert.equal(await empty.locator('[data-guide-stage]').count(), 3);
  assert.equal(await (await openStage(empty, 0)).innerText(), groupDefinition);
  assert.equal(await (await openStage(empty, 2)).innerText(),
    'Anwendungsformen umfassen Handelsnamen, Applikationen und Stoffvarianten zu einem Wirkstoff bzw. einer Substanz.');

  const therapy = await renderGuide(page, ['Gruppe', 'Verfahren', 'Anwendung'], 0, [], {mode});
  assert.equal(await therapy.locator('[data-guide-stage]').count(), 3);
  assert.equal(await (await openStage(therapy, 1)).innerText(), 'Ein Verfahren beschreibt eine allgemeine Umsetzungsmöglichkeit der Therapie.');
  assert.equal(await (await openStage(therapy, 2)).innerText(), 'Eine Anwendung beschreibt, wie die Therapie konkret durchgeführt werden könnte.');
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

        await checkContributionCases(page);
        await checkEmptyContributionFields(page);
        const readingStyle = await checkModeCopy(page, 'explore');
        assert.deepEqual(await checkModeCopy(page, 'review'), readingStyle);
        assert.deepEqual(await checkModeCopy(page, 'alternatives'), readingStyle);
        console.log(`PASS ${width}px: field names, mode-specific text and shared card styles`);
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
