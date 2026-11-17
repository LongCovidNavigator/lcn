<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../api/_doctor_hybrid.php';$p=lcnDatabase();
$rows=$p->query('SELECT * FROM tbl_fachrichtungen_nd ORDER BY id')->fetchAll();
$backup=__DIR__.'/specialties-backup-'.date('Ymd-His').'.json';
if(file_put_contents($backup,json_encode($rows,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE))===false)throw new RuntimeException('Backup failed');
$sql=file_get_contents(__DIR__.'/../migrations/20261117_canonical_doctor_specialties.sql');
$sql=preg_replace('/^\xEF\xBB\xBF/','',$sql);
try{foreach(explode(';',$sql) as $query)if(trim($query)!=='')$p->exec($query);}catch(Throwable $e){if($p->inTransaction())$p->rollBack();throw $e;}
echo "Applied canonical specialties. Backup: $backup\n";
foreach($p->query('SELECT fachrichtung,COUNT(*) assignments FROM tbl_fachrichtungen_nd GROUP BY fachrichtung ORDER BY fachrichtung') as $r)echo json_encode($r,JSON_UNESCAPED_UNICODE)."\n";
