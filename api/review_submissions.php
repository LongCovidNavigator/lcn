<?php
require_once __DIR__.'/_pending_treatments.php';
require_once __DIR__ . '/_doctor_hybrid.php';
require_once __DIR__ . '/_submission_review.php';
require_once __DIR__ . '/_catalog_merge.php';
lcnRequireReviewAccess();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST'
    && (string)($_SERVER['HTTP_X_LCN_ADMIN_REQUEST'] ?? '') !== '1') {
    lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Admin-Anfrage.'], 403);
}

try {
    $pdo=lcnDoctorDatabase();
    if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&isset($_GET['merge_preview'])){
        $pdo->beginTransaction();$rows=lcnNdRows($pdo,'SELECT * FROM community_submissions WHERE submission_id=? FOR UPDATE',[(int)$_GET['merge_preview']]);if(!$rows)throw new DomainException('Vorschlag nicht gefunden.');$row=$rows[0];if(!in_array($row['review_status'],['pending','reviewing'],true))throw new DomainException('Vorschlag bereits abgeschlossen.');
        [$a,$b]=lcnMergePair($pdo,$row);$keep=(int)($_GET['keep_id']??$b);$plan=lcnMergePreview($pdo,$row,$keep);$version=hash('sha256',json_encode($plan));$pdo->rollBack();
        lcnSendVoteJson(['ok'=>true,'source_id'=>$plan['source_id'],'source_name'=>$plan['source_name'],'target_id'=>$plan['target_id'],'target_name'=>$plan['target_name'],'proposal_id'=>$a,'existing_id'=>$b,'conflicts'=>$plan['conflicts'],'version'=>$version]);
    }
    if (($_SERVER['REQUEST_METHOD']??'GET')==='GET') {
        $status=(string)($_GET['status']??'pending');
        if (!in_array($status,['pending','reviewing','approved','rejected','duplicate','all'],true)) $status='pending';
        $sql='SELECT submission_id,entity_type,existing_target_id,submission_kind,review_status,triage_status,triage_score,duplicate_target_id,triage_reasons,name,website,email,phone,city,experience,payload,created_at,reviewed_at,approved_target_id,reviewer_note FROM community_submissions';
        $params=[]; if($status!=='all'){ $sql.=' WHERE review_status=:status'; $params[':status']=$status; }
        $offset=max(0,(int)($_GET['offset']??0));
        $sql.=' ORDER BY created_at DESC, submission_id DESC LIMIT 201 OFFSET '.$offset; $stmt=$pdo->prepare($sql); $stmt->execute($params);
        $items=$stmt->fetchAll();$hasMore=count($items)>200;if($hasMore)array_pop($items); foreach($items as &$item){$item['payload']=lcnSubmissionPayload($item);$item['triage_reasons']=json_decode((string)($item['triage_reasons']??'[]'),true)?:[];$item['submission_id']=(int)$item['submission_id'];$item['triage_score']=(int)$item['triage_score'];$item['existing_target_id']=$item['existing_target_id']!==null?(int)$item['existing_target_id']:null;$item['duplicate_target_id']=$item['duplicate_target_id']!==null?(int)$item['duplicate_target_id']:null;}
        unset($item);
        $duplicateNames=[];foreach(lcnNdRows($pdo,'SELECT treat_nd_id,treatmentname FROM tbl_treatments_nd') as $target)$duplicateNames[(int)$target['treat_nd_id']]=$target['treatmentname'];
        foreach($items as &$item)if($item['entity_type']==='treatment')$item['duplicate_target_name']=$duplicateNames[$item['duplicate_target_id']]??null;
        unset($item);
        foreach($items as &$item){$item['merge_source_id']=null;$item['merge_source_name']=$item['name'];if($item['duplicate_target_id']){try{[$a,$b]=lcnMergePair($pdo,$item);$d=lcnMergeDefinition($item['entity_type']);$pair=lcnNdRows($pdo,"SELECT `{$d['id']}` AS id,`{$d['name']}` AS name FROM `{$d['table']}` WHERE `{$d['id']}` IN (?,?)",[$a,$b]);$names=array_column($pair,'name','id');$item['merge_source_id']=$a;$item['merge_source_name']=$names[$a]??$item['name'];$item['duplicate_target_name']=$names[$b]??null;}catch(DomainException $e){if($item['entity_type']==='doctor'){$names=lcnNdRows($pdo,'SELECT anzeigename FROM tbl_entities_nd WHERE lcn_id=?',[$item['duplicate_target_id']]);$item['duplicate_target_name']=$names[0]['anzeigename']??null;}}}}unset($item);
        $feedbackQuery=$pdo->prepare('SELECT COALESCE(SUM(stance=1),0) confirmations,COALESCE(SUM(stance=-1),0) objections FROM catalog_relation_feedback WHERE relation_key IN (?,?)');
        foreach($items as &$item){$relation=$item['payload']['relationship']??[];$key=isset($relation['doctor_id'],$relation['treatment_id'])?'d:'.(int)$relation['doctor_id'].':t:'.(int)$relation['treatment_id']:'';$feedbackQuery->execute([$key,'s:'.$item['submission_id']]);$votes=$feedbackQuery->fetch(PDO::FETCH_ASSOC);$item['community_feedback']=['confirm'=>(int)$votes['confirmations'],'oppose'=>(int)$votes['objections']];$item['payload']['community_feedback']=(int)$votes['confirmations'].' Bestätigungen · '.(int)$votes['objections'].' Widersprüche';}unset($item);
        lcnSendVoteJson(['ok'=>true,'items'=>$items,'has_more'=>$hasMore]);
    }
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') lcnSendVoteJson(['ok'=>false,'error'=>'Method not allowed.'],405);
    $input=json_decode((string)file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);
    $id=filter_var($input['submission_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); $action=(string)($input['action']??''); $note=trim((string)($input['note']??''));
    if($id===false||!in_array($action,['approve','merge','reject','duplicate'],true)||mb_strlen($note)>3000) lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Aktion.'],422);
    $pdo->beginTransaction();
    $stmt=$pdo->prepare('SELECT * FROM community_submissions WHERE submission_id=:id FOR UPDATE');$stmt->execute([':id'=>$id]);$row=$stmt->fetch();
    if(!$row) throw new DomainException('Vorschlag nicht gefunden.');
    if(!in_array($row['review_status'],['pending','reviewing'],true))throw new DomainException('Dieser Antrag wurde bereits abgeschlossen. Bitte die Übersicht neu laden.');
    $targetId=null;$status=['reject'=>'rejected','duplicate'=>'duplicate','approve'=>'approved','merge'=>'approved'][$action];
    if($action==='merge'){
        $keep=(int)($input['keep_id']??0);$plan=lcnMergePreview($pdo,$row,$keep);
        if(!hash_equals(hash('sha256',json_encode($plan)),(string)($input['merge_version']??'')))throw new DomainException('Daten wurden geändert. Bitte den Vergleich erneut öffnen.');
        $targetId=lcnApplyCatalogMerge($pdo,$plan,is_array($input['conflict_choices']??null)?$input['conflict_choices']:[],(int)$id);
        if($row['entity_type']==='doctor'){$row['existing_target_id']=$targetId;lcnApproveDoctorSubmission($pdo,$row,lcnSubmissionPayload($row));}
        $payload=lcnSubmissionPayload($row);$r=$payload['treatment_relationship']??[];
        if(($r['kind']??'')==='group'){$r['group_name']=$plan['target_name'];$r['group_alias_id']=lcnTreatmentProposalAlias($pdo,$r['group_name'],'umbrella_term');foreach(['source_id','left_id','right_id','context_id'] as $key)if((int)($r[$key]??0)===$plan['source_id'])$r[$key]=$targetId;$payload['treatment_relationship']=$r;$row['existing_target_id']=$r['source_id'];lcnApproveTreatmentRelationship($pdo,$row,$payload);}
    }elseif($action==='approve'){$payload=lcnSubmissionPayload($row);$targetId=$row['entity_type']==='doctor'?lcnApproveDoctorSubmission($pdo,$row,$payload):lcnApproveTreatmentSubmission($pdo,$row,$payload);}
    $update=$pdo->prepare("UPDATE community_submissions SET existing_target_id=COALESCE(existing_target_id,:existing),submission_kind=IF(:existing IS NULL,submission_kind,'change'),review_status=:status,reviewer_note=:note,reviewed_at=NOW(),approved_target_id=:target WHERE submission_id=:id");
    $update->execute([':existing'=>$action==='merge'?$targetId:null,':status'=>$status,':note'=>$note?:null,':target'=>$targetId,':id'=>$id]);
    if(in_array($action,['reject','duplicate'],true)){
        if($row['entity_type']==='treatment')lcnRejectPendingTreatment($pdo,$row);
    }
    $pdo->commit();
    lcnSendVoteJson(['ok'=>true,'status'=>$status,'approved_target_id'=>$targetId]);
} catch(DomainException $error){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$error->getMessage()],409);
} catch(Throwable $error){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();lcnLogApiError('review_submissions',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Die Aktion konnte nicht ausgeführt werden.'],500);}
