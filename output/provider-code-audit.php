<?php
require __DIR__.'/../api/_doctor_hybrid.php';require __DIR__.'/../api/_search_normalization.php';
$p=lcnDoctorDatabase();
foreach(['community_submissions','v_lcn_doctors','v_lcn_treatments'] as $table){echo $table.': '.implode(',',array_column($p->query('SHOW COLUMNS FROM '.$table)->fetchAll(),'Field')).PHP_EOL;}
$q=$p->prepare("SELECT submission_id,name,review_status,payload FROM community_submissions WHERE LOWER(name) LIKE ? ORDER BY submission_id DESC LIMIT 10");$q->execute(['%willi%']);foreach($q as $row){$v=json_decode($row['payload'],true);echo json_encode(['submission'=>$row['submission_id'],'name'=>$row['name'],'status'=>$row['review_status'],'treatment_ids'=>$v['treatment_ids']??null]).PHP_EOL;}
$sql="SELECT dr_id FROM v_lcn_doctors WHERE ".lcnNormalizedSearchSql('TRIM(dr_display_name)')."=:name OR (:website<>'' AND LOWER(TRIM(COALESCE(dr_website,'')))=LOWER(TRIM(:website))) LIMIT 1";
try{$q=$p->prepare($sql);$q->execute([':name'=>'willi',':website'=>'https://example.org']);echo 'TRIAGE QUERY OK'.PHP_EOL;}catch(Throwable $e){echo 'TRIAGE ERROR '.$e->getMessage().PHP_EOL;}
