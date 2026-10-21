<?php
declare(strict_types=1);

/** One moderated proposal contains the new entry and all of its component links. */
function lcnNormalizeNewTreatmentCombination(array $g,array $input): array {
    if(!is_string($input['name']??null))throw new InvalidArgumentException('Bitte einen Namen für die Kombination eingeben.');
    if(!is_int($input['source_id']??null)&&!is_string($input['source_id']??null))throw new InvalidArgumentException('Bitte eine gültige Ausgangstherapie auswählen.');
    $source=filter_var($input['source_id']??null,FILTER_VALIDATE_INT);
    $name=preg_replace('/\s+/u',' ',trim((string)($input['name']??'')));
    if(!$source||!isset($g['entries'][$source]))throw new InvalidArgumentException('Die Ausgangstherapie wurde nicht gefunden.');
    if(mb_strlen($name)<2||mb_strlen($name)>255)throw new InvalidArgumentException('Bitte einen Namen mit 2 bis 255 Zeichen eingeben.');
    $raw=$input['component_ids']??null;
    if(!is_array($raw)||!array_is_list($raw)||count($raw)<2||count($raw)>20)throw new InvalidArgumentException('Bitte zwischen zwei und zwanzig Bestandteile auswählen.');
    $ids=[];foreach($raw as $value){if(!is_int($value)&&!is_string($value))throw new InvalidArgumentException('Bitte gültige Bestandteile auswählen.');$id=filter_var($value,FILTER_VALIDATE_INT);if(!$id||!isset($g['entries'][$id]))throw new InvalidArgumentException('Ein ausgewählter Bestandteil wurde nicht gefunden.');if(isset($ids[$id]))throw new InvalidArgumentException('Jeder Bestandteil darf nur einmal vorkommen.');$ids[$id]=$id;}
    if(!isset($ids[$source]))throw new InvalidArgumentException('Die aktuelle Therapie muss Bestandteil der neuen Kombination bleiben.');
    sort($ids,SORT_NUMERIC);
    foreach($g['entries'] as $e)if(lcnDiscoveryName($e['treatmentname'])===lcnDiscoveryName($name))throw new InvalidArgumentException('Ein Therapieeintrag mit diesem Namen besteht bereits.');
    foreach($g['comboIds'] as $cid){$parts=array_values($g['components'][$cid]??[]);sort($parts,SORT_NUMERIC);if($parts===$ids&&empty($g['componentNames'][$cid])&&empty($g['componentIncomplete'][$cid]))throw new InvalidArgumentException('Diese Bestandteile sind bereits als „'.$g['entries'][$cid]['treatmentname'].'“ verknüpft. Bitte die vorhandene Kombination öffnen.');}
    return ['kind'=>'new_combination','source_id'=>(int)$source,'left_id'=>(int)$source,'right_id'=>0,'name'=>$name,'component_ids'=>$ids,'signature'=>hash('sha256',json_encode(['new_combination',$ids])),'description'=>'Neue Kombination „'.$name.'“ mit '.implode(', ',array_map(fn($id)=>$g['entries'][$id]['treatmentname'],$ids))];
}

/** Called by the authenticated review dispatch, in its existing transaction. */
function lcnApproveNewTreatmentCombination(PDO $p,array $row,array $r): int {
    $source=(int)($r['source_id']??0);$sid=(int)$row['submission_id'];
    if($source!==(int)$row['existing_target_id'])throw new DomainException('Die Kombination passt nicht zur Ausgangstherapie.');
    $marker='Community-Kombination #'.$sid;
    $existing=lcnNdRows($p,'SELECT treat_nd_id,notes_internal FROM tbl_treatments_nd WHERE treatmentname=?',[$r['name']??'']);
    if($existing){
        $id=(int)$existing[0]['treat_nd_id'];$g=lcnTreatmentDiscoveryGraph($p);$actual=array_values($g['components'][$id]??[]);$expected=$r['component_ids']??[];sort($actual,SORT_NUMERIC);sort($expected,SORT_NUMERIC);
        if($existing[0]['notes_internal']===$marker&&$actual===$expected)return $id;
        throw new DomainException('Ein Therapieeintrag mit diesem Namen besteht inzwischen bereits.');
    }
    $g=lcnTreatmentDiscoveryGraph($p);$normalized=lcnNormalizeNewTreatmentCombination($g,['source_id'=>$source,'name'=>$r['name']??'','component_ids'=>$r['component_ids']??[]]);
    if(($r['signature']??'')!==$normalized['signature'])throw new DomainException('Die Bestandteile des Vorschlags stimmen nicht überein.');
    $types=array_unique(array_map(fn($id)=>$g['entries'][$id]['typ']??null,$normalized['component_ids']));$type=count($types)===1?reset($types):null;
    $p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,typ,legacy_match_status,review_status,datenstand,notes_internal) VALUES(?,?,'new','approved',CURRENT_DATE,?)")->execute([$normalized['name'],$type,$marker]);
    $id=(int)$p->lastInsertId();
    lcnTreatmentProposalLink($p,$id,lcnTreatmentProposalAlias($p,$normalized['name'],'primary_name'),$sid);
    $definition=lcnTreatmentProposalAlias($p,$normalized['name'],'combination_definition');
    foreach(array_merge([$id],$normalized['component_ids']) as $target)lcnTreatmentProposalLink($p,$target,$definition,$sid);
    foreach($normalized['component_ids'] as $part){$alias=lcnTreatmentProposalAlias($p,$g['entries'][$part]['treatmentname'],'combination_component');foreach([$id,$part] as $target)lcnTreatmentProposalLink($p,$target,$alias,$sid);}
    $result=lcnTreatmentDiscoveryGraph($p);
    foreach($normalized['component_ids'] as $part)if(!isset($result['components'][$id][$part],$result['combinations'][$part][$id]))throw new DomainException('Die Bestandteile konnten nicht vollständig verknüpft werden.');
    if(count($result['components'][$id])!==count($normalized['component_ids']))throw new DomainException('Es wurden unerwartete zusätzliche Bestandteile erkannt.');
    // Votes on creation remain with the proposal: they must not be copied to every component assertion.
    return $id;
}
