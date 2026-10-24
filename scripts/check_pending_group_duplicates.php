<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_treatment_relationship_proposals.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();try{
 foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing') FOR UPDATE") as $row){
  $r=json_decode($row['payload'],true)['treatment_relationship']??[];if(($r['kind']??'')!=='group')continue;
  $duplicate=lcnTreatmentGroupDuplicate($p,$r,(int)$row['submission_id']);if(!$duplicate){$p->prepare("UPDATE community_submissions SET triage_status='needs_review',triage_score=0,duplicate_target_id=NULL,triage_reasons=? WHERE submission_id=?")->execute([json_encode(['Gruppenzuordnung prüfen.'],JSON_UNESCAPED_UNICODE),$row['submission_id']]);continue;}
  $p->prepare("UPDATE community_submissions SET triage_status='possible_duplicate',triage_score=?,duplicate_target_id=?,triage_reasons=? WHERE submission_id=?")->execute([$duplicate['score'],$duplicate['id'],json_encode([$duplicate['reason']],JSON_UNESCAPED_UNICODE),$row['submission_id']]);
  echo '#'.$row['submission_id'].' '.$r['group_name'].' -> '.$duplicate['name'].PHP_EOL;
 }
 foreach(lcnNdRows($p,"SELECT submission_id,name,existing_target_id,payload FROM community_submissions WHERE entity_type='treatment' AND submission_kind='new' AND review_status IN ('pending','reviewing') FOR UPDATE") as $row){
  $payload=json_decode($row['payload'],true)??[];if(isset($payload['treatment_relationship'])||isset($payload['symptom_proposal']))continue;
  $matches=lcnTreatmentDuplicateCandidates($p,$row['name'],(int)$row['existing_target_id']);$match=$matches[0]??null;
  if(!$match)continue;
  $p->prepare("UPDATE community_submissions SET triage_status='possible_duplicate',triage_score=?,duplicate_target_id=?,triage_reasons=? WHERE submission_id=?")->execute([$match['match_kind']==='identity'?95:75,$match['id'],json_encode([$match['meta']],JSON_UNESCAPED_UNICODE),$row['submission_id']]);
  echo '#'.$row['submission_id'].' '.$row['name'].' -> '.$match['label'].PHP_EOL;
 }
 $p->commit();
}catch(Throwable $e){$p->rollBack();throw $e;}
