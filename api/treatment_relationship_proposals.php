<?php
require_once __DIR__.'/_treatment_relationship_proposals.php';
require_once __DIR__.'/_voting.php';require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try{
 $p=lcnTreatmentsNdDatabase();$write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$in=lcnReadJsonBody();$id=(int)($in['source_id']??0);}else $id=(int)($_GET['id']??0);
 $g=lcnTreatmentDiscoveryGraph($p);if(!isset($g['entries'][$id]))throw new InvalidArgumentException('Therapie nicht gefunden.');
 if($write){
  $r=lcnNormalizeTreatmentRelationship($p,$in,$g);$context=(int)($in['context_id']??$id);
  if(!lcnTreatmentRelationshipContextAllows($g,$context,$id))throw new InvalidArgumentException('Die Verknüpfung passt nicht zur geöffneten Seite.');
  $r['context_id']=$context;$note=trim((string)($in['note']??''));$url=trim((string)($in['source_url']??''));
  if(mb_strlen($note)>2000||mb_strlen($url)>1000)throw new InvalidArgumentException('Hinweis oder Quellenadresse ist zu lang.');
  if($url!==''&&(!filter_var($url,FILTER_VALIDATE_URL)||!in_array(strtolower(parse_url($url,PHP_URL_SCHEME)??''),['http','https'],true)))throw new InvalidArgumentException('Bitte eine vollständige http(s)-Quellenadresse eingeben.');
  $user=lcnVoterKey();
  foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing')") as $row){$existing=json_decode($row['payload'],true)['treatment_relationship']??[];if(($existing['signature']??'')===$r['signature'])lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$row['submission_id'],'duplicate'=>true]);}
  $recent=lcnNdRows($p,'SELECT COUNT(*) n FROM community_submissions WHERE submitter_key=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)',[$user]);if((int)$recent[0]['n']>=10)lcnSendVoteJson(['ok'=>false,'error'=>'Zu viele Vorschläge in kurzer Zeit. Bitte versuche es später erneut.'],429);
  lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$user);
  $payload=['type'=>'treatment','existing_target_id'=>$id,'name'=>$r['kind']==='new_combination'?$r['name']:$g['entries'][$id]['treatmentname'],'treatment_relationship'=>$r,'review_note'=>$note,'source_url'=>$url];
  $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key,triage_status,triage_score,triage_reasons) VALUES('treatment',?,'change',?,?,?,?, 'needs_review',0,?)")->execute([$id,$payload['name'],$url,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$user,json_encode(['Therapieverknüpfung prüfen: '.$r['description']],JSON_UNESCAPED_UNICODE)]);
  lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$p->lastInsertId()],201);
 }
 $pending=[];foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing') ORDER BY submission_id") as $row){$r=json_decode($row['payload'],true)['treatment_relationship']??null;if(!is_array($r))continue;
  $groupRoot=$g['groups'][(int)($r['group_alias_id']??0)]['root']??null;
  if(!in_array($id,array_merge([(int)$r['source_id'],(int)$r['left_id'],(int)$r['right_id'],(int)($r['context_id']??0),$groupRoot],$r['component_ids']??[]),true))continue;
  $pending[]=['submission_id'=>(int)$row['submission_id'],'description'=>$r['description'],'kind'=>$r['kind'],'combination'=>$r['kind']==='new_combination'?['name'=>$r['name'],'component_ids'=>array_values($r['component_ids'])]:null];
 }
 $items=[];foreach($g['entries'] as $entry)$items[]=['id'=>$entry['treat_nd_id'],'name'=>$entry['treatmentname'],'meta'=>$entry['typ']??'','is_combination'=>isset($g['comboIds'][$entry['treat_nd_id']])];
 usort($items,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
 $groups=[];foreach($g['groups'] as $group)$groups[]=['id'=>$group['alias_id'],'name'=>$group['name'],'meta'=>$group['forms']?'Anwendungsformen':'Gruppe'];
 lcnSendVoteJson(['ok'=>true,'items'=>$items,'groups'=>$groups,'kinds'=>LCN_TREATMENT_RELATION_KINDS,'pending'=>$pending]);
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){lcnLogApiError('treatment_relationship_proposals',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Verknüpfung konnte nicht gespeichert oder geladen werden.'],500);}
