<?php
declare(strict_types=1);
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/_treatment_discovery.php';
require_once __DIR__.'/_treatment_combinations.php';
const LCN_TREATMENT_RELATION_KINDS=[
 'alternative'=>'Alternative Therapie',
 'belongs_to_group'=>'Gehört zur Gruppe', 'group_contains'=>'Weiterer Eintrag dieser Gruppe',
 'trade_of'=>'Ist Handelsname von', 'has_trade'=>'Hat den Handelsnamen',
 'form_of'=>'Ist Anwendungsform von', 'has_form'=>'Hat die Anwendungsform',
 'variant_of'=>'Ist Stoffvariante von', 'has_variant'=>'Hat die Stoffvariante',
 'detail_of'=>'Ist detaillierteres Verfahren von', 'has_detail'=>'Hat das detailliertere Verfahren',
 'component_of'=>'Ist Bestandteil von', 'has_component'=>'Hat den Bestandteil'
];
function lcnTreatmentRelationshipContextAllows(array $g,int $context,int $source): bool {
 if($context===$source)return true;
 if(isset($g['generics'][$context][$source],$g['entries'][$source]))return true;
 foreach($g['groups'] as $group)if($group['root']===$context&&isset($group['members'][$source]))return true;
 foreach($g['groups'] as $group)if(isset($group['members'][$context])&&$group['root']===$source)return true;
 return false;
}
function lcnNormalizeTreatmentRelationship(PDO $p,array $input,?array $graph=null): array {
 $g=$graph??lcnTreatmentDiscoveryGraph($p);$source=(int)($input['source_id']??0);$target=(int)($input['target_id']??0);$kind=(string)($input['kind']??'');
 if($kind==='new_combination')return lcnNormalizeNewTreatmentCombination($g,$input);
 if(!isset($g['entries'][$source],LCN_TREATMENT_RELATION_KINDS[$kind]))throw new InvalidArgumentException('Bitte eine gültige Verknüpfung auswählen.');
 $r=['source_id'=>$source,'kind'=>$kind,'left_id'=>$source,'right_id'=>$target];
 if(in_array($kind,['belongs_to_group','group_contains'],true)){
  $aid=(int)($input['group_alias_id']??0);$name=trim((string)($input['group_name']??''));
  if($aid){if(!isset($g['groups'][$aid]))throw new InvalidArgumentException('Gruppe nicht gefunden.');$name=$g['groups'][$aid]['name'];}
  else {if(mb_strlen($name)<2||mb_strlen($name)>255)throw new InvalidArgumentException('Bitte einen Gruppennamen mit 2 bis 255 Zeichen eingeben.');foreach($g['groups'] as $group)if(lcnDiscoveryName($group['name'])===lcnDiscoveryName($name)){$aid=$group['alias_id'];break;}}
  $member=$kind==='group_contains'?$target:$source;
  if(!isset($g['entries'][$member])||($kind==='group_contains'&&$member===$source)||lcnDiscoveryName($g['entries'][$member]['treatmentname'])===lcnDiscoveryName($name))throw new InvalidArgumentException('Bitte einen anderen Gruppeneintrag auswählen.');
  if(isset($g['generics'][$member])||isset($g['comboIds'][$member]))throw new InvalidArgumentException('Bitte einen einzelnen Wirkstoff oder ein Verfahren statt eines Handelsnamens oder einer Kombination auswählen.');
  if($aid&&isset($g['groups'][$aid]['members'][$member]))throw new InvalidArgumentException('Diese Gruppenzuordnung ist bereits vorhanden.');
  $r+=['group_alias_id'=>$aid,'group_name'=>$name];$r['kind']='group';$r['left_id']=$member;$r['right_id']=0;
  $r['description']=$g['entries'][$member]['treatmentname'].' gehört zur Gruppe „'.$name.'“';
 }else{
  if(!isset($g['entries'][$target])||$target===$source)throw new InvalidArgumentException('Bitte einen anderen vorhandenen Eintrag auswählen.');
  $reverse=in_array($kind,['has_trade','has_form','has_variant','has_detail','has_component'],true);
  $left=$reverse?$target:$source;$right=$reverse?$source:$target;$r['left_id']=$left;$r['right_id']=$right;
  if(in_array($kind,['trade_of','has_trade'],true)){
   if(isset($g['generics'][$right]))throw new InvalidArgumentException('Bitte den zugehörigen Wirkstoff statt eines weiteren Handelsnamens auswählen.');
   if(($g['entries'][$left]['typ']??'')!=='Arzneimittel'||($g['entries'][$right]['typ']??'')!=='Arzneimittel')throw new InvalidArgumentException('Handelsnamen können hier nur Arzneimitteln zugeordnet werden.');
   if(isset($g['roots'][$left],$g['roots'][$right])||isset($g['roots'][$left])||isset($g['roots'][$right]))throw new InvalidArgumentException('Bitte einen Wirkstoff oder ein Präparat statt eines Oberbegriffs auswählen.');
   if(isset($g['brands'][$right][$left]))throw new InvalidArgumentException('Dieser Handelsname ist bereits zugeordnet.');
   $r['kind']='brand';$r['description']=$g['entries'][$left]['treatmentname'].' ist Handelsname von '.$g['entries'][$right]['treatmentname'];
  }elseif(in_array($kind,['form_of','has_form'],true)){
   if(isset($g['generics'][$left])||isset($g['comboIds'][$left]))throw new InvalidArgumentException('Bitte eine Anwendungsform statt eines Handelsnamens oder einer Kombination auswählen.');
   foreach($g['groups'] as $group)if($group['forms']&&$group['root']===$right&&isset($group['members'][$left]))throw new InvalidArgumentException('Diese Anwendungsform ist bereits zugeordnet.');
   $r['kind']='form';$r['description']=$g['entries'][$left]['treatmentname'].' ist Anwendungsform von '.$g['entries'][$right]['treatmentname'];
  }elseif(in_array($kind,['variant_of','has_variant','detail_of','has_detail'],true)){
   $type=in_array($kind,['variant_of','has_variant'],true)?'substance_variant':'detailed_method';
   $queue=[$left];$seen=[];
   while($queue){$next=array_pop($queue);if($next===$right)throw new InvalidArgumentException('Eine Verknüpfung darf keinen Kreis bilden.');if(isset($seen[$next]))continue;$seen[$next]=true;foreach($g['groups'] as $group)if($group['root']===$next)foreach($group['members'] as $member)$queue[]=$member;}
   foreach($g['groups'] as $group)if($group['root']===$right&&isset($group['members'][$left]))throw new InvalidArgumentException('Diese Zuordnung ist bereits vorhanden.');
   $r['kind']=$type==='substance_variant'?'variant':'detail';$r['description']=$g['entries'][$left]['treatmentname'].($type==='substance_variant'?' ist Stoffvariante von ':' ist detaillierteres Verfahren von ').$g['entries'][$right]['treatmentname'];
  }elseif(in_array($kind,['component_of','has_component'],true)){
   $queue=[$left];$seen=[];while($queue){$next=array_pop($queue);if($next===$right)throw new InvalidArgumentException('Eine Kombination darf nicht ihr eigener Bestandteil werden.');if(isset($seen[$next]))continue;$seen[$next]=true;foreach($g['components'][$next]??[] as $part)$queue[]=$part;}
   if(isset($g['components'][$right][$left]))throw new InvalidArgumentException('Dieser Bestandteil ist bereits zugeordnet.');
   $r['kind']='component';$r['description']=$g['entries'][$left]['treatmentname'].' ist Bestandteil der Kombination '.$g['entries'][$right]['treatmentname'];
  }else{
   if(lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd_relations WHERE source_treat_nd_id=? AND target_treat_nd_id=?',[$source,$target]))throw new InvalidArgumentException('Diese alternative Therapie ist bereits verknüpft.');
   $r['kind']='alternative';$r['description']=$g['entries'][$target]['treatmentname'].' als alternative Therapie zu '.$g['entries'][$source]['treatmentname'];
  }
 }
 $r['signature']=hash('sha256',json_encode([$r['kind'],$r['left_id'],$r['right_id'],$r['group_alias_id']??0,lcnDiscoveryName($r['group_name']??'')],JSON_UNESCAPED_UNICODE));
 return $r;
}
function lcnTreatmentProposalAlias(PDO $p,string $name,string $type): int {
 $rows=lcnNdRows($p,'SELECT alias_id FROM tbl_aliases_03 WHERE alias=? AND alias_type=? ORDER BY alias_id LIMIT 1',[$name,$type]);
 if($rows)return (int)$rows[0]['alias_id'];
 $p->prepare('INSERT INTO tbl_aliases_03(alias,alias_type) VALUES(?,?)')->execute([$name,$type]);return (int)$p->lastInsertId();
}
function lcnTreatmentProposalLink(PDO $p,int $id,int $alias,int $submission): void {
 if(!lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=? AND alias_id=?',[$id,$alias]))$p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,note) VALUES(?,?,?)')->execute([$id,$alias,'Geprüfter Verknüpfungsvorschlag #'.$submission]);
}
/** Called only by authenticated moderation, within its transaction. */
function lcnApproveTreatmentRelationship(PDO $p,array $row,array $payload): int {
 $r=$payload['treatment_relationship']??[];$source=(int)($r['source_id']??0);$left=(int)($r['left_id']??0);$right=(int)($r['right_id']??0);$kind=$r['kind']??'';$sid=(int)$row['submission_id'];
 if($kind==='new_combination')return lcnApproveNewTreatmentCombination($p,$row,$r);
 if($source!==(int)$row['existing_target_id'])throw new DomainException('Der Vorschlag passt nicht zur Therapie.');
 $g=lcnTreatmentDiscoveryGraph($p);
 if(!isset($g['entries'][$source],$g['entries'][$left])||($kind!=='group'&&(!isset($g['entries'][$right])||$left===$right)))throw new DomainException('Ein beteiligter Eintrag fehlt.');
 $key='';
 if($kind==='alternative'){
  $existing=lcnNdRows($p,'SELECT relation_id FROM tbl_cpl_treatments_nd_relations WHERE source_treat_nd_id=? AND target_treat_nd_id=?',[$left,$right]);
  if($existing)$rid=(int)$existing[0]['relation_id'];else{$p->prepare('INSERT INTO tbl_cpl_treatments_nd_relations(source_treat_nd_id,target_treat_nd_id,target_label,begruendung,quelle_url,review_note) VALUES(?,?,?,?,?,?)')->execute([$left,$right,$g['entries'][$right]['treatmentname'],$payload['review_note']??null,$payload['source_url']??null,'Community-Vorschlag #'.$sid.' geprüft']);$rid=(int)$p->lastInsertId();}$key='tr:'.$rid;
 }elseif($kind==='group'){
  $alias=(int)($r['group_alias_id']??0);if($alias&&!isset($g['groups'][$alias]))throw new DomainException('Die Gruppe existiert nicht mehr.');
  if(!$alias)$alias=lcnTreatmentProposalAlias($p,(string)$r['group_name'],'umbrella_term');
  if(!empty($g['groups'][$alias]['forms']))$p->prepare("UPDATE tbl_aliases_03 SET alias_type='application_form' WHERE alias_id=?")->execute([$alias]);
  lcnTreatmentProposalLink($p,$left,$alias,$sid);$key='ag:'.$alias.':t:'.$left;
 }elseif($kind==='brand'){
  if(($g['entries'][$left]['typ']??'')!=='Arzneimittel'||($g['entries'][$right]['typ']??'')!=='Arzneimittel'||isset($g['roots'][$left])||isset($g['roots'][$right]))throw new DomainException('Ungültige Wirkstoff-/Handelsnamen-Zuordnung.');
  lcnTreatmentProposalLink($p,$right,lcnTreatmentProposalAlias($p,$g['entries'][$left]['treatmentname'],'trade_name'),$sid);
  lcnTreatmentProposalLink($p,$left,lcnTreatmentProposalAlias($p,$g['entries'][$right]['treatmentname'],'generic_name'),$sid);$key='bn:'.$right.':'.$left;
 }elseif($kind==='form'){
  $alias=0;foreach($g['groups'] as $group)if($group['root']===$right&&$group['forms']){$alias=$group['alias_id'];break;}
  if($alias)$p->prepare("UPDATE tbl_aliases_03 SET alias_type='application_form' WHERE alias_id=?")->execute([$alias]);
  else $alias=lcnTreatmentProposalAlias($p,$g['entries'][$right]['treatmentname'],'application_form');
  foreach([$left,$right] as $id)lcnTreatmentProposalLink($p,$id,$alias,$sid);$key='ag:'.$alias.':t:'.$left;
 }elseif(in_array($kind,['variant','detail'],true)){
  $type=$kind==='variant'?'substance_variant':'detailed_method';
  foreach($g['groups'] as $group)if($group['root']===$right&&isset($group['members'][$left])&&($group['relation_type']??'')!==$type)throw new DomainException('Diese Zuordnung besteht bereits mit einer anderen Beziehungsart.');
  $alias=lcnTreatmentProposalAlias($p,$g['entries'][$right]['treatmentname'],$type);
  foreach([$left,$right] as $id)lcnTreatmentProposalLink($p,$id,$alias,$sid);$key='ag:'.$alias.':t:'.$left;
 }elseif($kind==='component'){
  $alias=lcnTreatmentProposalAlias($p,$g['entries'][$left]['treatmentname'],'combination_component');
  foreach([$left,$right] as $id)lcnTreatmentProposalLink($p,$id,$alias,$sid);$key='cp:'.$right.':'.$left;
  $definitions=lcnNdRows($p,"SELECT alias_id FROM tbl_aliases_03 WHERE alias=? AND alias_type='combination_definition'",[$g['entries'][$right]['treatmentname']]);
  foreach($definitions as $definition)lcnTreatmentProposalLink($p,$left,(int)$definition['alias_id'],$sid);
 }else throw new DomainException('Unbekannter Zusammenhang.');
 lcnValidateTreatmentDiscoveryFeedback($p,$key);
 $p->prepare('INSERT IGNORE INTO catalog_relation_feedback(relation_key,respondent_key,stance) SELECT ?,respondent_key,stance FROM catalog_relation_feedback WHERE relation_key=?')->execute([$key,'s:'.$sid]);
 return $source;
}
