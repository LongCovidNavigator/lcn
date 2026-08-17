<?php
require_once __DIR__ . '/_submission_review.php';
lcnRequireReviewAccess();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST'
    && (string)($_SERVER['HTTP_X_LCN_ADMIN_REQUEST'] ?? '') !== '1') {
    lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Admin-Anfrage.'], 403);
}

try {
    $pdo=lcnDatabase();
    if (($_SERVER['REQUEST_METHOD']??'GET')==='GET') {
        $status=(string)($_GET['status']??'pending');
        if (!in_array($status,['pending','reviewing','approved','rejected','duplicate','all'],true)) $status='pending';
        $sql='SELECT submission_id,entity_type,existing_target_id,submission_kind,review_status,triage_status,triage_score,duplicate_target_id,triage_reasons,name,website,email,phone,city,experience,payload,created_at,reviewed_at,approved_target_id,reviewer_note FROM community_submissions';
        $params=[]; if($status!=='all'){ $sql.=' WHERE review_status=:status'; $params[':status']=$status; }
        $sql.=' ORDER BY created_at DESC LIMIT 200'; $stmt=$pdo->prepare($sql); $stmt->execute($params);
        $items=$stmt->fetchAll(); foreach($items as &$item){$item['payload']=lcnSubmissionPayload($item);$item['triage_reasons']=json_decode((string)($item['triage_reasons']??'[]'),true)?:[];$item['submission_id']=(int)$item['submission_id'];$item['triage_score']=(int)$item['triage_score'];$item['existing_target_id']=$item['existing_target_id']!==null?(int)$item['existing_target_id']:null;$item['duplicate_target_id']=$item['duplicate_target_id']!==null?(int)$item['duplicate_target_id']:null;}
        lcnSendVoteJson(['ok'=>true,'items'=>$items]);
    }
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') lcnSendVoteJson(['ok'=>false,'error'=>'Method not allowed.'],405);
    $input=json_decode((string)file_get_contents('php://input'),true,16,JSON_THROW_ON_ERROR);
    $id=filter_var($input['submission_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]); $action=(string)($input['action']??''); $note=trim((string)($input['note']??''));
    if($id===false||!in_array($action,['reviewing','approve','merge','reject','duplicate'],true)||mb_strlen($note)>3000) lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Aktion.'],422);
    $pdo->beginTransaction();
    $stmt=$pdo->prepare('SELECT * FROM community_submissions WHERE submission_id=:id FOR UPDATE');$stmt->execute([':id'=>$id]);$row=$stmt->fetch();
    if(!$row) throw new DomainException('Vorschlag nicht gefunden.');
    $targetId=null;$status=['reviewing'=>'reviewing','reject'=>'rejected','duplicate'=>'duplicate','approve'=>'approved','merge'=>'approved'][$action];
    if($action==='merge'){
        $duplicateId=(int)($row['duplicate_target_id']??0);
        if($duplicateId<1)throw new DomainException('Für diesen Vorschlag wurde kein bestehender Zieleintrag erkannt.');
        $row['existing_target_id']=$duplicateId;
    }
    if(in_array($action,['approve','merge'],true)){$payload=lcnSubmissionPayload($row);$targetId=$row['entity_type']==='doctor'?lcnApproveDoctorSubmission($pdo,$row,$payload):lcnApproveTreatmentSubmission($pdo,$row,$payload);}
    $update=$pdo->prepare("UPDATE community_submissions SET existing_target_id=COALESCE(existing_target_id,:existing),submission_kind=IF(:existing IS NULL,submission_kind,'change'),review_status=:status,reviewer_note=:note,reviewed_at=NOW(),approved_target_id=:target WHERE submission_id=:id");
    $update->execute([':existing'=>$action==='merge'?$targetId:null,':status'=>$status,':note'=>$note?:null,':target'=>$targetId,':id'=>$id]);$pdo->commit();
    lcnSendVoteJson(['ok'=>true,'status'=>$status,'approved_target_id'=>$targetId]);
} catch(DomainException $error){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$error->getMessage()],409);
} catch(Throwable $error){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();lcnLogApiError('review_submissions',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Die Aktion konnte nicht ausgeführt werden.'],500);}
