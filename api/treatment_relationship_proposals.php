<?php
require_once __DIR__.'/_treatment_relationship_proposals.php';
require_once __DIR__.'/_voting.php';require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try{
 $p=lcnTreatmentsNdDatabase();$write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$in=lcnReadJsonBody();$id=(int)($in['source_id']??0);}else $id=(int)($_GET['id']??0);
 if($write){lcnLockTreatmentProposals($p);$proposalLock=true;}
 $g=lcnTreatmentDiscoveryGraph($p);if(!isset($g['entries'][$id]))throw new InvalidArgumentException('Therapie nicht gefunden.');
 if($write){
  $r=lcnNormalizeTreatmentRelationship($p,$in,$g);$context=(int)($in['context_id']??$id);
  if(!lcnTreatmentRelationshipContextAllows($g,$context,$id))throw new InvalidArgumentException('Die Verknüpfung passt nicht zur geöffneten Seite.');
  $r['context_id']=$context;$note=trim((string)($in['note']??''));$url=trim((string)($in['source_url']??''));
  if(mb_strlen($note)>2000||mb_strlen($url)>1000)throw new InvalidArgumentException('Hinweis oder Quellenadresse ist zu lang.');
  if($url!==''&&(!filter_var($url,FILTER_VALIDATE_URL)||!in_array(strtolower(parse_url($url,PHP_URL_SCHEME)??''),['http','https'],true)))throw new InvalidArgumentException('Bitte eine vollständige http(s)-Quellenadresse eingeben.');
  $user=lcnVoterKey();
  foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing')") as $row){$existing=json_decode($row['payload'],true)['treatment_relationship']??[];if(($existing['signature']??'')===$r['signature']||($r['kind']==='group'&&($existing['kind']??'')==='group'&&(int)($existing['left_id']??0)===$r['left_id']&&lcnDiscoveryName($existing['group_name']??'')===lcnDiscoveryName($r['group_name'])))lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$row['submission_id'],'duplicate'=>true]);}
  $recent=lcnNdRows($p,'SELECT COUNT(*) n FROM community_submissions WHERE submitter_key=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)',[$user]);if((int)$recent[0]['n']>=10)lcnSendVoteJson(['ok'=>false,'error'=>'Zu viele Vorschläge in kurzer Zeit. Bitte versuche es später erneut.'],429);
  lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$user);
  $payload=['type'=>'treatment','existing_target_id'=>$id,'name'=>$r['kind']==='new_combination'?$r['name']:$g['entries'][$id]['treatmentname'],'treatment_relationship'=>$r,'review_note'=>$note,'source_url'=>$url];
  $p->beginTransaction();
  $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key,triage_status,triage_score,triage_reasons) VALUES('treatment',?,'change',?,?,?,?, 'needs_review',0,?)")->execute([$id,$payload['name'],$url,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$user,json_encode(['Therapieverknüpfung prüfen: '.$r['description']],JSON_UNESCAPED_UNICODE)]);
  $sid=(int)$p->lastInsertId();
  $duplicate=lcnTreatmentGroupDuplicate($p,$r,$sid);if($duplicate)$p->prepare("UPDATE community_submissions SET triage_status='possible_duplicate',triage_score=?,duplicate_target_id=?,triage_reasons=? WHERE submission_id=?")->execute([$duplicate['score'],$duplicate['id'],json_encode([$duplicate['reason']],JSON_UNESCAPED_UNICODE),$sid]);
  lcnEnsureProposedTreatmentGroup($p,$r,$sid);$p->commit();
  lcnSendVoteJson(['ok'=>true,'submission_id'=>$sid],201);
 }
 $pending=[];foreach(lcnNdRows($p,"SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND review_status IN ('pending','reviewing') ORDER BY submission_id") as $row){$r=json_decode($row['payload'],true)['treatment_relationship']??null;if(!is_array($r))continue;
  $groupRoot=$g['groups'][(int)($r['group_alias_id']??0)]['root']??null;
  if(!$groupRoot&&($r['kind']??'')==='group')foreach($g['groups'] as $group)if(lcnDiscoveryName($group['name'])===lcnDiscoveryName($r['group_name']??'')){$groupRoot=$group['root'];break;}
  if(!in_array($id,array_merge([(int)$r['source_id'],(int)$r['left_id'],(int)$r['right_id'],(int)($r['context_id']??0),$groupRoot],$r['component_ids']??[]),true))continue;
  $pending[]=['submission_id'=>(int)$row['submission_id'],'description'=>$r['description'],'kind'=>$r['kind'],'left_id'=>(int)$r['left_id'],'right_id'=>(int)$r['right_id'],'group_alias_id'=>(int)($r['group_alias_id']??0),'group_name'=>$r['group_name']??null,'group_root_id'=>$groupRoot,'combination'=>$r['kind']==='new_combination'?['name'=>$r['name'],'component_ids'=>array_values($r['component_ids'])]:null];
 }
 $items=[];foreach($g['entries'] as $entry)$items[]=['id'=>$entry['treat_nd_id'],'name'=>$entry['treatmentname'],'meta'=>($entry['typ']??'').(!empty($entry['review_pending'])?' · Prüfung ausstehend':''),'review_pending'=>!empty($entry['review_pending']),'component_ids'=>array_values($g['components'][$entry['treat_nd_id']]??[]),'is_combination'=>isset($g['comboIds'][$entry['treat_nd_id']])];
 usort($items,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
 $groups=[];foreach($g['groups'] as $group)$groups[]=['id'=>$group['alias_id'],'name'=>$group['name'],'meta'=>($group['forms']?'Anwendungsformen':'Gruppe').(!empty($g['entries'][$group['root']]['review_pending'])?' · Prüfung ausstehend':'')];
 lcnSendVoteJson(['ok'=>true,'items'=>$items,'groups'=>$groups,'kinds'=>LCN_TREATMENT_RELATION_KINDS,'pending'=>$pending]);
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnLogApiError('treatment_relationship_proposals',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Verknüpfung konnte nicht gespeichert oder geladen werden.'],500);}

finally { if(!empty($proposalLock))$p->query("SELECT RELEASE_LOCK('lcn-treatment-proposals')"); }
