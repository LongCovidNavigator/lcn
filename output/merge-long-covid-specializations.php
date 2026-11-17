<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../api/_doctor_hybrid.php';
$p=lcnDoctorDatabase();
$rows=$p->query("SELECT * FROM tbl_spezialisierungen_nd WHERE spezialisierung IN ('Long COVID','Long Covid / Post Covid')")->fetchAll();
if(!$rows){echo "No changes needed\n";exit;}
$backup=__DIR__.'/medical-terms-backup-'.date('Ymd-His').'.json';
if(file_put_contents($backup,json_encode($rows,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE))===false)throw new RuntimeException('Backup failed');
$p->beginTransaction();
try{
 $n=$p->exec("UPDATE tbl_spezialisierungen_nd SET spezialisierung='Long COVID / Post-COVID' WHERE spezialisierung IN ('Long COVID','Long Covid / Post Covid')");
 $p->commit();echo "Updated $n assignments; backup: $backup\n";
}catch(Throwable $e){$p->rollBack();throw $e;}
