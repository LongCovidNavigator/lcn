<?php
require_once __DIR__.'/_treatments_nd.php';
function lcnApproveSymptomProposal(PDO $p,array $row,array $payload): int {
 $name=trim((string)($payload['symptom_proposal']??''));$target=(int)$row['existing_target_id'];
 if($name===''||mb_strlen($name)>100||!$target)throw new DomainException('Ungültiger Symptomvorschlag.');
 $q=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE LOWER(TRIM(sym_name))=LOWER(?) LIMIT 1');$q->execute([$name]);$sym=$q->fetchColumn();
 if(!$sym){$p->prepare('INSERT INTO tbl_symptoms(sym_name) VALUES(?)')->execute([$name]);$sym=(int)$p->lastInsertId();}
 $doctor=$row['entity_type']==='doctor';$table=$doctor?'tbl_doctor_symptom_help_links':'tbl_treatment_symptom_help_links';$key=$doctor?'dr_id':'treat_nd_id';
 $p->prepare("INSERT INTO $table($key,sym_id) VALUES(?,?) ON DUPLICATE KEY UPDATE sym_id=VALUES(sym_id)")->execute([$target,$sym]);return $target;
}
