const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

async function checkSavedView(browser, width) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try {
        await page.route('http://maps.test/**', route => route.fulfill({
            contentType: 'text/html',
            body: '<div id="map" style="width:100%;height:380px"></div>'
        }));
        await page.route('https://server.arcgisonline.com/**', route => route.abort());
        async function loadMap() {
            await page.addScriptTag({ path: path.resolve(__dirname, '../assets/vendor/leaflet/leaflet.js') });
            await page.addScriptTag({ path: path.resolve(__dirname, '../scripts/map_viewport.js') });
            await page.evaluate(() => {
                const origin = JSON.parse(localStorage.getItem('lcn_shared_location_preference'));
                window.testMap = LCNMapViewport.createMap('map', {
                    viewKey: new URL(location.href).searchParams.get('map') || 'test'
                });
                window.setOrigin = point => {
                    LCNMapViewport.saveLocation(point);
                    window.originMarker?.remove();
                    window.originMarker = L.marker(point, { lcnOwnLocation: true }).addTo(testMap);
                    testMap._lcnViewport?.apply();
                };
                window.loadResults = () => {
                    L.marker([51.96, 7.63]).addTo(testMap);
                    setOrigin(origin);
                };
            });
            await page.locator('[data-show-all]').waitFor({ state: 'attached' });
        }
        await page.goto('http://maps.test/');
        await page.evaluate(() => localStorage.setItem('lcn_shared_location_preference',
            JSON.stringify({ lat: 52.52, lng: 13.405 })));
        await loadMap();
        await page.evaluate(() => loadResults());
        const initial = await page.evaluate(() => testMap.getZoom());
        await page.locator('.leaflet-control-zoom-in').dispatchEvent('click');
        await page.waitForFunction(zoom => testMap.getZoom() > zoom &&
            localStorage.getItem('lcn_map_view:test'), initial);
        const manual = await page.evaluate(() => testMap.getZoom());

        await page.reload();
        await loadMap();
        assert.equal(await page.evaluate(() => testMap.getZoom()), manual);
        await page.evaluate(() => loadResults());
        assert.equal(await page.evaluate(() => testMap.getZoom()), manual, 'late results keep the manual zoom');
        await page.goto('http://maps.test/?map=other');
        await loadMap();
        await page.evaluate(() => loadResults());
        assert.equal(await page.evaluate(() => testMap.getZoom()), initial, 'each map has its own zoom');

        await page.goto('http://maps.test/');
        await loadMap();
        await page.evaluate(() => loadResults());
        assert.equal(await page.evaluate(() => testMap.getZoom()), manual, 'returning to the same map restores its zoom');

        const readCamera = () => page.evaluate(() => ({ center: testMap.getCenter(), zoom: testMap.getZoom() }));
        await page.locator('[data-country-current]').click();
        const germany = await readCamera();
        await page.reload();
        await loadMap();
        await page.evaluate(() => {
            loadResults();
            L.marker([35, 33]).addTo(testMap);
            testMap._lcnViewport.apply();
        });
        assert.deepEqual(await readCamera(), germany, 'Germany survives reload and distant results');
        assert.equal(await page.locator('[data-show-all]').getAttribute('aria-pressed'), 'false');

        await page.locator('[data-show-all]').click();
        const allResults = await readCamera();
        assert.notDeepEqual(allResults, germany);
        await page.goto('http://maps.test/?map=other');
        await loadMap();
        await page.goto('http://maps.test/');
        await loadMap();
        await page.evaluate(() => loadResults());
        assert.deepEqual(await readCamera(), allResults, 'the all-results view survives returning to the map');
        assert.equal(await page.locator('[data-show-all]').getAttribute('aria-pressed'), 'true');

        await page.evaluate(() => setOrigin({ lat: 48.14, lng: 11.58 }));
        assert.equal(await page.evaluate(() => localStorage.getItem('lcn_map_view:test')), null);
        assert(await page.evaluate(() => [[51.96, 7.63], [48.14, 11.58]].every(point =>
            testMap.getBounds().contains(point))));
    } finally {
        await page.close();
    }
}

async function run() {
    const browser = await chromium.launch({
        channel: process.env.LCN_TEST_BROWSER || 'msedge',
        args: ['--disable-crash-reporter', '--disable-breakpad']
    });
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 844 } });
            await page.setContent('<div id="map" style="width:24px;height:24px"></div>');
            await page.addScriptTag({ path: path.resolve(__dirname, '../assets/vendor/leaflet/leaflet.js') });
            await page.addScriptTag({ path: path.resolve(__dirname, '../scripts/map_viewport.js') });
            await page.evaluate(() => {
                window.testMap = L.map('map', { maxZoom: 19, lcnFitRadius: true }).setView([51, 10], 6);
                window.testPoints = [[50.94, 6.96], [52.52, 13.41]];
                testPoints.forEach(point => L.marker(point).addTo(testMap));
            });
            await page.locator('[data-country-current]').waitFor({ state: 'attached' });
            assert.equal(await page.evaluate(() => testMap.getZoom()), 6, 'do not fit while layout is too small');

            await page.locator('#map').evaluate(node => {
                node.style.width = '100%';
                node.style.height = '380px';
            });
            await page.waitForFunction(() => [[47.2, 5.5], [55.1, 15.5]].every(point =>
                testMap.getBounds().contains(point)));

            await page.locator('[data-show-all]').dispatchEvent('click');
            assert(await page.evaluate(() => testPoints.every(point => testMap.getBounds().contains(point))));

            await page.evaluate(() => {
                window.testRadius = L.circle(testPoints[0], { radius: 100000 }).addTo(testMap);
            });
            await page.waitForFunction(() => testMap.getBounds().contains(testRadius.getBounds())
                && testMap.getCenter().distanceTo(testPoints[0]) < 30000);
            await page.locator('[data-country-current]').dispatchEvent('click');
            assert(await page.evaluate(() => testMap.getBounds().contains([55.1, 15.5])));

            await page.evaluate(() => {
                testMap.setView(testPoints[0], 9, { animate: false });
                testMap.getContainer().style.display = 'none';
                testMap.invalidateSize();
            });
            await page.locator('#map').evaluate(node => { node.style.display = ''; });
            await page.waitForFunction(() => testMap.getSize().x > 64 &&
                testMap.getCenter().distanceTo(testPoints[0]) < 100 && testMap.getZoom() === 9);

            await page.evaluate(() => {
                testRadius.remove();
                window.testOrigin = L.marker([48.14, 11.58], { lcnOwnLocation: true }).addTo(testMap);
            });
            const bothVisible = () => [...testPoints, testOrigin.getLatLng()].every(point =>
                testMap.getBounds().contains(point));
            await page.waitForFunction(bothVisible);
            await page.locator('[data-country-current]').dispatchEvent('click');
            assert(await page.evaluate(() => testMap.getBounds().contains([55.1, 15.5])));
            await page.locator('[data-show-all]').dispatchEvent('click');
            assert(await page.evaluate(bothVisible));
            const zoomOffset = await page.evaluate(() => {
                const bounds = L.latLngBounds([...testPoints, testOrigin.getLatLng()]);
                const size = testMap.getSize();
                const padding = L.point(36 + size.x * 0.07, 110 + size.y * 0.07);
                return testMap.getBoundsZoom(bounds, false, padding) - testMap.getZoom();
            });
            assert.equal(zoomOffset, 0.5, 'leave half a zoom level of geographic context');
            await page.close();
            await checkSavedView(browser, width);
        }
        console.log('PASS shared layout, country, all results, radius and saved zoom at desktop and mobile widths');
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
