<?php
require_once __DIR__.'/_catalog_relations.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try {
 $p=lcnDoctorDatabase();$write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){
  lcnRequireVotingRequest();$input=lcnReadJsonBody();$doctor=filter_var($input['doctor_id']??null,FILTER_VALIDATE_INT);$treatment=filter_var($input['treatment_id']??null,FILTER_VALIDATE_INT);$action=(string)($input['action']??'');
  lcnValidateCatalogRelation($p,(int)$doctor,(int)$treatment,$action);
  $respondent=lcnVoterKey();lcnBeginVoteSecurity($p,'doctor',(int)$doctor,'neutral',$respondent);
  $note=trim((string)($input['note']??''));if(mb_strlen($note)>2000)throw new InvalidArgumentException('Der Hinweis ist zu lang.');
  $pending=lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE submitter_key=? AND existing_target_id=? AND entity_type='doctor' AND review_status IN ('pending','reviewing')",[$respondent,$doctor]);
  foreach($pending as $r){$relation=(json_decode($r['payload'],true)['relationship']??[]);if(is_array($relation)&&($relation['action']??'')===$action&&(int)($relation['treatment_id']??0)===$treatment)lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$r['submission_id'],'duplicate'=>true]);}
  $recent=lcnNdRows($p,'SELECT COUNT(*) n FROM community_submissions WHERE submitter_key=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)',[$respondent]);if((int)$recent[0]['n']>=10)lcnSendVoteJson(['ok'=>false,'error'=>'Zu viele Vorschläge in kurzer Zeit. Bitte versuche es später erneut.'],429);
  $dr=lcnNdRows($p,'SELECT anzeigename,website FROM tbl_entities_nd WHERE lcn_id=?',[$doctor])[0];$therapy=lcnNdRows($p,'SELECT treatmentname FROM tbl_treatments_nd WHERE treat_nd_id=?',[$treatment])[0];
  $payload=['type'=>'doctor','existing_target_id'=>$doctor,'name'=>$dr['anzeigename'],'relationship'=>['action'=>$action,'doctor_id'=>(int)$doctor,'treatment_id'=>(int)$treatment,'doctor_name'=>$dr['anzeigename'],'treatment_name'=>$therapy['treatmentname']],'review_note'=>$note];
  $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key,triage_status,triage_score,triage_reasons) VALUES('doctor',?,'change',?,?,?,?,'needs_review',0,?)")->execute([$doctor,$dr['anzeigename'],$dr['website']??'',json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$respondent,json_encode([$action==='add'?'Behandlungsangebot ergänzen':'Gemeldetes Behandlungsangebot prüfen'],JSON_UNESCAPED_UNICODE)]);
  lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$p->lastInsertId()],201);
 }
 $type=$_GET['type']??'';$id=(int)($_GET['id']??0);
 if($type==='treatment'&&lcnNdRows($p,'SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?',[$id])){
  $items=lcnNdRows($p,"SELECT e.lcn_id id,e.anzeigename name,COALESCE(l.loc_city,'') meta,l.loc_plz,l.loc_city,l.loc_lat,l.loc_lng FROM tbl_entities_nd e LEFT JOIN tbl_drs_locations_03 l ON l.loc_id=(SELECT loc_id FROM tbl_drs_locations_03 WHERE dr_id=e.lcn_id ORDER BY loc_is_primary DESC,loc_id LIMIT 1) WHERE e.aktiv=1 ORDER BY e.anzeigename");
  $linked=array_column(lcnNdRows($p,"SELECT DISTINCT lcn_id id FROM tbl_cpl_entities2treatments_nd WHERE treat_nd_id=? AND lcn_id IS NOT NULL AND relation_status IN ('bestand','belegt')",[$id]),'id');
 }elseif($type==='doctor'&&lcnDoctorExists($id)){
  $items=lcnNdRows($p,"SELECT treat_nd_id id,treatmentname name,COALESCE(typ,'') meta FROM tbl_treatments_nd ORDER BY treatmentname");
  $linked=array_column(lcnNdRows($p,"SELECT DISTINCT treat_nd_id id FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND relation_status IN ('bestand','belegt')",[$id]),'id');
 }else throw new InvalidArgumentException('Eintrag nicht gefunden.');
 foreach($items as &$item)$item['id']=(int)$item['id'];unset($item);
  $pending=[];$viewer=lcnExistingVoterKey();
 foreach(lcnNdRows($p,"SELECT submission_id,entity_type,existing_target_id,name,payload,submitter_key FROM community_submissions WHERE review_status IN ('pending','reviewing') ORDER BY submission_id") as $submission){
  $payload=json_decode($submission['payload'],true)?:[];$relation=$payload['relationship']??null;$match=false;$other=null;$name='';
  if(is_array($relation)&&($relation['action']??'')==='add'&&(($type==='doctor'&&(int)$relation['doctor_id']===$id)||($type==='treatment'&&(int)$relation['treatment_id']===$id))){$other=(int)$relation[$type==='doctor'?'treatment_id':'doctor_id'];$name=(string)($relation[$type==='doctor'?'treatment_name':'doctor_name']??'');$match=true;}
  elseif($type==='treatment'&&$submission['entity_type']==='doctor'&&in_array($id,array_map('intval',$payload['treatment_ids']??[]),true)){$other=(int)$submission['existing_target_id']?:null;$name=$submission['name'];$match=true;}
  elseif($type==='doctor'&&$submission['entity_type']==='treatment'&&in_array($id,array_map('intval',$payload['doctor_ids']??[]),true)){$other=(int)$submission['existing_target_id']?:null;$name=$submission['name'];$match=true;}
  if(!$match||($other&&in_array($other,array_map('intval',$linked),true)))continue;
  $key=$other?'id:'.$other:'name:'.mb_strtolower($name);$own=$viewer!==null&&hash_equals((string)$submission['submitter_key'],$viewer);
  if(isset($pending[$key])){$pending[$key]['own']=$pending[$key]['own']||$own;continue;}
  $pending[$key]=['submission_id'=>(int)$submission['submission_id'],'id'=>$other,'name'=>$name,'own'=>$own];
 }
 if($type==='doctor'){
  require_once __DIR__.'/_doctor_treatment_ratings.php';
  foreach($pending as &$proposal){if(!$proposal['id'])continue;
   $rows=lcnNdRows($p,'SELECT t.treat_id,t.behandlung,t.typ,t.unterkategorie,(SELECT COUNT(DISTINCT c.dr_id) FROM v_lcn_provider_treatments c WHERE c.treat_id=t.treat_id) AS provider_total FROM v_lcn_treatments t WHERE t.treat_id=?',[$proposal['id']]);
   if(!$rows)continue;$proposal['details']=lcnApplyDoctorTreatmentRatings($p,$rows)[0];
   $examples=lcnNdRows($p,'SELECT * FROM treatment_experience_dummy_counts WHERE treat_id=?',[$proposal['id']]);$proposal['dummy_example']=$examples?array_map('intval',$examples[0]):null;
  }unset($proposal);
 } lcnSendVoteJson(['ok'=>true,'items'=>$items,'linked'=>array_map('intval',$linked),'pending'=>array_values($pending)]);
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){lcnLogApiError('catalog_relations',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Der Vorschlag konnte nicht gespeichert oder geladen werden.'],500);}
