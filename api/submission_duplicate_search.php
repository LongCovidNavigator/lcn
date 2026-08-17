<?php
require_once __DIR__ . '/_lcn_db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $type=(string)($_GET['type']??'');$query=trim((string)($_GET['q']??''));
    if(!in_array($type,['doctor','treatment'],true)||mb_strlen($query)<2){echo json_encode(['ok'=>true,'items'=>[]]);exit;}
    $pdo=lcnDatabase();
    if($type==='doctor'){
        $stmt=$pdo->prepare("SELECT d.dr_id AS id,d.dr_display_name AS label,COALESCE(d.dr_website,l.loc_website,'') AS website,CONCAT_WS(' ',l.loc_plz,l.loc_city) AS meta FROM tbl_drs_03 d LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1 WHERE d.dr_display_name LIKE :query OR d.dr_lastname LIKE :query OR d.dr_org_name LIKE :query ORDER BY CASE WHEN LOWER(TRIM(d.dr_display_name))=LOWER(TRIM(:exact)) THEN 0 ELSE 1 END,d.dr_display_name LIMIT 8");
    }else{
        $stmt=$pdo->prepare("SELECT treat_id AS id,behandlung AS label,COALESCE(wiki_url_path,'') AS website,CONCAT_WS(' · ',typ,unterkategorie) AS meta FROM tbl_treatments_03 WHERE behandlung LIKE :query ORDER BY CASE WHEN LOWER(TRIM(behandlung))=LOWER(TRIM(:exact)) THEN 0 ELSE 1 END,behandlung LIMIT 8");
    }
    $stmt->execute([':query'=>'%'.$query.'%',':exact'=>$query]);$items=$stmt->fetchAll();
    foreach($items as &$item){$item['id']=(int)$item['id'];$item['detail_url']=$type==='doctor'?'arzt_detail.html?id='.$item['id']:'therapie_detail.html?treat_id='.$item['id'];}
    echo json_encode(['ok'=>true,'items'=>$items],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}catch(Throwable $error){lcnLogApiError('submission_duplicate_search',$error);http_response_code(500);echo json_encode(['ok'=>false,'error'=>'Dublettenprüfung derzeit nicht verfügbar.'],JSON_UNESCAPED_UNICODE);}
