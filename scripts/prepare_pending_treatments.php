<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_pending_treatments.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();$count=0;
try{
 foreach(lcnNdRows($p,"SELECT submission_id,name,payload FROM community_submissions WHERE entity_type='treatment' AND submission_kind='new' AND existing_target_id IS NULL AND review_status IN ('pending','reviewing') FOR UPDATE") as $row){
  $payload=json_decode($row['payload'],true)??[];if(isset($payload['treatment_relationship'])||isset($payload['symptom_proposal']))continue;
  lcnPublishPendingTreatment($p,(int)$row['submission_id'],$row['name'],$payload);$count++;
 }
 $p->commit();echo "$count pending therapies now have selectable catalog IDs.\n";
}catch(Throwable $e){$p->rollBack();throw $e;}
