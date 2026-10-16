<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_doctor_community.php';
$pdo=lcnDoctorDatabase();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='lcn_hybrid_database')throw new RuntimeException('Expected local lcn_hybrid_database.');
$pdo->exec(file_get_contents(__DIR__.'/../migrations/017_doctor_cost_total_scale.sql'));
echo "Precise doctor cost options ready.\n";
