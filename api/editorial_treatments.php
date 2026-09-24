<?php
require_once __DIR__ . '/_doctor_hybrid.php';
require_once __DIR__ . '/_editorial_treatments.php';
header('Content-Type: application/json; charset=utf-8');
$definitions = lcnEditorialTreatments();
$items = [];
$available = true;
$ratings = [];
try {
    $pdo = lcnDoctorDatabase();
    $rows = $pdo->query('SELECT t.treat_id, t.behandlung, t.typ, (SELECT COUNT(DISTINCT c.dr_id) FROM tbl_cpl_drs2treatments_03 c WHERE c.treat_id=t.treat_id) AS provider_count FROM tbl_treatments_03 t')->fetchAll();
    $votes = $pdo->query("SELECT LOWER(TRIM(Behandlung)) AS name, SUM(COALESCE(pro,0)) AS pro, SUM(COALESCE(neutral,0)) AS neutral, SUM(COALESCE(contra,0)) AS contra FROM lcn_raw_votes WHERE Behandlung IS NOT NULL GROUP BY LOWER(TRIM(Behandlung))")->fetchAll();
    foreach ($votes as $vote) $ratings[$vote['name']] = $vote;
    foreach ($rows as $row) $items[(int)$row['treat_id']] = $row;
} catch (Throwable $e) {
    $available = false;
    error_log('Editorial catalog unavailable: ' . $e->getMessage());
}
$result = [];
foreach ($definitions as $i => $entry) {
    $summary = ['pro'=>0,'neutral'=>0,'contra'=>0];
    $seen = [];
    foreach ($entry['ids'] as $id) {
        $name = mb_strtolower(trim($items[$id]['behandlung'] ?? ''), 'UTF-8');
        if (isset($seen[$name])) continue;
        $seen[$name] = true;
        foreach (['pro','neutral','contra'] as $key) $summary[$key] += (int)($ratings[$name][$key] ?? 0);
    }
    $result[] = ['ratings'=>$summary, 'position'=>$i+1, 'label'=>$entry['label'], 'mode'=>$entry['mode'],
        'items'=>array_values(array_intersect_key($items,array_flip($entry['ids']))),
        'related'=>array_values(array_intersect_key($items,array_flip($entry['partial_ids'])))];
}
echo json_encode(['ok'=>true,'catalog_available'=>$available,'topics'=>$result], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
