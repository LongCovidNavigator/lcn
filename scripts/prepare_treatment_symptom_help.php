<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_treatments_nd.php';
$pdo=lcnTreatmentsNdDatabase();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='lcn_hybrid_database')throw new RuntimeException('Expected local database.');
foreach(explode(';',file_get_contents(__DIR__.'/../migrations/016_treatment_symptom_help.sql')) as $sql)if(trim($sql)!=='')$pdo->exec($sql);
echo "Symptom help tables ready.\n";
