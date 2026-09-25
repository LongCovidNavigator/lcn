<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_treatments_nd.php';
require_once __DIR__ . '/../components/treatments_nd_view.php';
require_once __DIR__ . '/../components/treatments_nd_evidence.php';
function completeCheck(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$pdo = lcnTreatmentsNdDatabase();
$dumpPath = $argv[1] ?? 'C:/Users/willi/Downloads/lcn_hybrid_database (2).sql';
$dump = file_get_contents($dumpPath);
$tables = ['tbl_treatments_nd','tbl_cpl_treatments_nd2aliases','tbl_cpl_treatments_nd2symptoms','tbl_cpl_entities2treatments_nd','tbl_treatment_studies_nd','tbl_treatment_field_sources_nd','tbl_treatment_community_answers_nd','tbl_cpl_treatments_nd_relations','tbl_treatment_costs_nd','tbl_treatment_pharmacies_nd','tbl_cpl_treatments_nd2pharmacies'];
foreach ($tables as $table) {
    preg_match('/CREATE TABLE `' . $table . '` \(([\s\S]*?)\) ENGINE/', $dump, $match);
    completeCheck(isset($match[1]), 'Table missing from supplied dump: ' . $table);
    preg_match_all('/^  `(\w+)`/m', $match[1], $columns);
    completeCheck($columns[1] === $pdo->query('SHOW COLUMNS FROM ' . $table)->fetchAll(PDO::FETCH_COLUMN), 'Dump/live column mismatch: ' . $table);
}
$items = lcnNdSearch($pdo);
completeCheck(count($items) === 29, 'Canonical count changed.');
completeCheck(array_column(lcnNdSearch($pdo, 'Psychologische Begleitung'), 'treatmentname') === ['Psychotherapie'], 'ND alias search failed.');
foreach ($items as $item) {
    $id = (int)$item['treat_nd_id']; $detail = lcnNdDetail($pdo, $id);
    $expected = lcnNdRows($pdo, "SELECT DISTINCT sym_id FROM tbl_cpl_treatments_nd2symptoms WHERE treat_nd_id=? AND aktiv=1 AND match_status IN ('eindeutig gematcht','manuell normalisiert nach LCN-Entscheid 2026-09-24') AND sym_id IS NOT NULL", [$id]);
    $a = array_column($detail['symptoms'], 'sym_id'); $b = array_column($expected, 'sym_id'); sort($a); sort($b);
    completeCheck($a === $b, 'Symptom status filter failed: ' . $id);
    foreach ($detail['providers'] as $provider) completeCheck(in_array($provider['relation_status'], ['bestand','belegt','kandidat'], true), 'Provider status failed.');
    foreach ($detail['community'] as $row) completeCheck(!isset($row['respondent_key']), 'Community identity exposed.');
    $html = file_get_contents('http://localhost/lcn/treatment_nd_test.php?id=' . $id);
    completeCheck(str_contains($http_response_header[0], '200') && !preg_match('/>\s*NULL\s*</', $html), 'Detail failed: ' . $id);
    if ($detail['studies']) completeCheck(str_contains($html, 'id="studien"'), 'Studies missing: ' . $id);
    completeCheck(!str_contains($html, 'class="nd-evidence"'), 'Editorial sources exposed: ' . $id);
    foreach (['verwandte Behandlung' => 'Verwandte Behandlungen', 'alternatives Präparat' => 'Alternative Präparate', 'alternative Behandlung' => 'Alternative Behandlungen'] as $type => $label) {
        if (in_array($type, array_column($detail['relations'], 'beziehungstyp'), true)) completeCheck(str_contains($html, '<h3>' . $label . '</h3>'), 'Relation grouping failed.');
    }
}
$sleep = lcnNdDetail($pdo, 20);
completeCheck($sleep['legacy_treat_id'] === null && count($sleep['symptoms']) > 0 && count($sleep['providers']) > 0, 'ND relationships still depend on legacy ID.');
$ldn = lcnNdDetail($pdo, 2);
completeCheck(count($ldn['studies']) > 0 && count($ldn['pharmacies']) === 2 && count($ldn['costs']) > 0, 'LDN incomplete.');
$pacing = file_get_contents('http://localhost/lcn/treatment_nd_test.php?id=1');
completeCheck(!str_contains($pacing, '<h3>Anwendung des Medikaments</h3>'), 'Empty Pacing medication block.');
$hbot = lcnNdDetail($pdo, 11);
completeCheck(count($hbot['studies']) > 0 && count($hbot['costs']) > 0 && str_contains(ndCommunityReadout($hbot), 'prüfbedürftig'), 'HBOT/community failed.');
$fixture = ['community' => [['question_key'=>'gesamtbewertung','answer_value'=>'positiv','answer_unit'=>null,'review_status'=>'active','n'=>2],['question_key'=>'gesamtbewertung','answer_value'=>'negativ','answer_unit'=>null,'review_status'=>'suspicious','n'=>1]]];
completeCheck(str_contains(ndCommunityReadout($fixture), '100 %') && str_contains(ndCommunityReadout($fixture), '1 gespeicherte'), 'Community review separation failed.');
echo "PASS: dump/live schema matches (11 tables), all 29 HTTP details, ND alias/symptom/provider links, studies, field sources, relation groups, no-legacy links, Pacing NULLs, reviewed community separation.\n";
