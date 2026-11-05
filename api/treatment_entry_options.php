<?php
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/_treatment_discovery.php';
header('Content-Type: application/json; charset=utf-8');
try {
 $p=lcnTreatmentsNdDatabase();
 $items=lcnNdRows($p,"SELECT treat_nd_id AS id,treatmentname AS name,typ AS category,unterkategorie AS subcategory FROM tbl_treatments_nd WHERE review_status<>'rejected_group' ORDER BY treatmentname");
 $graph=lcnTreatmentDiscoveryGraph($p);
 foreach($items as &$item){$id=(int)$item['id'];$item['medication_role']=!empty($graph['generics'][$id])?'brand':(isset($graph['roots'][$id])?'group':'ingredient');}unset($item);
 $categories=[];foreach($items as $item){$category=trim((string)$item['category']);$sub=trim((string)$item['subcategory']);if($category==='')continue;if(!isset($categories[$category]))$categories[$category]=[];if($sub!==''&&!in_array($sub,$categories[$category],true))$categories[$category][]=$sub;}
 ksort($categories);foreach($categories as &$subs)sort($subs);unset($subs);
 echo json_encode(['ok'=>true,'categories'=>(object)$categories,'items'=>$items],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){lcnLogApiError('treatment_entry_options',$e);http_response_code(500);echo json_encode(['ok'=>false,'error'=>'Die Einordnung konnte nicht geladen werden.']);}
