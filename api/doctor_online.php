<?php
require_once __DIR__.'/_doctor_online.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {echo json_encode(['ok'=>true,'doctors'=>lcnDoctorOnlineAccess(lcnDoctorDatabase(),($_GET['demo']??'0')==='1')]);}
catch(Throwable $error){http_response_code(503);echo json_encode(['ok'=>false,'error'=>'Online-Termine konnten nicht geladen werden.']);}
