<?php

const LCN_TAXONOMY_LINKED_ALIAS_TYPES="'umbrella_term','application_form','substance_variant','detailed_method','combination_definition','combination_component','trade_name','generic_name','active_ingredient'";

function lcnApproveTreatmentTaxonomy(PDO $pdo,array $row,array $proposal): int {
    $id=(int)$row['existing_target_id'];
    $field=$proposal['field']??'';
    $value=trim((string)($proposal['choice']??''));
    if(!in_array($field,['treatmentname','typ','unterkategorie'],true)||mb_strlen($value)<2||mb_strlen($value)>150){
        throw new DomainException('Ungültiger Vorschlag für die Therapieangaben.');
    }
    $current=lcnNdRows($pdo,'SELECT treatmentname,typ,unterkategorie FROM tbl_treatments_nd WHERE treat_nd_id=? FOR UPDATE',[$id])[0]??null;
    if(!$current)throw new DomainException('Die Therapie existiert nicht mehr.');
    if($field==='unterkategorie'&&(string)$current['typ']!==(string)($proposal['category']??$current['typ'])){
        throw new DomainException('Bitte zuerst die passende Hauptkategorie freigeben.');
    }
    if((string)$current[$field]===$value)return $id;
    if((string)$current[$field]!==($proposal['previous']??null)){
        throw new DomainException('Der hinterlegte Wert wurde inzwischen geändert. Bitte den Vorschlag erneut prüfen.');
    }
    if($field==='treatmentname'){
        $previous=(string)$current['treatmentname'];
        $names=lcnNdRows($pdo,'SELECT treat_nd_id,treatmentname FROM tbl_treatments_nd WHERE treat_nd_id<>?',[$id]);
        $newName=lcnDiscoveryName($value);$oldName=lcnDiscoveryName($previous);
        foreach($names as $name)if(lcnDiscoveryName($name['treatmentname'])===$newName)throw new DomainException('Ein Eintrag mit diesem Namen existiert bereits.');
        if($oldName!==$newName){
            foreach($names as $name)if(lcnDiscoveryName($name['treatmentname'])===$oldName)throw new DomainException('Der bisherige Name ist mehreren Einträgen zugeordnet. Bitte die Alias-Beziehungen zuerst prüfen.');
            $graph=lcnTreatmentDiscoveryGraph($pdo);
            foreach($graph['groups'] as $group){
                if($group['root']===$id)lcnTreatmentProposalLink($pdo,$id,$group['alias_id'],(int)$row['submission_id'],'reference');
            }
            $types=LCN_TAXONOMY_LINKED_ALIAS_TYPES;
            $aliases=lcnNdRows($pdo,"SELECT alias_id,alias,alias_type FROM tbl_aliases_03 WHERE alias_type IN ($types)");
            foreach($aliases as $alias){
                if(lcnDiscoveryName($alias['alias'])!==$oldName)continue;
                foreach($aliases as $other){
                    if($other['alias_type']===$alias['alias_type']&&lcnDiscoveryName($other['alias'])===$newName){
                        throw new DomainException('Für den neuen Namen besteht bereits eine typisierte Alias-Beziehung. Bitte diese zuerst prüfen.');
                    }
                }
                $pdo->prepare('UPDATE tbl_aliases_03 SET alias=? WHERE alias_id=?')->execute([$value,$alias['alias_id']]);
            }
            lcnTreatmentProposalLink($pdo,$id,lcnTreatmentProposalAlias($pdo,$previous,'synonym'),(int)$row['submission_id']);
        }
    }
    $pdo->prepare("UPDATE tbl_treatments_nd SET $field=?,datenstand=CURRENT_DATE WHERE treat_nd_id=?")->execute([$value,$id]);
    return $id;
}
