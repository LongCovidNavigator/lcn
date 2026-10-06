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
    $rows = $pdo->query('SELECT t.treat_id, t.behandlung, t.typ, (SELECT COUNT(DISTINCT c.dr_id) FROM v_lcn_provider_treatments c WHERE c.treat_id=t.treat_id) AS provider_count FROM v_lcn_treatments t')->fetchAll();
    $votes = $pdo->query("SELECT LOWER(TRIM(t.behandlung)) AS name,SUM(v.vote='pro') AS pro,SUM(v.vote='neutral') AS neutral,SUM(v.vote='contra') AS contra FROM v_lcn_treatment_votes v JOIN v_lcn_treatments t ON t.treat_id=v.treat_id GROUP BY t.treat_id,t.behandlung")->fetchAll();
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
