<?php
require_once __DIR__.'/../api/_treatment_relationship_proposals.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $groups=[];
 foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing') FOR UPDATE") as $row){
  $r=json_decode($row['payload'],true)['treatment_relationship']??[];
  if(($r['kind']??'')!=='group')continue;
  $id=lcnEnsureProposedTreatmentGroup($p,$r,(int)$row['submission_id']);if($id)$groups[$id]=$r['group_name'];
 }
 $p->commit();echo json_encode($groups,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
}catch(Throwable $e){$p->rollBack();throw $e;}
