<?php
require_once __DIR__ . '/_doctor_hybrid.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $pdo = lcnDoctorDatabase();
    require_once __DIR__ . '/_experience_summary.php';
    $result = lcnExperienceSummary($pdo);
    echo json_encode(['ok'=>true,'counts'=>$result], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Experience summary: '.$e->getMessage());
    http_response_code(500);
    echo json_encode(['ok'=>false]);
}
