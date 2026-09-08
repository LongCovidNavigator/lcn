<?php
declare(strict_types=1);

// Reuse the production markup so the isolated mock always reflects layout changes.
// Only its data source and prototype banner are replaced; no database code is loaded.
$html = file_get_contents(__DIR__ . '/arzt_detail.html');

if ($html === false) {
    http_response_code(500);
    exit('Die Ärzte-Mockup-Seite konnte nicht geladen werden.');
}

$banner = <<<'HTML'
<section class="doctor-dummy-bar" aria-label="Testansicht auswählen">
    <div class="doctor-dummy-bar-copy"><span>Isolierter UI-Prototyp</span><strong>Erhebungsmodell vergleichen</strong></div>
    <nav class="doctor-dummy-scenarios" aria-label="Datenumfang">
        <a data-doctor-scenario="complete" href="?scenario=complete">Vollständig</a>
        <a data-doctor-scenario="research" href="?scenario=research">Nur Recherche</a>
        <a data-doctor-scenario="voting" href="?scenario=voting">Nur Abstimmung</a>
        <a data-doctor-scenario="hybrid" href="?scenario=hybrid">Nur Hybrid</a>
    </nav>
</section>
<div id="doctor-dummy-scenario-note" class="doctor-dummy-scenario-note"></div>
HTML;

$html = str_replace(
    '<title>Long Covid Navigator - Arzt-Steckbrief</title>',
    '<title>LCN – Mockup Ärzte-Detailseite</title>',
    $html
);
$html = str_replace(
    '<link rel="stylesheet" href="styles/arzt_detail.css?v=46">',
    '<link rel="stylesheet" href="styles/arzt_detail.css?v=46">' . "\n" .
    '    <link rel="stylesheet" href="styles/arzt_detail_dummy.css?v=3">',
    $html
);
$html = preg_replace(
    '/(<section class="doctor-detail-top-panel">.*?<\/section>)/s',
    '$1' . "\n\n" . $banner,
    $html,
    1
) ?? $html;
$html = str_replace(
    '<script src="scripts/arzt_detail.js?v=35"></script>',
    '<script src="scripts/doctor_treatment_taxonomy.js?v=1"></script>' . "\n" .
    '    <script src="scripts/doctor_dummy_fixtures.js?v=2"></script>' . "\n" .
    '    <script src="scripts/doctor_dummy_fixtures_aug28.js?v=1"></script>' . "\n" .
    '    <script src="scripts/arzt_detail_dummy.js?v=5"></script>' . "\n" .
    '    <script src="scripts/arzt_detail.js?v=37"></script>',
    $html
);

echo $html;
