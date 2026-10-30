<?php
declare(strict_types=1);
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try {
 $p=lcnTreatmentsNdDatabase();$write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$in=lcnReadJsonBody();}else $in=$_GET;
 $id=(int)($in['id']??0);$field=$in['field']??'';
 if(!in_array($field,['typ','unterkategorie','treatmentname','overview'],true))throw new InvalidArgumentException('Ungültiges Feld.');
 $q=$p->prepare('SELECT treatmentname,typ,unterkategorie FROM tbl_treatments_nd WHERE treat_nd_id=?');$q->execute([$id]);$item=$q->fetch(PDO::FETCH_ASSOC);
 if(!$item)throw new InvalidArgumentException('Therapie nicht gefunden.');
 $current=$field==='overview'?implode(' | ',array_values($item)):(string)$item[$field];$key='taxonomy:'.$id.':overview:'.substr(hash('sha256',implode(' | ',array_values($item))),0,24);
 if($write){
  $stance=filter_var($in['stance']??null,FILTER_VALIDATE_INT);
  if(!in_array($stance,[-1,0,1],true))throw new InvalidArgumentException('Ungültige Rückmeldung.');
  $choice=trim((string)($in['choice']??''));
  if($stance===-1&&$field==='overview')throw new InvalidArgumentException('Bitte das zu korrigierende Feld wählen.');
  if($stance===-1&&(mb_strlen($choice)<2||mb_strlen($choice)>150||($field!=='unterkategorie'&&mb_strtolower($choice)===mb_strtolower($current))))throw new InvalidArgumentException('Bitte eine andere Zuordnung mit 2 bis 150 Zeichen wählen.');
  $user=lcnVoterKey();lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$user);
  $lock='taxonomy:'.substr(hash('sha256',$id.':'.$user),0,48);$q=$p->prepare('SELECT GET_LOCK(?,10)');$q->execute([$lock]);if((int)$q->fetchColumn()!==1)throw new RuntimeException('Rückmeldung wird gerade gespeichert.');
  $p->beginTransaction();
  $q=$p->prepare("SELECT submission_id,payload FROM community_submissions WHERE entity_type='treatment' AND existing_target_id=? AND submitter_key=? AND review_status IN ('pending','reviewing') FOR UPDATE");$q->execute([$id,$user]);
  $ownRows=$q->fetchAll(PDO::FETCH_ASSOC);$hadCategoryProposal=false;foreach($ownRows as $row){$v=json_decode($row['payload'],true)['taxonomy_proposal']??[];if(($v['field']??'')==='typ')$hadCategoryProposal=true;}
  $resetSubcategory=$field==='typ'&&$stance===-1;
  foreach($ownRows as $row){$payload=json_decode($row['payload'],true);if(isset($payload['taxonomy_proposal'])&&($field==='overview'||($payload['taxonomy_proposal']['field']??'')===$field||($resetSubcategory&&($payload['taxonomy_proposal']['field']??'')==='unterkategorie')))$p->prepare("UPDATE community_submissions SET review_status='rejected' WHERE submission_id=?")->execute([$row['submission_id']]);}
  $category=(string)$item['typ'];$q=$p->prepare("SELECT payload FROM community_submissions WHERE entity_type='treatment' AND existing_target_id=? AND submitter_key=? AND review_status IN ('pending','reviewing') ORDER BY submission_id DESC");$q->execute([$id,$user]);$remaining=false;foreach($q as $row){$v=json_decode($row['payload'],true)['taxonomy_proposal']??null;if(!$v)continue;$remaining=true;if(($v['field']??'')==='typ')$category=$v['choice'];}
  // Expand this person's earlier whole-card vote before updating one field.
  $q=$p->prepare('SELECT stance FROM catalog_relation_feedback WHERE relation_key LIKE ? AND respondent_key=?');$q->execute(['taxonomy:'.$id.':overview:%',$user]);$legacy=$q->fetchColumn();
  if($legacy!==false&&(int)$legacy===1)foreach(['treatmentname','typ','unterkategorie'] as $f){$k='taxonomy:'.$id.':'.$f.':'.substr(hash('sha256',(string)$item[$f]),0,24);$p->prepare('INSERT IGNORE INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute([$k,$user]);}
  if($field==='overview'){
   $p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key LIKE ? AND respondent_key=?')->execute(['taxonomy:'.$id.':%',$user]);
   if($stance===1)foreach(['treatmentname','typ','unterkategorie'] as $f){$k='taxonomy:'.$id.':'.$f.':'.substr(hash('sha256',(string)$item[$f]),0,24);$p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute([$k,$user]);}
  }else{
   $p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key LIKE ? AND respondent_key=?')->execute(['taxonomy:'.$id.':overview:%',$user]);
   $p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key LIKE ? AND respondent_key=?')->execute(['taxonomy:'.$id.':'.$field.':%',$user]);
   if($resetSubcategory)$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key LIKE ? AND respondent_key=?')->execute(['taxonomy:'.$id.':unterkategorie:%',$user]);
   $k='taxonomy:'.$id.':'.$field.':'.substr(hash('sha256',(string)$item[$field]),0,24);
   if($stance!==0)$p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,?)')->execute([$k,$user,$stance]);
  }
  if($stance===-1&&$choice!==''){
   $payload=['taxonomy_proposal'=>['field'=>$field,'previous'=>$current,'choice'=>$choice,'category'=>$field==='unterkategorie'?$category:null]];
   $p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key,triage_status,triage_score,triage_reasons) VALUES('treatment',?,'change',?,'',?,?,'needs_review',0,?)")->execute([$id,$item['treatmentname'],json_encode($payload,JSON_UNESCAPED_UNICODE),$user,json_encode(['Kategorie-Zuordnung prüfen'],JSON_UNESCAPED_UNICODE)]);
  }
  $p->commit();$p->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
 }
 $user=lcnExistingVoterKey()??'';
 $fieldVotes=[];$people=[];
 foreach(['treatmentname','typ','unterkategorie'] as $f)$fieldVotes[$f]=['confirm'=>0,'oppose'=>0,'own'=>0];
 $q=$p->prepare('SELECT relation_key,respondent_key,stance FROM catalog_relation_feedback WHERE relation_key LIKE ?');$q->execute(['taxonomy:'.$id.':%']);
 $rows=$q->fetchAll(PDO::FETCH_ASSOC);
 foreach($rows as $r)if(str_contains($r['relation_key'],':overview:')&&(int)$r['stance']===1)foreach(array_keys($fieldVotes) as $f)$people[$r['respondent_key']][$f]=1;
 foreach($rows as $r){$parts=explode(':',$r['relation_key']);$f=$parts[2]??'';if(isset($fieldVotes[$f]))$people[$r['respondent_key']][$f]=(int)$r['stance'];}
 // Earlier objections already contain the affected field in their proposals.
 $q=$p->prepare("SELECT payload,submitter_key FROM community_submissions WHERE entity_type='treatment' AND existing_target_id=? AND review_status IN ('pending','reviewing')");$q->execute([$id]);
 foreach($q as $r){$v=json_decode($r['payload'],true)['taxonomy_proposal']??[];if(isset($fieldVotes[$v['field']??'']))$people[$r['submitter_key']][$v['field']]=-1;}
 $votes=['confirmations'=>0,'objections'=>0,'own'=>0];
 foreach($people as $person=>$values){$overall=in_array(-1,$values,true)?-1:(count($values)===3?1:0);if($overall!==0)$votes[$overall===1?'confirmations':'objections']++;if($person===$user)$votes['own']=$overall;foreach($values as $f=>$value){$fieldVotes[$f][$value===1?'confirm':'oppose']++;if($person===$user)$fieldVotes[$f]['own']=$value;}}
 $category=(string)$item['typ'];$ownChoices=[];
 $q=$p->prepare("SELECT payload FROM community_submissions WHERE entity_type='treatment' AND existing_target_id=? AND submitter_key=? AND review_status IN ('pending','reviewing') ORDER BY submission_id");$q->execute([$id,$user]);
 foreach($q as $row){$v=json_decode($row['payload'],true)['taxonomy_proposal']??[];if(isset($v['field'],$v['choice']))$ownChoices[$v['field']]=$v['choice'];}
 $category=$ownChoices['typ']??$category;
 $options=[];
 if($field==='unterkategorie'){$q=$p->prepare('SELECT DISTINCT unterkategorie AS name FROM tbl_treatments_nd WHERE typ=? ORDER BY unterkategorie');$q->execute([$category]);}
 elseif($field==='typ')$q=$p->query('SELECT DISTINCT typ AS name FROM tbl_treatments_nd ORDER BY typ');
 if(in_array($field,['typ','unterkategorie'],true))foreach($q as $row){$name=trim((string)$row['name']);if($name!=='')$options[]=$name;}
 $proposal='';$suggestions=[];$grouped=[];
 $q=$p->prepare("SELECT payload,submitter_key FROM community_submissions WHERE entity_type='treatment' AND existing_target_id=? AND review_status IN ('pending','reviewing') ORDER BY submission_id");$q->execute([$id]);
 foreach($q as $row){
  $value=json_decode($row['payload'],true)['taxonomy_proposal']??[];$f=$value['field']??'';$name=trim((string)($value['choice']??''));
  if(!in_array($f,['treatmentname','typ','unterkategorie'],true)||$name==='')continue;
  $parent=$f==='unterkategorie'?($value['category']??$item['typ']):null;
  $hash=$f.':'.mb_strtolower($name).':'.mb_strtolower((string)$parent);
  if(!isset($grouped[$hash]))$grouped[$hash]=['field'=>$f,'choice'=>$name,'supporters'=>[],'own'=>false,'category'=>$parent];
  $grouped[$hash]['supporters'][$row['submitter_key']]=true;
  if($row['submitter_key']===$user){$grouped[$hash]['own']=true;if($f===$field)$proposal=$name;}
  if($f===$field&&($f!=='unterkategorie'||$parent===$category))$options[]=$name;
 }
 foreach($grouped as $value)$suggestions[]=['field'=>$value['field'],'choice'=>$value['choice'],'count'=>count($value['supporters']),'own'=>$value['own'],'category'=>$value['category']];
 usort($suggestions,fn($a,$b)=>$b['count']<=>$a['count']);
 lcnSendVoteJson(['ok'=>true,'confirm'=>(int)$votes['confirmations'],'oppose'=>(int)$votes['objections'],'own'=>(int)$votes['own'],'options'=>array_values(array_unique($options)),'proposal'=>$proposal,'suggestions'=>$suggestions,'category'=>$category,'own_choices'=>(object)$ownChoices,'field_votes'=>$fieldVotes]);
}catch(InvalidArgumentException $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnLogApiError('treatment_taxonomy_feedback',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Rückmeldung konnte nicht verarbeitet werden.'],500);}
