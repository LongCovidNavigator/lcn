<?php
require_once __DIR__.'/_doctor_community.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
 $p=lcnDoctorDatabase();$counts=[];
 $tables=['doctor_community_answers'];if(($_GET['include_dummy']??'0')==='1')$tables[]='doctor_community_dummy_answers';
 foreach($tables as $table)foreach($p->query("SELECT dr_id,COUNT(*) total,SUM(option_value IN (3,4)) positive,SUM(option_value=1) worsening,SUM(option_value=2) neutral,SUM(option_value=3) improvement,SUM(option_value=4) healing FROM $table WHERE question_key='effect' AND context_key='' AND option_value BETWEEN 1 AND 4 GROUP BY dr_id") as $r){$id=(int)$r['dr_id'];$counts[$id]['total']=($counts[$id]['total']??0)+(int)$r['total'];foreach(['worsening','neutral','improvement','healing'] as $key)$counts[$id][$key]=($counts[$id][$key]??0)+(int)$r[$key];$counts[$id]['positive']=($counts[$id]['positive']??0)+(int)$r['positive'];}
 foreach($counts as &$r){$r['percent']=round(100*$r['positive']/$r['total'],1);foreach(['worsening','neutral','improvement','healing'] as $key)$r[$key.'_percent']=round(100*$r[$key]/$r['total'],1);}unset($r);
 echo json_encode(['ok'=>true,'ratings'=>(object)$counts],JSON_THROW_ON_ERROR);
}catch(Throwable $e){lcnLogApiError('provider_positive_ratings',$e);http_response_code(500);echo json_encode(['ok'=>false]);}
