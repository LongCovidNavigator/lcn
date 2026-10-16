<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_doctor_hybrid.php';
$p=lcnDoctorDatabase();
if($p->query('SELECT DATABASE()')->fetchColumn()!=='lcn_hybrid_database')throw new RuntimeException('Expected local database.');
foreach(explode(';',file_get_contents(__DIR__.'/../migrations/019_doctor_symptom_help.sql')) as $sql)if(trim($sql)!=='')$p->exec($sql);
echo "Doctor symptom help tables ready.\n";
