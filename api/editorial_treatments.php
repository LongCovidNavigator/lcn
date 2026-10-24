<?php
require_once __DIR__ . '/_doctor_hybrid.php';
require_once __DIR__ . '/_editorial_treatments.php';
header('Content-Type: application/json; charset=utf-8');
$definitions = [];
$items = [];
$available = true;
$ratings = [];
$providersByTreatment = [];
try {
    $definitions = lcnEditorialTreatments();
    $pdo = lcnDoctorDatabase();
    $rows = $pdo->query('SELECT t.treat_id, t.behandlung, t.typ, (SELECT COUNT(DISTINCT c.dr_id) FROM v_lcn_provider_treatments c WHERE c.treat_id=t.treat_id) AS provider_count FROM v_lcn_treatments t')->fetchAll();
    foreach ($pdo->query('SELECT DISTINCT treat_id, dr_id FROM v_lcn_provider_treatments')->fetchAll() as $provider) {
        $providersByTreatment[(int)$provider['treat_id']][(int)$provider['dr_id']] = true;
    }
    $votes = $pdo->query("SELECT LOWER(TRIM(t.behandlung)) AS name,SUM(v.vote='pro') AS pro,SUM(v.vote='neutral') AS neutral,SUM(v.vote='contra') AS contra FROM v_lcn_treatment_votes v JOIN v_lcn_treatments t ON t.treat_id=v.treat_id GROUP BY t.treat_id,t.behandlung")->fetchAll();
    foreach ($votes as $vote) $ratings[$vote['name']] = $vote;
    foreach ($rows as $row) $items[(int)$row['treat_id']] = $row;
} catch (Throwable $e) {
    error_log('Editorial catalog unavailable: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['ok'=>false, 'catalog_available'=>false, 'message'=>'Die Therapien sind wegen einer Datenbankstörung gerade nicht verfügbar. Bitte später erneut versuchen.', 'topics'=>[]], JSON_UNESCAPED_UNICODE);
    exit;
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
    $topicProviders = [];
    foreach ($entry['ids'] as $id) {
        foreach ($providersByTreatment[$id] ?? [] as $doctorId => $_) $topicProviders[$doctorId] = true;
    }
    $result[] = ['provider_count'=>count($topicProviders), 'ratings'=>$summary, 'position'=>$i+1, 'label'=>$entry['label'], 'mode'=>$entry['mode'],
        'items'=>array_values(array_intersect_key($items,array_flip($entry['ids']))),
        'related'=>array_values(array_intersect_key($items,array_flip($entry['partial_ids'])))];
}
echo json_encode(['ok'=>true,'catalog_available'=>$available,'topics'=>$result], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
