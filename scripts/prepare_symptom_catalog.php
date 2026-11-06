<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_symptom_catalog.php';
function symLocalDatabase(): PDO {
 $c=lcnDatabaseConfig();if($c['profile']!=='LOCAL_HYBRID'||!in_array(strtolower($c['host']),['localhost','127.0.0.1','::1'],true)||$c['database']!=='lcn_hybrid_database')throw new RuntimeException('Only local LOCAL_HYBRID/lcn_hybrid_database is permitted.');return lcnDatabase();
}
if(realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){$p=symLocalDatabase();foreach(explode(';',file_get_contents(__DIR__.'/../migrations/20261106_symptom_catalog.sql')) as $sql)if(trim($sql)!=='')$p->exec($sql);echo "PASS: additive symptom catalog migration applied locally.\n";}
