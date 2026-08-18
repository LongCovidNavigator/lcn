<?php
require_once __DIR__ . '/_vote_abuse.php';
lcnRequireVotingRequest();
try{
    $input=lcnReadJsonBody();
    $id=filter_var($input['submission_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $vote=(string)($input['type']??'');
    $map=['hilft'=>'pro','gleich'=>'neutral','verschlechterung'=>'contra','pro'=>'pro','neutral'=>'neutral','contra'=>'contra'];
    if($id===false||!isset($map[$vote]))lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Anfrage.'],400);
    $vote=$map[$vote];$pdo=lcnDatabase();
    $exists=$pdo->prepare("SELECT entity_type FROM community_submissions WHERE submission_id=:id AND review_status IN ('pending','reviewing')");$exists->execute([':id'=>$id]);$entity=$exists->fetchColumn();
    if($entity===false)lcnSendVoteJson(['ok'=>false,'error'=>'Der Community-Vorschlag ist nicht mehr öffentlich bewertbar.'],404);
    $key=lcnVoterKey();
    $stmt=$pdo->prepare("INSERT INTO community_submission_votes(submission_id,voter_key,vote) VALUES(:id,:key,:vote) ON DUPLICATE KEY UPDATE vote=VALUES(vote),updated_at=NOW()");
    $stmt->execute([':id'=>$id,':key'=>$key,':vote'=>$vote]);
    lcnSendVoteJson(['ok'=>true,'submission_id'=>(int)$id,'vote'=>$vote,'entity_type'=>$entity]);
}catch(Throwable $error){lcnLogApiError('vote_community_submission',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Die Bewertung konnte nicht gespeichert werden.'],500);}
