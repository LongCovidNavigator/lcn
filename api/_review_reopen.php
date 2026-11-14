<?php

function lcnReviewIdentifier(string $name): string {
    if(!preg_match('/^[a-zA-Z0-9_]+$/D',$name))throw new LogicException('Invalid review snapshot identifier.');
    return "`$name`";
}

// Each scope names a catalog table and the exact record or set affected by the approval.
function lcnReviewSnapshot(PDO $pdo,array $scopes): array {
    $result=[];
    foreach($scopes as [$table,$key,$filter]){
        $columns=array_map('lcnReviewIdentifier',array_keys($filter));
        $where=implode(' AND ',array_map(static fn($column)=>"$column=?",$columns));
        $order=implode(',',array_map('lcnReviewIdentifier',$key));
        $query=$pdo->prepare('SELECT * FROM '.lcnReviewIdentifier($table)." WHERE $where ORDER BY $order FOR UPDATE");
        $query->execute(array_values($filter));
        $result[]=$query->fetchAll(PDO::FETCH_ASSOC);
    }
    return $result;
}

function lcnSaveReviewSnapshot(PDO $pdo,string $source,string $id,array $scopes,array $before): void {
    if(!$scopes)return;
    $changes=['scopes'=>$scopes,'before'=>$before,'after'=>lcnReviewSnapshot($pdo,$scopes)];
    $pdo->prepare('INSERT INTO review_approval_snapshots(source,entry_key,changes) VALUES (?,?,?)')
        ->execute([$source,$id,json_encode($changes,JSON_THROW_ON_ERROR)]);
}

function lcnReviewSnapshotKeys(PDO $pdo,string $source): array {
    $query=$pdo->prepare('SELECT entry_key FROM review_approval_snapshots WHERE source=?');
    $query->execute([$source]);
    return array_fill_keys($query->fetchAll(PDO::FETCH_COLUMN),true);
}

function lcnUndoReviewApproval(PDO $pdo,string $source,string $id): array {
    $query=$pdo->prepare('SELECT changes FROM review_approval_snapshots WHERE source=? AND entry_key=? FOR UPDATE');
    $query->execute([$source,$id]);$json=$query->fetchColumn();
    if($json===false)throw new DomainException('Für diese Freigabe gibt es keinen gesicherten Rücksetzstand.');
    $changes=json_decode($json,true,512,JSON_THROW_ON_ERROR);
    $scopes=$changes['scopes'];
    if(lcnReviewSnapshot($pdo,$scopes)!==$changes['after']){
        throw new DomainException('Die betroffenen Katalogdaten wurden inzwischen geändert. Bitte prüfe den aktuellen Stand.');
    }
    foreach($scopes as $i=>[$table,$key]){
        if($scopes[$i][3]??false)continue;
        if($table==='tbl_treatments_nd'&&isset($changes['before'][$i][0],$changes['after'][$i][0])){
            $previous=$changes['before'][$i][0];
            if($previous['treatmentname']!==$changes['after'][$i][0]['treatmentname']){
                $names=$pdo->prepare('SELECT treatmentname FROM tbl_treatments_nd WHERE treat_nd_id<>?');
                $names->execute([$previous['treat_nd_id']]);
                foreach($names->fetchAll(PDO::FETCH_COLUMN) as $name){
                    if(lcnDiscoveryName($name)===lcnDiscoveryName($previous['treatmentname'])){
                        throw new DomainException('Der frühere Therapiename ist inzwischen vergeben.');
                    }
                }
            }
        }
        $index=static function(array $rows)use($key): array {
            $result=[];
            foreach($rows as $row)$result[json_encode(array_intersect_key($row,array_flip($key)),JSON_THROW_ON_ERROR)]=$row;
            return $result;
        };
        $before=$index($changes['before'][$i]);$after=$index($changes['after'][$i]);
        $table=lcnReviewIdentifier($table);
        $where=implode(' AND ',array_map(static fn($column)=>lcnReviewIdentifier($column).'=?',$key));
        foreach(array_diff_key($after,$before) as $row){
            $pdo->prepare("DELETE FROM $table WHERE $where")->execute(array_map(static fn($column)=>$row[$column],$key));
        }
        foreach($before as $rowKey=>$row){
            if(isset($after[$rowKey])){
                $values=array_diff_key($row,array_flip($key));
                $values=array_filter($values,static fn($value,$column)=>$value!==$after[$rowKey][$column],ARRAY_FILTER_USE_BOTH);
                if(!$values)continue;
                $set=implode(',',array_map(static fn($column)=>lcnReviewIdentifier($column).'=?',array_keys($values)));
                $pdo->prepare("UPDATE $table SET $set WHERE $where")->execute([...array_values($values),...array_map(static fn($column)=>$row[$column],$key)]);
            }else{
                $columns=implode(',',array_map('lcnReviewIdentifier',array_keys($row)));
                $markers=implode(',',array_fill(0,count($row),'?'));
                $pdo->prepare("INSERT INTO $table ($columns) VALUES ($markers)")->execute(array_values($row));
            }
        }
    }
    $pdo->prepare('DELETE FROM review_approval_snapshots WHERE source=? AND entry_key=?')->execute([$source,$id]);
    return $changes;
}

function lcnSubmissionReviewScopes(PDO $pdo,array $row,array $payload): array {
    if(isset($payload['relationship']['doctor_id'],$payload['relationship']['treatment_id'])&&$row['entity_type']==='doctor'){
        return [['tbl_cpl_entities2treatments_nd',['id'],[
            'lcn_id'=>(int)$payload['relationship']['doctor_id'],'treat_nd_id'=>(int)$payload['relationship']['treatment_id']
        ]]];
    }
    $field=$payload['taxonomy_proposal']['field']??'';
    if($row['entity_type']==='treatment'&&in_array($field,['typ','unterkategorie','treatmentname'],true)){
        $id=(int)$row['existing_target_id'];
        $scopes=[['tbl_treatments_nd',['treat_nd_id'],['treat_nd_id'=>$id]]];
        if($field==='treatmentname'){
            $scopes[]=['tbl_cpl_treatments_nd2aliases',['treat_nd_id','alias_id'],['treat_nd_id'=>$id]];
            $types=LCN_TAXONOMY_LINKED_ALIAS_TYPES;
            $old=lcnDiscoveryName((string)($payload['taxonomy_proposal']['previous']??''));
            foreach(lcnNdRows($pdo,"SELECT alias_id,alias FROM tbl_aliases_03 WHERE alias_type IN ($types)") as $alias){
                if(lcnDiscoveryName($alias['alias'])!==$old)continue;
                $aliasId=(int)$alias['alias_id'];
                $scopes[]=['tbl_aliases_03',['alias_id'],['alias_id'=>$aliasId]];
                $scopes[]=['tbl_cpl_treatments_nd2aliases',['treat_nd_id','alias_id'],['alias_id'=>$aliasId],true];
            }
        }
        return $scopes;
    }
    return [];
}

function lcnRecordReviewReopen(PDO $pdo,string $source,string $key,array $decision): void {
    $pdo->prepare('INSERT INTO review_reopen_history(source,entry_key,previous_decision,reopened_by) VALUES (?,?,?,?)')
        ->execute([$source,$key,json_encode($decision,JSON_THROW_ON_ERROR),lcnAuthenticatedWebUser()??'local-admin']);
}

function lcnReopenSubmission(PDO $pdo,array $row): void {
    if(!in_array($row['review_status'],['rejected','duplicate','approved'],true)){
        throw new DomainException('Der Antrag ist bereits offen.');
    }
    $payload=lcnSubmissionPayload($row);
    $relationship=$payload['treatment_relationship']??[];
    $target=(int)($row['existing_target_id']??0);
    if($row['entity_type']==='treatment'){
        $ids=array_filter(array_map('intval',[
            $target,$relationship['source_id']??0,$relationship['left_id']??0,
            $relationship['right_id']??0,...($relationship['component_ids']??[])
        ]));
    }else{
        $ids=array_filter([(int)($payload['relationship']['treatment_id']??0)]);
        if($target&&!lcnDoctorExists($target))throw new DomainException('Das zugehörige Behandlerprofil existiert nicht mehr.');
    }
    $lookup=$pdo->prepare("SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=? AND review_status<>'rejected_group' FOR UPDATE");
    foreach(array_unique($ids) as $id){
        $lookup->execute([$id]);
        if(!$lookup->fetchColumn())throw new DomainException('Ein beteiligter Therapieeintrag wurde entfernt. Bitte reiche einen neuen Antrag ein.');
        $lookup->closeCursor();
    }
    $decision=[
        'status'=>$row['review_status'],'reviewed_at'=>$row['reviewed_at'],'note'=>$row['reviewer_note'],'approved_target_id'=>$row['approved_target_id']
    ];
    if($row['review_status']==='approved')$decision['catalog_changes']=lcnUndoReviewApproval($pdo,'submission',(string)$row['submission_id']);
    lcnRecordReviewReopen($pdo,'submission',(string)$row['submission_id'],$decision);
    $pdo->prepare("UPDATE community_submissions SET review_status='pending',reviewed_at=NULL,reviewer_note=NULL,approved_target_id=NULL WHERE submission_id=?")
        ->execute([$row['submission_id']]);
}
