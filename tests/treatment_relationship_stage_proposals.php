<?php
require_once __DIR__.'/../api/_treatment_relationship_proposals.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $ids=[];$suffix=bin2hex(random_bytes(6));foreach(['Basis','Variante','Verfahren','Detail'] as $name){$p->prepare('INSERT INTO tbl_treatments_nd(treatmentname,typ) VALUES(?,?)')->execute(['Stufentest '.$name.' '.$suffix,'Selbstmanagement und Alltag']);$ids[]=(int)$p->lastInsertId();}
 foreach([[$ids[0],$ids[1],'has_variant','variant_of','substance_variant'],[$ids[2],$ids[3],'has_detail','detail_of','detailed_method']] as [$parent,$child,$forward,$reverse,$type]){
  $a=lcnNormalizeTreatmentRelationship($p,['source_id'=>$parent,'kind'=>$forward,'target_id'=>$child]);$b=lcnNormalizeTreatmentRelationship($p,['source_id'=>$child,'kind'=>$reverse,'target_id'=>$parent]);if($a['signature']!==$b['signature'])throw new Exception('Direction mismatch');
  $payload=['treatment_relationship'=>$a];$p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,payload,submitter_key) VALUES('treatment',?,'change',?,?,?)")->execute([$parent,'Transaktionstest '.$suffix,json_encode($payload),hash('sha256',$suffix)]);$row=['submission_id'=>(int)$p->lastInsertId(),'existing_target_id'=>$parent];
  lcnApproveTreatmentRelationship($p,$row,$payload);lcnApproveTreatmentRelationship($p,$row,$payload);
  $g=lcnTreatmentDiscoveryGraph($p);$matches=array_filter($g['groups'],fn($group)=>$group['root']===$parent&&isset($group['members'][$child])&&$group['relation_type']==='umbrella_term'&&lcnGroupMemberRelation($group,$child)===$type);if(count($matches)!==1)throw new Exception('Typed coupling not stored under unchanged umbrella alias');
  if(!lcnTreatmentRelationshipContextAllows($g,$parent,$child)||lcnTreatmentRelationshipContextAllows($g,$parent,84))throw new Exception('Incorrect context validation');
  $failed=false;try{lcnNormalizeTreatmentRelationship($p,['source_id'=>$child,'kind'=>$forward,'target_id'=>$parent]);}catch(InvalidArgumentException $e){$failed=true;}if(!$failed)throw new Exception('Cycle accepted');
 }
 echo "PASS variants and detailed procedures: reverse directions, moderated approval, idempotence, context and cycles; rolled back.\n";
}finally{$p->rollBack();}
