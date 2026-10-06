<?php
// Compatibility endpoint for cached pages; all treatment answers use the ND store.
require_once __DIR__.'/_treatment_answers.php';
lcnRequireVotingRequest();
try{$b=lcnReadJsonBody();$id=filter_var($b['treat_id']??null,FILTER_VALIDATE_INT);$values=['pro'=>'Verbesserung','neutral'=>'Keine Veränderung','contra'=>'Verschlechterung'];if(!$id||!isset($values[$b['type']??''])||!lcnNdRows(lcnDoctorDatabase(),'SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?',[$id]))lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Bewertung.'],400);$voter=lcnVoterKey();lcnBeginVoteSecurity(lcnDoctorDatabase(),'treatment',$id,$b['type'],$voter);lcnSaveTreatmentAnswer(lcnDoctorDatabase(),$id,$voter,'effect','',$values[$b['type']]);lcnSendVoteJson(['ok'=>true,'treat_id'=>$id,'vote'=>$b['type'],'changed'=>true]);}catch(Throwable $e){lcnLogApiError('inc_votes_db',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Bewertung konnte nicht gespeichert werden.'],500);}
