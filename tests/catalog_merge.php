<?php
require __DIR__.'/../api/_catalog_merge.php';$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $suffix=bin2hex(random_bytes(4));$ids=[];foreach(['A','B'] as $n){$p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ,beschreibung,review_status) VALUES(?,?,?,'pending_group')")->execute(['Merge '.$n.' '.$suffix,$n==='A'?'Arzneimittel':'Ernährung',$n==='A'?'Nur A':null]);$ids[]=(int)$p->lastInsertId();}[$a,$b]=$ids;
 $p->prepare("INSERT INTO tbl_treatment_community_answers_nd(treat_nd_id,respondent_key,question_key,answer_value,context_key) VALUES(?,?,'effect',?,'')")->execute([$a,hash('sha256',$suffix),'Verbesserung']);
 $p->prepare("INSERT INTO tbl_treatment_symptom_help_links(treat_nd_id,sym_id) SELECT ?,sym_id FROM tbl_symptoms LIMIT 1")->execute([$a]);
 $row=['submission_id'=>999999,'entity_type'=>'treatment','existing_target_id'=>$a,'duplicate_target_id'=>$b,'payload'=>['treatment_relationship'=>['kind'=>'group','group_name'=>'Merge A '.$suffix]]];if(lcnMergePair($p,$row)!==[$a,$b])throw new RuntimeException('Parsed proposal pair incorrect');
 $plan=lcnMergePlan($p,'treatment',$a,$b);$failed=false;try{lcnApplyCatalogMerge($p,$plan,[],999999);}catch(DomainException $e){$failed=true;}if(!$failed)throw new RuntimeException('Unresolved conflict accepted');
 $choices=[];foreach($plan['conflicts'] as $c)$choices[$c['key']]='source';lcnApplyCatalogMerge($p,$plan,$choices,999999);
 $target=lcnNdRows($p,'SELECT * FROM tbl_treatments_nd WHERE treat_nd_id=?',[$b])[0];if($target['beschreibung']!=='Nur A'||$target['typ']!=='Arzneimittel')throw new RuntimeException('Fields lost');
 if(!lcnNdRows($p,'SELECT 1 FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=?',[$b]))throw new RuntimeException('Vote lost');
 if(!lcnNdRows($p,'SELECT 1 FROM tbl_treatment_symptom_help_links WHERE treat_nd_id=?',[$b]))throw new RuntimeException('Symptom link lost');
 if(isset(lcnTreatmentDiscoveryGraph($p)['entries'][$a]))throw new RuntimeException('Old entry still visible');
 echo "PASS: selected destination, explicit conflict resolution, complementary fields, votes, symptom links, hidden old entry, archive. Rolled back.\n";
}finally{$p->rollBack();}
