<?php
require_once __DIR__.'/_submission_review.php';
function lcnMergeDefinition(string $type): array {
 if($type==='treatment')return ['table'=>'tbl_treatments_nd','id'=>'treat_nd_id','name'=>'treatmentname','refs'=>[
 'tbl_cpl_entities2treatments_nd'=>['treat_nd_id'],'tbl_cpl_treatments_nd2aliases'=>['treat_nd_id'],'tbl_cpl_treatments_nd2pharmacies'=>['treat_nd_id'],'tbl_cpl_treatments_nd2symptoms'=>['treat_nd_id'],'tbl_cpl_treatments_nd_relations'=>['source_treat_nd_id','target_treat_nd_id'],'tbl_treatment_community_answers_nd'=>['treat_nd_id'],'tbl_treatment_costs_nd'=>['treat_nd_id'],'tbl_treatment_dummy_counts_nd'=>['treat_nd_id'],'tbl_treatment_field_sources_nd'=>['treat_nd_id'],'tbl_treatment_studies_nd'=>['treat_nd_id'],'tbl_treatment_symptom_help_links'=>['treat_nd_id'],'tbl_treatment_symptom_help_votes'=>['treat_nd_id'],'treatment_experience_dummy_counts'=>['treat_id']]];
 if($type==='doctor')return ['table'=>'tbl_entities_nd','id'=>'lcn_id','name'=>'anzeigename','refs'=>[
 'tbl_cpl_entities2treatments_nd'=>['lcn_id'],'doctor_community_answers'=>['dr_id'],'doctor_community_dummy_answers'=>['dr_id'],'tbl_drs_locations_03'=>['dr_id'],'tbl_costs_nd'=>['lcn_id'],'tbl_cpl_drs2terms_03'=>['dr_id'],'tbl_doctor_symptom_help_links'=>['dr_id'],'tbl_doctor_symptom_help_votes'=>['dr_id'],'tbl_fachrichtungen_nd'=>['lcn_id'],'tbl_spezialisierungen_nd'=>['lcn_id'],'tbl_zusatzqualifikationen_nd'=>['lcn_id']]];
 throw new DomainException('Unbekannter Eintragstyp.');
}
function lcnMergePair(PDO $p,array $row): array {
 $payload=is_array($row['payload']??null)?$row['payload']:lcnSubmissionPayload($row);$r=$payload['treatment_relationship']??[];$source=(int)($row['existing_target_id']??0);
 if(($r['kind']??'')==='group'){$matches=lcnNdRows($p,"SELECT treat_nd_id FROM tbl_treatments_nd WHERE treatmentname=? AND review_status<>'rejected_group'",[$r['group_name']]);$source=(int)($matches[0]['treat_nd_id']??0);}
 if(!$source&&$row['entity_type']==='doctor')$source=-(int)$row['submission_id'];
 $target=(int)($row['duplicate_target_id']??0);
 if(!$source||!$target||$source===$target)throw new DomainException('Für diesen Vorschlag fehlen zwei unterschiedliche Katalogeinträge.');
 return [$source,$target];
}
function lcnMergePlan(PDO $p,string $type,int $source,int $target,array $overlay=[],array $virtual=[]): array {
 $d=lcnMergeDefinition($type);$rows=lcnNdRows($p,"SELECT * FROM `{$d['table']}` WHERE `{$d['id']}` IN (?,?) ORDER BY `{$d['id']}` FOR UPDATE",[$source,$target]);$byId=array_column($rows,null,$d['id']);if($virtual)$byId[(int)$virtual[$d['id']]]=$virtual;
 if(!isset($byId[$source],$byId[$target]))throw new DomainException('Einer der Einträge existiert nicht mehr.');
 foreach([$byId[$source],$byId[$target]] as $record)if(($record['review_status']??'')==='rejected_group')throw new DomainException('Ein Eintrag wurde bereits entfernt oder zusammengeführt. Bitte die Übersicht neu laden.');
 foreach($overlay as $key=>$value)if(array_key_exists($key,$byId[$source])&&$value!==null&&$value!=='')$byId[$source][$key]=$value;
 $conflicts=[];$updates=[];$ignore=[$d['id'],$d['name'],'legacy_treat_id','legacy_match_status','created_at','updated_at','review_status','datenstand','slug','notes_internal','legacy_notes'];
 foreach($byId[$source] as $key=>$value){if(in_array($key,$ignore,true)||$value===null||$value==='')continue;$other=$byId[$target][$key];if($other===null||$other==='')$updates[$key]=$value;elseif((string)$value!==(string)$other)$conflicts[]=['key'=>'field:'.$key,'label'=>$key,'source'=>$value,'target'=>$other];}
 $operations=[];
 foreach($d['refs'] as $table=>$refs){
  $columns=lcnNdRows($p,"SHOW COLUMNS FROM `$table`");$auto=[];foreach($columns as $column)if(str_contains($column['Extra'],'auto_increment'))$auto[]=$column['Field'];
  $indexes=[];foreach(lcnNdRows($p,"SHOW INDEX FROM `$table`") as $index)if(!$index['Non_unique'])$indexes[$index['Key_name']][]=$index['Column_name'];
  $natural=['tbl_cpl_treatments_nd2aliases'=>['treat_nd_id','alias_id'],'tbl_cpl_treatments_nd2pharmacies'=>['treat_nd_id','pharmacy_id'],'tbl_cpl_treatments_nd_relations'=>['source_treat_nd_id','target_treat_nd_id']];if(isset($natural[$table]))$indexes['semantic']=$natural[$table];
  $where=implode(' OR ',array_map(fn($col)=>"`$col`=?",$refs));$sources=lcnNdRows($p,"SELECT * FROM `$table` WHERE $where",array_fill(0,count($refs),$source));
  foreach($sources as $number=>$old){$new=$old;foreach($refs as $ref)if((int)$new[$ref]===$source)$new[$ref]=$target;
   if(count($refs)===2&&$new[$refs[0]]===$new[$refs[1]]){$operations[]=['table'=>$table,'old'=>$old,'skip'=>true,'auto'=>$auto,'indexes'=>$indexes];continue;}
   $existing=null;
   foreach($indexes as $keys){if(array_intersect($auto,$keys))continue;if(count(array_filter($keys,fn($k)=>$new[$k]===null)))continue;$clauses=implode(' AND ',array_map(fn($k)=>"`$k` <=> ?",$keys));$found=lcnNdRows($p,"SELECT * FROM `$table` WHERE $clauses",array_map(fn($k)=>$new[$k],$keys));if($found&&$found[0]===$old)continue;if($found){$existing=$found[0];break;}}
   $op=['table'=>$table,'old'=>$old,'new'=>$new,'existing'=>$existing,'auto'=>$auto,'indexes'=>$indexes,'choices'=>[]];
   if($existing)foreach($new as $key=>$value){if(in_array($key,array_merge($auto,$refs,['created_at','updated_at']),true)||$value===null||$value==='')continue;$other=$existing[$key];if($other===null||$other==='')$op['choices'][$key]=['value'=>$value];elseif((string)$value!==(string)$other){$choice='relation:'.$table.':'.$number.':'.$key;$conflicts[]=['key'=>$choice,'label'=>$table.' · '.$key,'source'=>$value,'target'=>$other];$op['choices'][$key]=['key'=>$choice,'source'=>$value,'target'=>$other];}}
   $operations[]=$op;
  }
 }
 return ['type'=>$type,'source'=>$byId[$source],'target'=>$byId[$target],'source_id'=>$source,'target_id'=>$target,'source_name'=>$byId[$source][$d['name']],'target_name'=>$byId[$target][$d['name']],'conflicts'=>$conflicts,'updates'=>$updates,'operations'=>$operations];
}
function lcnMergeRowWhere(array $op,array $row): array {
 $keys=$op['indexes']['PRIMARY']??array_keys($row);return [implode(' AND ',array_map(fn($key)=>"`$key` <=> ?",$keys)),array_map(fn($key)=>$row[$key],$keys)];
}
function lcnApplyCatalogMerge(PDO $p,array $plan,array $choices,int $sid): int {
 $d=lcnMergeDefinition($plan['type']);$source=$plan['source_id'];$target=$plan['target_id'];$updates=$plan['updates'];
 if($target<0){$values=array_diff_key($plan['target'],array_flip([$d['id'],'created_at','updated_at']));$keys=implode(',',array_map(fn($k)=>"`$k`",array_keys($values)));$p->prepare("INSERT INTO `{$d['table']}` ($keys) VALUES (".implode(',',array_fill(0,count($values),'?')).')')->execute(array_values($values));$newId=(int)$p->lastInsertId();foreach($plan['operations'] as &$op)if(isset($op['new']))foreach($d['refs'][$op['table']] as $ref)if((int)$op['new'][$ref]===$target)$op['new'][$ref]=$newId;unset($op);$target=$newId;$plan['target_id']=$target;}

 foreach($plan['conflicts'] as $conflict)if(!in_array($choices[$conflict['key']]??'', ['source','target'],true))throw new DomainException('Bitte jeden Widerspruch ausdrücklich auflösen.');
 foreach($plan['conflicts'] as $conflict)if(str_starts_with($conflict['key'],'proposal:'))$updates[substr($conflict['key'],9)]=$conflict[$choices[$conflict['key']]];
 foreach($plan['conflicts'] as $conflict)if(str_starts_with($conflict['key'],'field:'))$updates[substr($conflict['key'],6)]=$conflict[$choices[$conflict['key']]];
 foreach($updates as $key=>$value)$p->prepare("UPDATE `{$d['table']}` SET `$key`=? WHERE `{$d['id']}`=?")->execute([$value,$target]);
 // Parents are inserted first; source rows are removed in reverse order for foreign keys.
 $moved=[];
 foreach($plan['operations'] as $opIndex=>$op){if(!empty($op['skip']))continue;$table=$op['table'];
  if($op['existing']){foreach($op['choices'] as $key=>$choice){$value=array_key_exists('value',$choice)?$choice['value']:$choice[$choices[$choice['key']]];[$where,$params]=lcnMergeRowWhere($op,$op['existing']);$p->prepare("UPDATE `$table` SET `$key`=? WHERE $where")->execute(array_merge([$value],$params));}}
  elseif($op['auto']){[$where,$params]=lcnMergeRowWhere($op,$op['old']);foreach($op['new'] as $key=>$value)if($value!==$op['old'][$key])$p->prepare("UPDATE `$table` SET `$key`=? WHERE $where")->execute(array_merge([$value],$params));$moved[$opIndex]=true;}
  else{$new=array_diff_key($op['new'],array_flip($op['auto']));$columns=implode(',',array_map(fn($key)=>"`$key`",array_keys($new)));$p->prepare("INSERT INTO `$table` ($columns) VALUES (".implode(',',array_fill(0,count($new),'?')).')')->execute(array_values($new));}
 }
 foreach(array_reverse($plan['operations'],true) as $opIndex=>$op){if(isset($moved[$opIndex]))continue;[$where,$params]=lcnMergeRowWhere($op,$op['old']);$p->prepare("DELETE FROM `{$op['table']}` WHERE $where")->execute($params);}
 // Keep an immutable snapshot and an explicit redirect; never discard the old record.
 $p->prepare('INSERT INTO catalog_merges(entity_type,source_id,target_id,submission_id,snapshot) VALUES(?,?,?,?,?)')->execute([$plan['type'],$source,$target,$sid,json_encode(['plan'=>$plan,'choices'=>$choices],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 if($plan['type']==='treatment'){
  foreach(lcnNdRows($p,"SELECT alias_id,alias_type FROM tbl_aliases_03 WHERE alias=? AND alias_type IN ('umbrella_term','application_form','substance_variant','detailed_method','combination_definition','combination_component','trade_name','generic_name')",[$plan['source_name']]) as $oldAlias){
   $newAlias=lcnTreatmentProposalAlias($p,$plan['target_name'],$oldAlias['alias_type']);if($newAlias===(int)$oldAlias['alias_id'])continue;
   foreach(lcnNdRows($p,'SELECT treat_nd_id FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=?',[$oldAlias['alias_id']]) as $member)if(!lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=? AND alias_id=?',[$member['treat_nd_id'],$newAlias]))$p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id) VALUES(?,?)')->execute([$member['treat_nd_id'],$newAlias]);
   $p->prepare('DELETE FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=?')->execute([$oldAlias['alias_id']]);
  }
  $alias=lcnTreatmentProposalAlias($p,$plan['source_name'],'alternate_name');if(!lcnNdRows($p,'SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=? AND alias_id=?',[$target,$alias]))$p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id) VALUES(?,?)')->execute([$target,$alias]);
  $p->prepare("UPDATE tbl_treatments_nd SET review_status='rejected_group' WHERE treat_nd_id=?")->execute([$source]);$p->prepare("UPDATE tbl_treatments_nd SET review_status='approved' WHERE treat_nd_id=?")->execute([$target]);
 }else{$p->prepare('UPDATE tbl_entities_nd SET aktiv=0 WHERE lcn_id=?')->execute([$source]);$p->prepare("UPDATE tbl_entities_nd SET aktiv=1,review_status='approved' WHERE lcn_id=?")->execute([$target]);}
 foreach(lcnNdRows($p,'SELECT relation_key,respondent_key,stance FROM catalog_relation_feedback') as $feedback){$key=$feedback['relation_key'];$new=$key;
  if($plan['type']==='treatment'){$new=preg_replace_callback('/(:t:)'.$source.'$/',fn($m)=>$m[1].$target,$new);foreach(['bn','cp'] as $prefix)$new=preg_replace_callback('/^'.$prefix.':(\d+):(\d+)$/',fn($m)=>$prefix.':'.((int)$m[1]===$source?$target:$m[1]).':'.((int)$m[2]===$source?$target:$m[2]),$new);}
  else $new=preg_replace('/^d:'.$source.':/','d:'.$target.':',$new);
  if($new!==$key){$p->prepare('INSERT IGNORE INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,?)')->execute([$new,$feedback['respondent_key'],$feedback['stance']]);$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key=? AND respondent_key=?')->execute([$key,$feedback['respondent_key']]);}
 }
 foreach(lcnNdRows($p,'SELECT submission_id,entity_type,existing_target_id,duplicate_target_id,payload FROM community_submissions') as $row){$payload=json_decode($row['payload'],true)??[];$r=&$payload['treatment_relationship'];if($plan['type']==='treatment'&&is_array($r)){foreach(['source_id','left_id','right_id','context_id'] as $key)if((int)($r[$key]??0)===$source)$r[$key]=$target;if(isset($r['component_ids']))$r['component_ids']=array_values(array_unique(array_map(fn($id)=>(int)$id===$source?$target:$id,$r['component_ids'])));if(($r['group_name']??'')===$plan['source_name']){$r['group_name']=$plan['target_name'];$r['group_alias_id']=lcnTreatmentProposalAlias($p,$plan['target_name'],'umbrella_term');}}
  unset($r);if($plan['type']==='treatment'&&isset($payload['treatment_ids']))$payload['treatment_ids']=array_values(array_unique(array_map(fn($id)=>(int)$id===$source?$target:$id,$payload['treatment_ids'])));
  $relationKey=$plan['type']==='treatment'?'treatment_id':'doctor_id';if((int)($payload['relationship'][$relationKey]??0)===$source)$payload['relationship'][$relationKey]=$target;
  $own=$row['entity_type']===$plan['type'];$p->prepare('UPDATE community_submissions SET existing_target_id=?,duplicate_target_id=?,payload=? WHERE submission_id=?')->execute([$own&&(int)$row['existing_target_id']===$source?$target:$row['existing_target_id'],$own&&(int)$row['duplicate_target_id']===$source?$target:$row['duplicate_target_id'],json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$row['submission_id']]);
 }
 $p->prepare("UPDATE community_submissions SET review_status='approved',approved_target_id=?,reviewed_at=NOW(),reviewer_note=CONCAT_WS(' · ',reviewer_note,'Durch Zusammenführung erledigt.') WHERE entity_type=? AND review_status IN ('pending','reviewing') AND existing_target_id=? AND duplicate_target_id=? AND submission_id<>?")->execute([$target,$plan['type'],$target,$target,$sid]);
 return $target;
}

function lcnMergeProposalOverlay(array $row): array {
 $p=is_array($row['payload']??null)?$row['payload']:lcnSubmissionPayload($row);if(isset($p['treatment_relationship']))return [];
 $map=$row['entity_type']==='treatment'?['treatment_category'=>'typ','effort'=>'aufwand','crash_risk'=>'crashrisiko','cost'=>'kosten','speed'=>'wirkgeschwindigkeit','mechanism'=>'wirkmechanismus','indications'=>'indikationen_anwendungsgebiete','offerings'=>'weitere_hinweise']:['website'=>'website','email'=>'email','phone'=>'telefon','title'=>'titel','firstname'=>'vorname','lastname'=>'nachname','organization'=>'organisationsname'];
 $values=[];foreach($map as $key=>$column)if(isset($p[$key])&&is_scalar($p[$key]))$values[$column]=$p[$key];return $values;
}
function lcnMergePreview(PDO $p,array $row,int $keep): array {
 [$a,$b]=lcnMergePair($p,$row);if(!in_array($keep,[$a,$b],true))throw new DomainException('Bitte einen der beiden Einträge als Ziel wählen.');
 $overlay=lcnMergeProposalOverlay($row);$virtual=[];if($a<0){$d=lcnMergeDefinition($row['entity_type']);foreach(lcnNdRows($p,"SHOW COLUMNS FROM `{$d['table']}`") as $col)$virtual[$col['Field']]=$col['Default'];$virtual=array_merge($virtual,$overlay,[$d['id']=>$a,$d['name']=>$row['name']]);}
 // Proposed field values belong to the proposal's original record regardless of direction.
 if($keep===$b)return lcnMergePlan($p,$row['entity_type'],$a,$b,$overlay,$virtual);
 $plan=lcnMergePlan($p,$row['entity_type'],$b,$a,[],$virtual);
 // Overlay on the retained record must also enter conflict detection, never overwrite silently.
 if($overlay){foreach($overlay as $key=>$value){if($value===null||$value==='')continue;$current=$plan['target'][$key]??null;if($current===null||$current==='')$plan['updates'][$key]=$value;elseif((string)$current!==(string)$value){$plan['conflicts'][]=['key'=>'proposal:'.$key,'label'=>'Vorschlag · '.$key,'source'=>$value,'target'=>$current];}}}
 return $plan;
}
