<?php
require_once __DIR__ . '/_lcn_db.php';
header('Content-Type: application/json; charset=utf-8');

try{
    $pdo=lcnDatabase();$type=(string)($_GET['type']??'');$id=filter_var($_GET['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    if($id===false||!in_array($type,['doctor','treatment'],true)){http_response_code(422);echo json_encode(['ok'=>false,'error'=>'Ungültiger Eintrag.']);exit;}
    if($type==='doctor'){
        $stmt=$pdo->prepare("SELECT d.dr_display_name AS name,d.dr_title_raw AS title,d.dr_firstname AS firstname,d.dr_lastname AS lastname,d.dr_org_name AS organization,CASE d.dr_type WHEN 'physician' THEN 'doctor' WHEN 'practice' THEN 'practice' WHEN 'clinic' THEN 'clinic' ELSE 'other' END AS provider_type,COALESCE(d.dr_website,l.loc_website,'') AS website,COALESCE(d.dr_email,l.loc_email,'') AS email,l.loc_phone AS phone,l.loc_street AS street,l.loc_housenumber AS house_number,l.loc_plz AS postal_code,l.loc_city AS city,l.loc_country AS country,d.dr_accepts_gkv,d.dr_accepts_pkv FROM tbl_drs_03 d LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1 WHERE d.dr_id=:id LIMIT 1");$stmt->execute([':id'=>$id]);$data=$stmt->fetch();
        if(!$data)throw new DomainException('Eintrag nicht gefunden.');
        $terms=$pdo->prepare("SELECT t.term_id,t.term_type,t.term_code FROM tbl_cpl_drs2terms_03 c INNER JOIN tbl_terms_03 t ON t.term_id=c.term_id WHERE c.dr_id=:id");$terms->execute([':id'=>$id]);$data['features']=[];$data['specialty_ids']=[];foreach($terms->fetchAll() as $term){if($term['term_type']==='specialty')$data['specialty_ids'][]=(int)$term['term_id'];else $data['features'][]=$term['term_code'];}
        $treatments=$pdo->prepare('SELECT treat_id FROM tbl_cpl_drs2treatments_03 WHERE dr_id=:id');$treatments->execute([':id'=>$id]);$data['treatment_ids']=array_map('intval',$treatments->fetchAll(PDO::FETCH_COLUMN));$data['insurance']=array_values(array_filter([$data['dr_accepts_gkv']==='yes'?'gkv':null,$data['dr_accepts_pkv']==='yes'?'pkv':null]));
    }else{
        $stmt=$pdo->prepare("SELECT behandlung AS name,wiki_url_path AS website,typ AS treatment_category,aufwand AS effort,crashrisiko AS crash_risk,kosten AS cost,wirkgeschwindigkeit AS speed,wirkmechanismus AS mechanism,indikationen_anwendungsgebiete AS indications,weitere_hinweise AS offerings FROM tbl_treatments_03 WHERE treat_id=:id");$stmt->execute([':id'=>$id]);$data=$stmt->fetch();if(!$data)throw new DomainException('Eintrag nicht gefunden.');
        $doctors=$pdo->prepare('SELECT dr_id FROM tbl_cpl_drs2treatments_03 WHERE treat_id=:id');$doctors->execute([':id'=>$id]);$data['doctor_ids']=array_map('intval',$doctors->fetchAll(PDO::FETCH_COLUMN));
    }
    echo json_encode(['ok'=>true,'data'=>$data],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}catch(DomainException $error){http_response_code(404);echo json_encode(['ok'=>false,'error'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);}catch(Throwable $error){lcnLogApiError('submission_existing_detail',$error);http_response_code(500);echo json_encode(['ok'=>false,'error'=>'Aktuelle Daten konnten nicht geladen werden.'],JSON_UNESCAPED_UNICODE);}
