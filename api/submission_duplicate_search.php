<?php
require_once __DIR__ . '/_doctor_hybrid.php';
require_once __DIR__ . '/_lcn_db.php';
require_once __DIR__ . '/_search_normalization.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $type=(string)($_GET['type']??'');$query=trim((string)($_GET['q']??''));
    if(!in_array($type,['doctor','treatment'],true)||mb_strlen($query)<2){echo json_encode(['ok'=>true,'items'=>[]]);exit;}
    $pdo=lcnDoctorDatabase();
    if($type==='doctor' && ($_GET['catalog']??'')==='current'){
        $normalized=lcnNormalizeSearchTerm(mb_substr($query,0,180));
        $tokens=preg_split('/[^\p{L}\p{N}]+/u',$normalized,-1,PREG_SPLIT_NO_EMPTY);
        $tokens=array_values(array_filter($tokens,fn($token)=>!in_array($token,['dr','med','prof'],true)));
        $items=[];
        if($tokens){
            $rows=$pdo->query('SELECT lcn_id AS id,anzeigename AS label,organisationsname AS organization FROM tbl_entities_nd WHERE aktiv=1 AND lcn_id IN ('.implode(',',LCN_PRIORITY_DOCTOR_IDS).')')->fetchAll();
            foreach($rows as $row){
                $haystack=lcnNormalizeSearchTerm($row['label'].' '.($row['organization']??''));
                if(count(array_filter($tokens,fn($token)=>mb_strpos($haystack,$token)!==false))!==count($tokens))continue;
                $items[]=['id'=>(int)$row['id'],'label'=>$row['label'],'meta'=>$row['organization']??'','detail_url'=>'arzt_detail.html?id='.(int)$row['id']];
            }
            $rows=$pdo->query("SELECT submission_id,name,payload FROM community_submissions WHERE entity_type='doctor' AND review_status IN ('pending','reviewing') AND submission_kind='new'");
            foreach($rows as $row){
                $payload=json_decode($row['payload'],true)?:[];
                $haystack=lcnNormalizeSearchTerm($row['name'].' '.($payload['organization']??''));
                if(count(array_filter($tokens,fn($token)=>mb_strpos($haystack,$token)!==false))!==count($tokens))continue;
                $items[]=['id'=>-(int)$row['submission_id'],'label'=>$row['name'],'meta'=>trim(($payload['organization']??'').' · Noch nicht geprüft',' ·'),'detail_url'=>'arzt_detail.html?submission_id='.(int)$row['submission_id']];
            }
        }
        echo json_encode(['ok'=>true,'items'=>array_slice($items,0,8)],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;
    }
    if($type==='doctor'){
        $doctorSearch=lcnNormalizedSearchSql("CONCAT_WS(' ',d.dr_display_name,d.dr_firstname,d.dr_lastname,d.dr_org_name)");
        $stmt=$pdo->prepare("SELECT d.dr_id AS id,d.dr_display_name AS label,COALESCE(d.dr_website,l.loc_website,'') AS website,CONCAT_WS(' ',l.loc_plz,l.loc_city) AS meta FROM tbl_drs_03 d LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1 WHERE {$doctorSearch} LIKE :normalized_query ORDER BY CASE WHEN ".lcnNormalizedSearchSql('TRIM(d.dr_display_name)')."=:normalized_exact THEN 0 ELSE 1 END,d.dr_display_name LIMIT 8");
    }else{
        // Ignore punctuation so that "Help" finds "H.E.L.P." and include aliases.
        $normalizeTreatment=lcnNormalizedSearchSql("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(t.behandlung),'.',''),'-',''),' ',''),'/',''),'(',''),')','')");
        $normalizeAlias=lcnNormalizedSearchSql("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(a.alias),'.',''),'-',''),' ',''),'/',''),'(',''),')','')");
        $stmt=$pdo->prepare("
            SELECT t.treat_id AS id,t.behandlung AS label,COALESCE(t.wiki_url_path,'') AS website,
                CONCAT_WS(' · ',NULLIF(CONCAT('Alias: ',MIN(CASE WHEN {$normalizeAlias} LIKE :normalized_query THEN a.alias END)),'Alias: '),t.typ,t.unterkategorie) AS meta
            FROM tbl_treatments_03 t
            LEFT JOIN tbl_cpl_treatments2aliases_03 cta ON cta.treat_id=t.treat_id
            LEFT JOIN tbl_aliases_03 a ON a.alias_id=cta.alias_id
            WHERE {$normalizeTreatment} LIKE :normalized_query OR {$normalizeAlias} LIKE :normalized_query
            GROUP BY t.treat_id,t.behandlung,t.wiki_url_path,t.typ,t.unterkategorie
            ORDER BY CASE WHEN {$normalizeTreatment}=:normalized_exact THEN 0 ELSE 1 END,t.behandlung
            LIMIT 8
        ");
    }
    if($type==='doctor'){
        $normalizedQuery=lcnNormalizeSearchTerm($query);
        $stmt->execute([':normalized_query'=>'%'.$normalizedQuery.'%',':normalized_exact'=>$normalizedQuery]);
    }else{
        $normalizedQuery=preg_replace('/[^\p{L}\p{N}]+/u','',lcnNormalizeSearchTerm($query));
        $stmt->execute([':normalized_query'=>'%'.$normalizedQuery.'%',':normalized_exact'=>$normalizedQuery]);
    }
    $items=$stmt->fetchAll();
    foreach($items as &$item){$item['id']=(int)$item['id'];$item['detail_url']=$type==='doctor'?'arzt_detail.html?id='.$item['id']:'therapie_detail.html?treat_id='.$item['id'];}
    echo json_encode(['ok'=>true,'items'=>$items],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}catch(Throwable $error){lcnLogApiError('submission_duplicate_search',$error);http_response_code(500);echo json_encode(['ok'=>false,'error'=>'Dublettenprüfung derzeit nicht verfügbar.'],JSON_UNESCAPED_UNICODE);}
