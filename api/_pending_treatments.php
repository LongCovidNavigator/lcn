<?php
require_once __DIR__.'/_treatment_relationship_proposals.php';
/** Publish a new proposal under a stable ID, without approving it. Caller owns transaction. */
function lcnPublishPendingTreatment(PDO $p, int $sid, string $name, array $payload): int {
 $rows=lcnNdRows($p,"SELECT treat_nd_id FROM tbl_treatments_nd WHERE LOWER(TRIM(treatmentname))=LOWER(TRIM(?)) AND review_status<>'rejected_group' ORDER BY treat_nd_id LIMIT 1",[$name]);
 if($rows)$id=(int)$rows[0]['treat_nd_id'];
 else {
  $p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ,legacy_match_status,review_status,datenstand,notes_internal) VALUES(?,?,'new','pending_group',CURRENT_DATE,?)")->execute([$name,$payload['treatment_category']??null,'Community-Vorschlag #'.$sid]);$id=(int)$p->lastInsertId();
  $alias=lcnTreatmentProposalAlias($p,$name,'primary_name');
  $p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,note) VALUES(?,?,?)')->execute([$id,$alias,'Community-Vorschlag #'.$sid]);
 }
 $p->prepare('UPDATE community_submissions SET existing_target_id=? WHERE submission_id=?')->execute([$id,$sid]);
 return $id;
}
/** Remove rejected provisional targets from navigation and cancel dependent proposals. */
function lcnRejectPendingTreatment(PDO $p,array $row): void {
 $payload=json_decode($row['payload']??'{}',true)??[];$relation=$payload['treatment_relationship']??[];
 $id=0;
 if(($row['submission_kind']??'')==='new'&&!$relation)$id=(int)($row['existing_target_id']??0);
 if(($relation['kind']??'')==='group'){
  $name=$relation['group_name']??'';
  foreach(lcnNdRows($p,"SELECT payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing') AND submission_id<>?",[(int)$row['submission_id']]) as $open){$r=json_decode($open['payload'],true)['treatment_relationship']??[];if(($r['kind']??'')==='group'&&lcnDiscoveryName($r['group_name']??'')===lcnDiscoveryName($name))return;}
  $matches=lcnNdRows($p,"SELECT treat_nd_id FROM tbl_treatments_nd WHERE treatmentname=? AND review_status='pending_group'",[$name]);$id=(int)($matches[0]['treat_nd_id']??0);
 }
 if(!$id)return;
 $target=lcnNdRows($p,"SELECT treatmentname FROM tbl_treatments_nd WHERE treat_nd_id=? AND review_status='pending_group' FOR UPDATE",[$id]);if(!$target)return;
 $name=$target[0]['treatmentname'];
 $aliases=array_column(lcnNdRows($p,"SELECT a.alias_id FROM tbl_aliases_03 a WHERE a.alias=? AND a.alias_type IN ('umbrella_term','application_form','substance_variant','detailed_method','combination_definition','combination_component','generic_name','trade_name')",[$name]),'alias_id');
 foreach($aliases as $alias)$p->prepare('DELETE FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=?')->execute([$alias]);
 $p->prepare('DELETE FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=?')->execute([$id]);
 $p->prepare('DELETE FROM tbl_cpl_treatments_nd_relations WHERE source_treat_nd_id=? OR target_treat_nd_id=?')->execute([$id,$id]);
 $p->prepare('DELETE FROM tbl_cpl_entities2treatments_nd WHERE treat_nd_id=?')->execute([$id]);
 foreach(lcnNdRows($p,"SELECT submission_id,existing_target_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing')") as $open){
  $data=json_decode($open['payload'],true)??[];$r=$data['treatment_relationship']??[];
  $refs=array_merge([(int)$open['existing_target_id'],(int)($r['source_id']??0),(int)($r['left_id']??0),(int)($r['right_id']??0),(int)($r['context_id']??0)],$r['component_ids']??[],$data['treatment_ids']??[]);
  $depends=in_array($id,array_map('intval',$refs),true)||in_array((int)($r['group_alias_id']??0),array_map('intval',$aliases),true)||(($r['kind']??'')==='group'&&lcnDiscoveryName($r['group_name']??'')===lcnDiscoveryName($name));
  if($depends){$p->prepare("UPDATE community_submissions SET review_status='rejected',reviewed_at=NOW(),reviewer_note='Zugehöriger vorläufiger Eintrag wurde entfernt.' WHERE submission_id=?")->execute([$open['submission_id']]);$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key=?')->execute(['s:'.$open['submission_id']]);}
 }
 // Remove provider proposals and embedded selections referring to the removed therapy.
 foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='doctor' AND review_status IN ('pending','reviewing')") as $open){
  $data=json_decode($open['payload'],true)??[];
  if((int)($data['relationship']['treatment_id']??0)===$id){$p->prepare("UPDATE community_submissions SET review_status='rejected',reviewed_at=NOW(),reviewer_note='Zugehörige Therapie wurde entfernt.' WHERE submission_id=?")->execute([$open['submission_id']]);continue;}
  if(in_array($id,array_map('intval',$data['treatment_ids']??[]),true)){$data['treatment_ids']=array_values(array_filter($data['treatment_ids'],fn($value)=>(int)$value!==$id));$p->prepare('UPDATE community_submissions SET payload=? WHERE submission_id=?')->execute([json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$open['submission_id']]);}
 }
 $p->prepare("UPDATE tbl_treatments_nd SET review_status='rejected_group' WHERE treat_nd_id=?")->execute([$id]);
}
