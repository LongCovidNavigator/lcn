<?php
require_once __DIR__.'/_treatments_nd.php';

function lcnValidateCatalogRelation(PDO $p,int $doctor,int $treatment,string $action): void {
 if(!in_array($action,['add','remove'],true)||!lcnDoctorExists($doctor)||!lcnNdRows($p,'SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?',[$treatment]))throw new InvalidArgumentException('Ungültige Zuordnung.');
 if($action==='remove'&&!lcnNdRows($p,"SELECT 1 FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=? AND relation_status IN ('bestand','belegt')",[$doctor,$treatment]))throw new InvalidArgumentException('Diese Zuordnung ist nicht vorhanden.');
}

function lcnApplyCatalogRelation(PDO $p,array $row,array $payload): int {
 $relation=$payload['relationship'];$doctor=(int)$relation['doctor_id'];$treatment=(int)$relation['treatment_id'];$action=$relation['action'];
 if((int)($row['existing_target_id']??0)!==$doctor)throw new DomainException('Die gemeldete Zuordnung passt nicht zum Behandler.');
 lcnValidateCatalogRelation($p,$doctor,$treatment,$action);
 if($action==='remove'){
  $payload['removed_relations']=lcnNdRows($p,'SELECT * FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=?',[$doctor,$treatment]);
  $p->prepare('UPDATE community_submissions SET payload=? WHERE submission_id=?')->execute([json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$row['submission_id']]);
  $p->prepare('DELETE FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=?')->execute([$doctor,$treatment]);
 }else{
  $existing=lcnNdRows($p,'SELECT id FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=?',[$doctor,$treatment]);
  if($existing)$p->prepare("UPDATE tbl_cpl_entities2treatments_nd SET relation_status='belegt',note=CONCAT_WS('\n',note,?) WHERE lcn_id=? AND treat_nd_id=?")->execute(['Geprüfte Community-Zuordnung #'.$row['submission_id'],$doctor,$treatment]);
  else $p->prepare("INSERT INTO tbl_cpl_entities2treatments_nd(lcn_id,treat_nd_id,anbieter_label,dedupe_hash,relation_status,note) SELECT ?,?,anzeigename,SHA2(CONCAT('provider:',?),256),'belegt',? FROM tbl_entities_nd WHERE lcn_id=?")->execute([$doctor,$treatment,$doctor,'Geprüfte Community-Zuordnung #'.$row['submission_id'],$doctor]);
 }
 return $doctor;
}
