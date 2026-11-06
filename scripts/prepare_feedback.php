<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_feedback.php';
function fbLocalDatabase(): PDO {
 $c=lcnDatabaseConfig();if($c['profile']!=='LOCAL_HYBRID'||!in_array(strtolower($c['host']),['localhost','127.0.0.1','::1'],true)||$c['database']!=='lcn_hybrid_database')throw new RuntimeException('Only the local LOCAL_HYBRID/lcn_hybrid_database is permitted.');return lcnDatabase();
}
if(realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){$p=fbLocalDatabase();foreach(['20261106_feedback.sql','20261106_feedback_page_references.sql'] as $file)foreach(explode(';',file_get_contents(__DIR__.'/../migrations/'.$file)) as $sql)if(trim($sql)!=='')$p->exec($sql);echo "PASS: additive feedback migration applied locally.\n";}
