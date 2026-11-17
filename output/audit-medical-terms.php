<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../api/_doctor_hybrid.php';
$p=lcnDoctorDatabase();
foreach(['fachrichtungen'=>'fachrichtung','spezialisierungen'=>'spezialisierung','zusatzqualifikationen'=>'zusatzqualifikation'] as $table=>$col){
 echo "\n=== $table ===\n";
 foreach($p->query("SELECT t.$col label, COUNT(DISTINCT t.lcn_id) providers, COUNT(DISTINCT CASE WHEN e.aktiv=1 THEN t.lcn_id END) active FROM tbl_{$table}_nd t LEFT JOIN tbl_entities_nd e ON e.lcn_id=t.lcn_id GROUP BY t.$col ORDER BY t.$col") as $r) echo json_encode($r,JSON_UNESCAPED_UNICODE)."\n";
}
echo "\n=== candidates with complete profiles ===\n";
$sql="SELECT e.lcn_id,e.anzeigename, GROUP_CONCAT(DISTINCT f.fachrichtung SEPARATOR '; ') fachrichtungen, GROUP_CONCAT(DISTINCT s.spezialisierung SEPARATOR '; ') spezialisierungen,GROUP_CONCAT(DISTINCT q.zusatzqualifikation SEPARATOR '; ') qualifikationen FROM tbl_entities_nd e LEFT JOIN tbl_fachrichtungen_nd f ON f.lcn_id=e.lcn_id LEFT JOIN tbl_spezialisierungen_nd s ON s.lcn_id=e.lcn_id LEFT JOIN tbl_zusatzqualifikationen_nd q ON q.lcn_id=e.lcn_id WHERE e.aktiv=1 GROUP BY e.lcn_id HAVING fachrichtungen REGEXP 'Innere und|Praktische|Psychosomatische|Psychiatrie|Rehabilitationsmedizin|Physikalische' OR qualifikationen LIKE '%Funktionelle%'";
foreach($p->query($sql) as $r)echo json_encode($r,JSON_UNESCAPED_UNICODE)."\n";
echo "\n=== Long COVID union ===\n";
echo json_encode($p->query("SELECT COUNT(DISTINCT t.lcn_id) providers FROM tbl_spezialisierungen_nd t JOIN tbl_entities_nd e ON e.lcn_id=t.lcn_id WHERE e.aktiv=1 AND t.spezialisierung IN ('Long COVID','Long Covid / Post Covid')")->fetch());
