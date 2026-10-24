<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_submission_review.php';
function proposalCheck(bool $ok,string $message): void { if(!$ok)throw new RuntimeException($message); }
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $suffix=bin2hex(random_bytes(5));$ids=[];
 foreach(['Wirkstoff','Handelsname','Anwendungsform','Kombination'] as $name){$p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ) VALUES(?,'Arzneimittel')")->execute(['Test '.$name.' '.$suffix]);$ids[]=(int)$p->lastInsertId();}
 [$generic,$brand,$form,$combo]=$ids;
 foreach([
  [['source_id'=>$brand,'kind'=>'trade_of','target_id'=>$generic],['source_id'=>$generic,'kind'=>'has_trade','target_id'=>$brand]],
  [['source_id'=>$form,'kind'=>'form_of','target_id'=>$generic],['source_id'=>$generic,'kind'=>'has_form','target_id'=>$form]],
  [['source_id'=>$generic,'kind'=>'component_of','target_id'=>$combo],['source_id'=>$combo,'kind'=>'has_component','target_id'=>$generic]]
 ] as [$a,$b])proposalCheck(lcnNormalizeTreatmentRelationship($p,$a)['signature']===lcnNormalizeTreatmentRelationship($p,$b)['signature'],'Opposite input directions are not equivalent.');
 $member=lcnNormalizeTreatmentRelationship($p,['source_id'=>176,'kind'=>'group_contains','target_id'=>$generic,'group_alias_id'=>1329]);
 proposalCheck($member['kind']==='group'&&$member['left_id']===$generic,'Group member direction reversed.');
 $cases=[
  ['source_id'=>$generic,'kind'=>'alternative','target_id'=>$form],
  ['source_id'=>$generic,'kind'=>'belongs_to_group','group_name'=>'Testgruppe '.$suffix],
  ['source_id'=>$brand,'kind'=>'trade_of','target_id'=>$generic],
  ['source_id'=>$form,'kind'=>'form_of','target_id'=>$generic],
  ['source_id'=>$combo,'kind'=>'has_component','target_id'=>$generic]
 ];
 foreach($cases as $in){
  $r=lcnNormalizeTreatmentRelationship($p,$in);$source=$in['source_id'];$payload=['treatment_relationship'=>$r,'review_note'=>'Nur Transaktionstest'];
  $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key) VALUES('treatment',?,'change',?,'',?,?)")->execute([$source,'Verknüpfungstest '.$suffix,json_encode($payload),hash('sha256',$suffix)]);
  $sid=(int)$p->lastInsertId();$row=['submission_id'=>$sid,'existing_target_id'=>$source,'entity_type'=>'treatment'];
  $user=hash('sha256','proposal-feedback-'.$suffix);$p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute(['s:'.$sid,$user]);
  $before=lcnTreatmentAliasNavigation(lcnTreatmentDiscoveryGraph($p),$source);
  proposalCheck(lcnApproveTreatmentSubmission($p,$row,$payload)===$source,'Wrong approval target.');
  $graph=lcnTreatmentDiscoveryGraph($p);
  if($r['kind']==='alternative')proposalCheck(count(lcnNdRows($p,'SELECT relation_id FROM tbl_cpl_treatments_nd_relations WHERE source_treat_nd_id=? AND target_treat_nd_id=?',[$generic,$form]))===1,'Alternative missing.');
  if($r['kind']==='group')proposalCheck(count(array_filter($graph['groups'],fn($g)=>$g['name']===$r['group_name']&&isset($g['members'][$generic])))===1,'Group membership missing.');
  if($r['kind']==='brand')proposalCheck(isset($graph['brands'][$generic][$brand]),'Brand missing.');
  if($r['kind']==='form')proposalCheck(count(array_filter($graph['groups'],fn($g)=>$g['root']===$generic&&$g['forms']&&isset($g['members'][$form])))===1,'Explicit application form missing.');
  if($r['kind']==='component')proposalCheck(isset($graph['components'][$combo][$generic]),'Explicit component missing.');
  proposalCheck(count(lcnNdRows($p,"SELECT relation_key FROM catalog_relation_feedback WHERE respondent_key=? AND relation_key NOT LIKE 's:%'",[$user]))>=1,'Proposal votes not migrated.');
  lcnApproveTreatmentSubmission($p,$row,$payload); // Re-applying must not duplicate couplings or relations.
 }
 // Combinations are valid umbrella-group members and remain visible after approval.
 $comboGroup=lcnNormalizeTreatmentRelationship($p,['source_id'=>$generic,'kind'=>'group_contains','target_id'=>$combo,'group_name'=>'Kombinationsgruppe '.$suffix]);
 proposalCheck($comboGroup['left_id']===$combo,'Combination group member rejected.');
 $proposedId=lcnEnsureProposedTreatmentGroup($p,$comboGroup,$sid);
 proposalCheck($proposedId===lcnEnsureProposedTreatmentGroup($p,$comboGroup,$sid),'Duplicate provisional group created.');
 proposalCheck(lcnNdRows($p,'SELECT review_status FROM tbl_treatments_nd WHERE treat_nd_id=?',[$proposedId])[0]['review_status']==='pending_group','Provisional group approved too early.');
 proposalCheck(count(lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=?',[$proposedId]))===2,'Provisional name/group aliases missing.');
 $comboGroupPayload=['treatment_relationship'=>$comboGroup];
 lcnApproveTreatmentRelationship($p,['submission_id'=>$sid,'existing_target_id'=>$generic],$comboGroupPayload);
 $afterGroup=lcnTreatmentDiscoveryGraph($p);
 proposalCheck(count(array_filter($afterGroup['groups'],fn($group)=>$group['name']==='Kombinationsgruppe '.$suffix&&isset($group['members'][$combo])))===1,'Approved combination hidden from group.');
 $singular='Gruppenprobe '.$suffix.' Blutwäsche';$plural=$singular.'n';
 $p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ) VALUES(?,'Medizinische Prozeduren')")->execute([$singular]);$singularId=(int)$p->lastInsertId();
 $pluralRelation=['kind'=>'group','group_name'=>$plural,'group_alias_id'=>0,'source_id'=>$generic];
 $pluralId=lcnEnsureProposedTreatmentGroup($p,$pluralRelation,$sid);
 $groupDuplicate=lcnTreatmentGroupDuplicate($p,$pluralRelation);
 proposalCheck(($groupDuplicate['id']??0)===$singularId,'Singular/plural group duplicate not detected or self matched.');
 proposalCheck($groupDuplicate['id']!==$pluralId,'Provisional group matched itself.');
 $pairs=lcnNdRows($p,'SELECT treat_nd_id,alias_id,COUNT(*) n FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id IN (?,?,?,?) GROUP BY treat_nd_id,alias_id HAVING COUNT(*)>1',$ids);
 proposalCheck(!$pairs,'Duplicate alias couplings.');
 foreach([['source_id'=>$generic,'kind'=>'has_trade','target_id'=>$brand],['source_id'=>$combo,'kind'=>'has_component','target_id'=>$generic],['source_id'=>$form,'kind'=>'form_of','target_id'=>$generic],['source_id'=>$generic,'kind'=>'alternative','target_id'=>$generic],['source_id'=>$generic,'kind'=>'unknown','target_id'=>$form]] as $invalid){$failed=false;try{lcnNormalizeTreatmentRelationship($p,$invalid);}catch(InvalidArgumentException $e){$failed=true;}proposalCheck($failed,'Invalid/duplicate proposal accepted.');}
 echo "PASS: pending records, all five relation families, authenticated approval dispatch, explicit forms/components, feedback migration, idempotence and validation. All changes rolled back.\n";
}finally{$p->rollBack();}
