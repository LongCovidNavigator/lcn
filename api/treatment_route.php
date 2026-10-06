<?php
declare(strict_types=1);
require_once __DIR__ . '/_treatments_nd.php';
header('Content-Type: application/json; charset=utf-8');
$id=filter_var($_GET['treat_id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
if (!$id) {http_response_code(400);echo json_encode(['ok'=>false]);exit;}
try {
    $rows=lcnNdRows(lcnTreatmentsNdDatabase(),'SELECT treat_nd_id FROM tbl_treatments_nd WHERE treat_nd_id = ?',[$id]);
    echo json_encode(['ok'=>true,'nd_id'=>$rows ? (int)$rows[0]['treat_nd_id'] : null]);
} catch(Throwable $e) {lcnLogApiError('treatment_route',$e);http_response_code(503);echo json_encode(['ok'=>false]);}
