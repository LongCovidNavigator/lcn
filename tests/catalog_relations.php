<?php
require_once __DIR__.'/../api/_submission_review.php';
require_once __DIR__.'/../api/_treatments_nd.php';
$p=lcnDoctorDatabase();$p->beginTransaction();
try {
 $doctor=613;
 $therapy=(int)$p->query("SELECT t.treat_nd_id FROM tbl_treatments_nd t WHERE NOT EXISTS(SELECT 1 FROM tbl_cpl_entities2treatments_nd c WHERE c.treat_nd_id=t.treat_nd_id AND c.lcn_id=613) LIMIT 1")->fetchColumn();
 $relation=['action'=>'add','doctor_id'=>$doctor,'treatment_id'=>$therapy];
 $payload=['relationship'=>$relation];
 $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key) VALUES('doctor',?,'change','Transactional relation test','',?,?)")->execute([$doctor,json_encode($payload),bin2hex(random_bytes(32))]);
 $submission=(int)$p->lastInsertId();$row=['submission_id'=>$submission,'existing_target_id'=>$doctor];
 $count=function()use($p,$doctor,$therapy){return count(lcnNdRows($p,'SELECT id FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=?',[$doctor,$therapy]));};
 if($count()!==0)throw new RuntimeException('Pending submission changed the live association.');
 lcnApproveDoctorSubmission($p,$row,$payload);
 if($count()!==1)throw new RuntimeException('Approved relation was not added.');
 lcnApproveDoctorSubmission($p,$row,$payload);
 if($count()!==1)throw new RuntimeException('Duplicate relation created.');
 $payload['relationship']['action']='remove';
 lcnApproveDoctorSubmission($p,$row,$payload);
 if($count()!==0)throw new RuntimeException('Approved report did not remove relation.');
 $saved=lcnNdRows($p,'SELECT payload FROM community_submissions WHERE submission_id=?',[$submission])[0];
 if(empty(json_decode($saved['payload'],true)['removed_relations']))throw new RuntimeException('Removal history missing.');
 try{lcnApplyCatalogRelation($p,['submission_id'=>$submission,'existing_target_id'=>999999],['relationship'=>$relation]);throw new RuntimeException('Wrong owner accepted.');}catch(DomainException $expected){}
 echo "PASS: pending relations do not alter catalog; approval adds once; approved removal archives old rows; owner validation. Transaction rolled back.\n";
}finally{$p->rollBack();}
