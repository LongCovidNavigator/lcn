<?php

const LCN_MEDICATION_REVIEW_LABELS=['group'=>'Medikamentengruppe','ingredient'=>'Wirkstoff','brand'=>'Handelsname'];

function lcnMedicationReviewRole(array $graph,int $id): ?string {
    if(($graph['entries'][$id]['typ']??'')!=='Arzneimittel')return null;
    if(isset($graph['roots'][$id]))return 'group';
    if(!empty($graph['generics'][$id]))return 'brand';
    return isset($graph['comboIds'][$id])?null:'ingredient';
}

function lcnMedicationReviewList(PDO $pdo): array {
    $items=[];
    $undoKeys=lcnReviewSnapshotKeys($pdo,'medication');
    foreach($pdo->query('SELECT treatment_id,role,decision AS review_status,treatment_name AS name,support,related_id,reviewed_at AS created_at FROM medication_classification_reviews') as $row){
        $key=$row['treatment_id'].':'.$row['role'];
        $items[$key]=$row+['can_reopen'=>isset($undoKeys[$key])];
    }
    $graph=lcnTreatmentDiscoveryGraph($pdo);
    $votes=$pdo->query("SELECT relation_key,COUNT(*) AS support,MIN(updated_at) AS created_at FROM catalog_relation_feedback
        WHERE relation_key LIKE 'classification:%' AND stance=1 GROUP BY relation_key");
    foreach($votes as $row){
        if(!preg_match('/^classification:([1-9][0-9]*):(group|ingredient|brand)$/D',$row['relation_key'],$match))continue;
        [, $id,$role]=$match;
        $key="$id:$role";
        $current=lcnMedicationReviewRole($graph,(int)$id);
        if(isset($items[$key])||($graph['entries'][$id]['typ']??'')!=='Arzneimittel')continue;
        $items[$key]=[
            'treatment_id'=>(int)$id,'role'=>$role,'name'=>$graph['entries'][$id]['treatmentname'],
            'review_status'=>'pending','support'=>(int)$row['support'],'current_role'=>$current,
            'created_at'=>$row['created_at']
        ];
    }
    return array_values($items);
}

function lcnDecideMedicationReview(PDO $pdo,array $input): string {
    $id=filter_var($input['treatment_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $related=filter_var($input['related_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $role=$input['role']??null;$action=$input['action']??null;
    if(!$id||!is_string($role)||!isset(LCN_MEDICATION_REVIEW_LABELS[$role])||!in_array($action,['approve','reject','reopen'],true)){
        throw new DomainException('Ungültige Entscheidung.');
    }
    $pdo->beginTransaction();
    $locked=lcnNdRows($pdo,'SELECT treat_nd_id,treatmentname,typ FROM tbl_treatments_nd WHERE treat_nd_id IN (?,?) ORDER BY treat_nd_id FOR UPDATE',[$id,$related?:$id]);
    $names=array_column($locked,'treatmentname','treat_nd_id');
    if(!isset($names[$id]))throw new DomainException('Die Therapie existiert nicht mehr.');
    $decision=lcnNdRows($pdo,'SELECT decision,support,related_id,reviewed_at,reviewed_by FROM medication_classification_reviews WHERE treatment_id=? AND role=?',[$id,$role])[0]??null;
    if($action==='reopen'&&!$decision){
        throw new DomainException('Der Vorschlag ist bereits offen.');
    }
    if($action!=='reopen'&&$decision){
        throw new DomainException('Dieser Vorschlag wurde bereits entschieden.');
    }
    $votes=lcnNdRows($pdo,'SELECT stance FROM catalog_relation_feedback WHERE relation_key=? FOR UPDATE',["classification:$id:$role"]);
    $support=count(array_filter($votes,static fn($vote)=>(int)$vote['stance']===1));
    if(!$support)throw new DomainException('Für diese Einordnung gibt es keine aktuellen Stimmen mehr.');
    if($action==='reopen'){
        if((array_column($locked,'typ','treat_nd_id')[$id]??null)!=='Arzneimittel'){
            throw new DomainException('Der Eintrag wird inzwischen anders kategorisiert.');
        }
        if($decision['decision']==='approved')$decision['catalog_changes']=lcnUndoReviewApproval($pdo,'medication',"$id:$role");
        lcnRecordReviewReopen($pdo,'medication',"$id:$role",$decision);
        $pdo->prepare('DELETE FROM medication_classification_reviews WHERE treatment_id=? AND role=?')->execute([$id,$role]);
        $pdo->commit();
        return 'pending';
    }
    if($action==='approve'){
        $scopes=[];
        foreach(array_unique(array_filter([$id,$related])) as $affected){
            $scopes[]=['tbl_cpl_treatments_nd2aliases',['treat_nd_id','alias_id'],['treat_nd_id'=>$affected]];
        }
        $before=lcnReviewSnapshot($pdo,$scopes);
        $graph=lcnTreatmentDiscoveryGraph($pdo);
        $current=lcnMedicationReviewRole($graph,$id);
        if($current!==$role){
            if($current!=='ingredient'||$role==='ingredient'){
                throw new DomainException('Bestehende Alias-Beziehungen stehen der Einordnung entgegen. Bitte diese zuerst prüfen.');
            }
            if(!$related||$id===$related||!isset($names[$related])||lcnMedicationReviewRole($graph,$related)!=='ingredient'){
                throw new DomainException('Bitte die ID eines passenden Wirkstoffs aus dem Katalog angeben.');
            }
            if($role==='brand'){
                lcnTreatmentProposalLink($pdo,$related,lcnTreatmentProposalAlias($pdo,$names[$id],'trade_name'),0);
                lcnTreatmentProposalLink($pdo,$id,lcnTreatmentProposalAlias($pdo,$names[$related],'generic_name'),0);
            }else{
                $alias=lcnTreatmentProposalAlias($pdo,$names[$id],'umbrella_term');
                lcnTreatmentProposalLink($pdo,$id,$alias,0,'reference');
                lcnTreatmentProposalLink($pdo,$related,$alias,0,'group_member');
            }
            $updated=lcnTreatmentDiscoveryGraph($pdo);
            if(lcnMedicationReviewRole($updated,$id)!==$role||
                ($role==='brand'&&!isset($updated['generics'][$id][$related]))){
                throw new DomainException('Die Alias-Beziehung ließ sich nicht eindeutig herstellen.');
            }
        }else $related=null;
        lcnSaveReviewSnapshot($pdo,'medication',"$id:$role",$scopes,$before);
    }else $related=null;
    $status=$action==='approve'?'approved':'rejected';
    $pdo->prepare('INSERT INTO medication_classification_reviews(treatment_id,role,decision,treatment_name,support,related_id,reviewed_by) VALUES(?,?,?,?,?,?,?)')
        ->execute([$id,$role,$status,$names[$id],$support,$related?:null,lcnAuthenticatedWebUser()??'local-admin']);
    $pdo->commit();
    return $status;
}
