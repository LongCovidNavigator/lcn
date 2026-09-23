<?php
// Read-only integration check. Run: php tests/hybrid_doctors_smoke.php
require_once __DIR__ . '/../api/_doctor_hybrid.php';
$base = $argv[1] ?? 'http://localhost/lcn/api/';
$pdo = lcnDoctorDatabase();
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
function request($path) {
    global $base;
    $body = file_get_contents($base . $path, false, stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 15]]));
    return [json_decode($body, true, 512, JSON_THROW_ON_ERROR), $http_response_header[0]];
}
[$list] = request('doctors_search.php?lat=51&lng=10&radiusKm=all');
$ids = array_column($list['items'], 'dr_id'); sort($ids);
$expected = LCN_PRIORITY_DOCTOR_IDS; sort($expected);
check($list['ok'] && $ids === $expected, 'Expected exactly the selected 39 unique IDs.');
$treatmentIds = [];
foreach ($expected as $id) {
    [$detail] = request('doctor_detail.php?id=' . $id);
    check($detail['ok'] && $detail['item']['dr_id'] === $id, "Detail failed: $id");
    $research = lcnDoctorResearch($pdo, $id);
    check($detail['research'] === $research, "Research changed or NULL lost: $id");
    $query = $pdo->prepare('SELECT treat_id FROM tbl_cpl_drs2treatments_03 WHERE dr_id = ?');
    $query->execute([$id]);
    $linked = array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN)); sort($linked);
    $actual = array_column($detail['treatments'], 'treat_id'); sort($actual);
    check($linked === $actual, "Treatment links differ: $id");
    $treatmentIds = array_merge($treatmentIds, $actual);
}
foreach ([1,1165,999999] as $outside) {
    [$detail, $status] = request('doctor_detail.php?id=' . $outside);
    check(str_contains($status, '404') && !$detail['ok'], 'Outside selection must return 404.');
}
foreach ($list['specialties'] as $specialty) {
    [$filtered] = request('doctors_search.php?lat=51&lng=10&radiusKm=all&specialtyTermId=' . $specialty['term_id']);
    check($filtered['count'] === $specialty['doctor_count'], 'Specialty filter count mismatch.');
    foreach ($filtered['items'] as $item) check(in_array($specialty['term_label'], array_column($item['specialty_terms'], 'term_label'), true), 'Specialty filter mismatch.');
}
[$search] = request('doctors_search.php?lat=51&lng=10&radiusKm=all&search=Stingl');
check(array_column($search['items'], 'dr_id') === [627], 'Name search failed.');
[$treatment] = request('treatments_detail.php?treat_id=789&source=priority');
check($treatment['ok'] && $treatment['item']['behandlung'] === 'NASA Lean Test', 'Hybrid treatment route failed.');
foreach ($treatment['item']['providers'] as $provider) check(in_array($provider['dr_id'], $expected, true), 'Treatment exposes an unselected provider.');
echo "PASS: 39 unique providers, all detail/research/NULL values, treatment mappings, outside-selection 404s, all specialty filters, name search and hybrid treatment route.\n";
