<?php
require_once __DIR__.'/_treatments_nd.php';require_once __DIR__.'/_voting.php';require_once __DIR__.'/_treatment_symptom_help.php';require_once __DIR__.'/_doctor_symptom_help.php';
function lcnRegisterHelpfulSymptom(PDO $p,string $type,int $id,string $name,string $user): int {
 $q=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE LOWER(TRIM(sym_name))=LOWER(?) LIMIT 1');$q->execute([$name]);$sym=(int)$q->fetchColumn();
 if(!$sym){$p->prepare('INSERT INTO tbl_symptoms(sym_name) VALUES(?)')->execute([$name]);$sym=(int)$p->lastInsertId();}
 if($type==='doctor')lcnSaveDoctorSymptomHelp($p,$id,$sym,$user,true);else lcnSaveTreatmentSymptomHelp($p,$id,$sym,$user,true);return $sym;
}
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 header('Cache-Control: no-store');
 try{$p=lcnDoctorDatabase();$type=$_GET['type']??'';$id=(int)($_GET['id']??0);if(!in_array($type,['doctor','treatment'],true)||$id<1)throw new InvalidArgumentException();
 $q=$p->prepare("SELECT submission_id,payload FROM community_submissions WHERE entity_type=? AND existing_target_id=? AND review_status IN ('pending','reviewing') ORDER BY submission_id");$q->execute([$type,$id]);$items=[];$seen=[];
 foreach($q as $row){$payload=json_decode($row['payload'],true);$name=trim((string)($payload['symptom_proposal']??''));$key=mb_strtolower($name);if($name===''||isset($payload['registered_symptom_id'])||isset($seen[$key]))continue;$seen[$key]=true;$items[]=['id'=>(int)$row['submission_id'],'name'=>$name];}
 lcnSendVoteJson(['ok'=>true,'pending'=>$items]);}catch(Throwable $e){lcnSendVoteJson(['ok'=>false,'error'=>'Vorschläge konnten nicht geladen werden.'],400);}
}
lcnRequireVotingRequest();
try{
 $p=lcnDoctorDatabase();$in=lcnReadJsonBody();$type=$in['type']??'';$id=(int)($in['id']??0);$name=trim((string)($in['name']??''));
 if(($in['action']??'')==='activate_own_pending'){
  if(!in_array($type,['doctor','treatment'],true)||$id<1)throw new InvalidArgumentException('Ungültiger Eintrag.');
  $user=lcnVoterKey();$p->beginTransaction();
  $q=$p->prepare("SELECT submission_id,payload FROM community_submissions WHERE entity_type=? AND existing_target_id=? AND submitter_key=? AND review_status IN ('pending','reviewing') FOR UPDATE");$q->execute([$type,$id,$user]);
  foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row){$payload=json_decode($row['payload'],true);$name=trim((string)($payload['symptom_proposal']??''));if($name===''||isset($payload['registered_symptom_id']))continue;$payload['registered_symptom_id']=lcnRegisterHelpfulSymptom($p,$type,$id,$name,$user);$p->prepare('UPDATE community_submissions SET payload=? WHERE submission_id=?')->execute([json_encode($payload,JSON_UNESCAPED_UNICODE),$row['submission_id']]);}
  $p->commit();lcnSendVoteJson(['ok'=>true]);
 }

 if(!in_array($type,['doctor','treatment'],true)||mb_strlen($name)<2||mb_strlen($name)>100)throw new InvalidArgumentException('Bitte einen Symptomnamen mit 2 bis 100 Zeichen eingeben.');
 $q=$p->prepare($type==='doctor'?'SELECT anzeigename FROM tbl_entities_nd WHERE lcn_id=? AND aktiv=1':'SELECT treatmentname FROM tbl_treatments_nd WHERE treat_nd_id=?');$q->execute([$id]);$target=$q->fetchColumn();if(!$target)throw new InvalidArgumentException('Eintrag nicht gefunden.');
 $user=lcnVoterKey();$q=$p->prepare('SELECT COUNT(*) FROM community_submissions WHERE submitter_key=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)');$q->execute([$user]);if($q->fetchColumn()>=10)lcnSendVoteJson(['ok'=>false,'error'=>'Bitte versuche es später erneut.'],429);
 $p->beginTransaction();$symptom=lcnRegisterHelpfulSymptom($p,$type,$id,$name,$user);
 $payload=['registered_symptom_id'=>$symptom,'type'=>$type,'existing_target_id'=>$id,'name'=>$target,'symptom_proposal'=>$name];
 $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key,triage_status,triage_score,triage_reasons) VALUES(?,?,'change',?,'',?,?,'needs_review',0,?)")->execute([$type,$id,$target,json_encode($payload,JSON_UNESCAPED_UNICODE),$user,json_encode(['Neues Symptom prüfen: '.$name],JSON_UNESCAPED_UNICODE)]);
 $p->commit();lcnSendVoteJson(['ok'=>true,'symptom_id'=>$symptom]);
}catch(InvalidArgumentException $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnLogApiError('symptom_proposal',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Der Vorschlag konnte nicht gespeichert werden.'],500);}
