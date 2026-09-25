<?php
// Read-only integration checks against the real hybrid DB and local HTTP pages.
declare(strict_types=1);
require_once __DIR__ . '/../api/_treatments_nd.php';
require_once __DIR__ . '/../components/treatments_nd_view.php';
function ndCheck(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function ndRequest(string $path): array {
    global $base;
    $body = file_get_contents($base . $path, false, stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 15]]));
    return [$body, $http_response_header[0]];
}
$base = $argv[1] ?? 'http://localhost/lcn/';
$pdo = lcnTreatmentsNdDatabase();
$items = lcnNdSearch($pdo);
ndCheck(count($items) === (int)$pdo->query('SELECT COUNT(*) FROM tbl_treatments_nd')->fetchColumn(), 'ND list must match DB.');
[$html, $status] = ndRequest('treatments_nd_test.php');
ndCheck(str_contains($status, '200') && substr_count($html, 'class="card nd-result"') === count($items), 'Overview failed.');
foreach ($items as $item) {
    $detail = lcnNdDetail($pdo, (int)$item['treat_nd_id']);
    ndCheck($detail['beschreibung'] === $item['beschreibung'], 'Description/NULL was changed.');
    [$html, $status] = ndRequest('treatment_nd_test.php?id=' . $item['treat_nd_id']);
    ndCheck(str_contains($status, '200') && str_contains($html, ndEscape($item['treatmentname'])), 'Detail failed: ' . $item['treat_nd_id']);
    ndCheck(!preg_match('/>\s*NULL\s*</', $html), 'NULL rendered.');
}
$ldn = lcnNdSearch($pdo, 'LDN');
ndCheck(count($ldn) === 1, 'LDN search failed.');
$ldn = lcnNdDetail($pdo, (int)$ldn[0]['treat_nd_id']);
ndCheck(count($ldn['pharmacies']) === 2 && count($ldn['providers']) > 0 && count($ldn['symptoms']) > 0 && count($ldn['costs']) > 0, 'LDN associations failed.');
[$html] = ndRequest('treatments_nd_test.php?q=' . rawurlencode('Psychologische Begleitung'));
ndCheck(substr_count($html, 'class="card nd-result"') === 1 && str_contains($html, '>Psychotherapie</a>'), 'Alias search failed.');
ndCheck(lcnNdSearch($pdo, '%') === [], 'Search wildcard was not escaped.');
ndCheck(lcnNdSearch($pdo, "' OR 1=1 --") === [], 'SQL-like input must stay literal.');
[$html] = ndRequest('treatment_nd_test.php?id=1');
ndCheck(!str_contains($html, 'Anwendung des Medikaments'), 'Pacing has empty medication block.');
$related = lcnNdDetail($pdo, 3);
ndCheck(count($related['relations']) > 0 && in_array($related['relations'][0]['beziehungstyp'], ['verwandte Behandlung','alternatives Präparat','alternative Behandlung'], true) && (int)$related['relations'][0]['resolved_nd_id'] === 4, 'NULL relationship or ND target failed.');
[$html] = ndRequest('treatment_nd_test.php?id=3');
ndCheck(str_contains($html, 'treatment_nd_test.php?id=4') && str_contains($html, '<dt>Beziehung</dt>'), 'Related treatment UI failed.');
foreach (['' => '400', '?id[]=2' => '400', '?id=999999' => '404'] as $query => $expected) {
    [, $status] = ndRequest('treatment_nd_test.php' . $query);
    ndCheck(str_contains($status, $expected), 'Invalid ID status failed.');
}
ndCheck(ndFields(['x' => null, 'y' => ''], ['x' => 'X', 'y' => 'Y']) === '', 'Empty fields rendered.');
ndCheck(ndFields(['x' => 0], ['x' => 'X']) !== '', 'Zero was lost.');
ndCheck(ndSource('javascript:alert(1)') === '' && ndEscape('<script>') === '&lt;script&gt;', 'Output escaping failed.');
echo 'PASS: ' . count($items) . " DB-backed detail pages, overview, name/alias search, LDN pharmacies/providers/costs/symptoms, Pacing, NULL relations, escaping and error states.\n";
