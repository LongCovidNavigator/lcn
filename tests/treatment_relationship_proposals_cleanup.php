<?php
// CLI-only removal of pending records created by this test's unique marker.
if(PHP_SAPI!=='cli')exit;
require_once __DIR__.'/../api/_treatments_nd.php';
$marker=$argv[1]??'';
if(!preg_match('/^codex-relation-ui-[a-f0-9]{24}$/D',$marker))throw new InvalidArgumentException('Invalid test marker.');
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $rows=lcnNdRows($p,"SELECT submission_id FROM community_submissions WHERE entity_type='treatment' AND review_status='pending' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.review_note'))=? AND JSON_EXTRACT(payload,'$.treatment_relationship') IS NOT NULL FOR UPDATE",[$marker]);
 foreach($rows as $row){$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key=?')->execute(['s:'.$row['submission_id']]);$p->prepare("DELETE FROM community_submissions WHERE submission_id=? AND review_status='pending'")->execute([$row['submission_id']]);}
 $p->commit();echo 'Removed '.count($rows)." pending test proposals.\n";
}catch(Throwable $e){$p->rollBack();throw $e;}
