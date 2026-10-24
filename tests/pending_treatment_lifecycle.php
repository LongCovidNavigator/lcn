<?php
require_once __DIR__.'/../api/_pending_treatments.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
function pendingAssert($ok,$message){if(!$ok)throw new RuntimeException($message);}
try{
 $name='Lifecycle '.bin2hex(random_bytes(6));$payload=['treatment_category'=>'Arzneimittel'];
 $insert=$p->prepare("INSERT INTO community_submissions(entity_type,submission_kind,name,payload,submitter_key) VALUES('treatment','new',?,?,?)");$insert->execute([$name,json_encode($payload),hash('sha256',$name)]);$sid=(int)$p->lastInsertId();
 $id=lcnPublishPendingTreatment($p,$sid,$name,$payload);
 pendingAssert($id===lcnPublishPendingTreatment($p,$sid,$name,$payload),'Repeated publication duplicated target');
 $g=lcnTreatmentDiscoveryGraph($p);pendingAssert(!empty($g['entries'][$id]['review_pending']),'Pending target not selectable');
 $source=(int)$p->query("SELECT treat_nd_id FROM tbl_treatments_nd WHERE treat_nd_id<>$id AND review_status<>'rejected_group' LIMIT 1")->fetchColumn();
 $r=lcnNormalizeTreatmentRelationship($p,['source_id'=>$source,'kind'=>'alternative','target_id'=>$id]);
 $insert->execute(['Dependent '.$name,json_encode(['treatment_relationship'=>$r]),hash('sha256',$name)]);$dependent=(int)$p->lastInsertId();
 $p->prepare('INSERT INTO tbl_cpl_treatments_nd_relations(source_treat_nd_id,target_treat_nd_id,target_label) VALUES(?,?,?)')->execute([$source,$id,$name]);
 $row=lcnNdRows($p,'SELECT * FROM community_submissions WHERE submission_id=?',[$sid])[0];
 lcnRejectPendingTreatment($p,$row);
 pendingAssert(!isset(lcnTreatmentDiscoveryGraph($p)['entries'][$id]),'Rejected target remains selectable');
 pendingAssert(!lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd_relations WHERE target_treat_nd_id=?',[$id]),'Dangling link remains');
 pendingAssert(lcnNdRows($p,'SELECT review_status FROM community_submissions WHERE submission_id=?',[$dependent])[0]['review_status']==='rejected','Dependent proposal still visible');
 echo "PASS: immediate selectable IDs, idempotence, pending status, rejection removes navigation and dependent links. All changes rolled back.\n";
}finally{$p->rollBack();}
