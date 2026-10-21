<?php
require_once __DIR__.'/../api/_submission_review.php';require_once __DIR__.'/../components/treatments_nd_view.php';require_once __DIR__.'/../components/treatment_combinations.php';
function comboCheck(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $suffix=bin2hex(random_bytes(6));$ids=[];foreach(['A','B','C'] as $letter){$p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ) VALUES(?,'Arzneimittel')")->execute(['Kombinationstest '.$letter.' '.$suffix]);$ids[]=(int)$p->lastInsertId();}
 $g=lcnTreatmentDiscoveryGraph($p);$input=['kind'=>'new_combination','source_id'=>$ids[0],'name'=>'Maraviroc + Kombinationstest '.$suffix,'component_ids'=>$ids];$r=lcnNormalizeTreatmentRelationship($p,$input,$g);$reverse=$input;$reverse['component_ids']=array_reverse($ids);comboCheck($r['signature']===lcnNormalizeTreatmentRelationship($p,$reverse,$g)['signature'],'Order must not change signature');
 $payload=['treatment_relationship'=>$r,'review_note'=>'Transaktionstest'];$p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,payload,submitter_key) VALUES('treatment',?,'change',?,?,?)")->execute([$ids[0],$r['name'],json_encode($payload),hash('sha256',$suffix)]);$sid=(int)$p->lastInsertId();$row=['submission_id'=>$sid,'existing_target_id'=>$ids[0]];
 comboCheck(!lcnNdRows($p,'SELECT treat_nd_id FROM tbl_treatments_nd WHERE treatmentname=?',[$r['name']]),'Pending proposal created an entry too early');
 $p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute(['s:'.$sid,hash('sha256','test-'.$suffix)]);
 $created=lcnApproveTreatmentSubmission($p,$row,$payload);comboCheck($created!==$ids[0],'Approval must return the new combination ID');comboCheck(lcnApproveTreatmentSubmission($p,$row,$payload)===$created,'Approval must be idempotent');$after=lcnTreatmentDiscoveryGraph($p);
 foreach($ids as $part){comboCheck(isset($after['components'][$created][$part],$after['combinations'][$part][$created]),'Both directions must resolve');lcnValidateTreatmentDiscoveryFeedback($p,'cp:'.$created.':'.$part,$after);}
 comboCheck(!isset($after['components'][$created][22]),'The chosen name must not add an unselected component');
 comboCheck(count(lcnNdRows($p,"SELECT relation_key FROM catalog_relation_feedback WHERE respondent_key=? AND relation_key LIKE 'cp:%'",[hash('sha256','test-'.$suffix)]))===0,'Creation vote must not be copied to all component links');
 $html=ndRenderTreatmentCombinations($after,$created);comboCheck(substr_count($html,'Du bist hier')===1,'Combination current marker');comboCheck(substr_count($html,'data-combination-part ')===3,'Three constituents expected');comboCheck(!str_contains($html,'data-combination-membership-feedback'),'No parent feedback on combination itself');
 foreach($ids as $part){$html=ndRenderTreatmentCombinations($after,$part);comboCheck(substr_count($html,'Du bist hier')===1,'Single-therapy marker');comboCheck(str_contains($html,'data-combination-create'),'Create action missing');comboCheck(substr_count($html,'data-combination-membership-feedback')===1,'Single page needs parent membership feedback');comboCheck(substr_count($html,'data-treatment-relation-feedback="cp:'.$created.':'.$part.'"')===2,'Parent and component must use the same relationship key');}
 foreach([
  array_replace($input,['component_ids'=>[$ids[0]]]),array_replace($input,['component_ids'=>[$ids[0],$ids[0]]]),array_replace($input,['component_ids'=>[$ids[1],$ids[2]]]),array_replace($input,['component_ids'=>[$ids[0],99999999]]),array_replace($input,['name'=>' ']),array_replace($input,['name'=>'Anderer Name '.$suffix])
 ] as $invalid){$failed=false;try{lcnNormalizeTreatmentRelationship($p,$invalid);}catch(InvalidArgumentException $e){$failed=true;}comboCheck($failed,'Invalid or duplicate creation accepted');}
 echo "PASS one pending proposal, atomic moderated creation, all component links, order-independent duplicates, idempotence, current markers and vote separation. Rolled back.\n";
}finally{$p->rollBack();}
