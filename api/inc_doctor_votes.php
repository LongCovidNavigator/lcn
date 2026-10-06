<?php
// Compatibility endpoint for cached pages; writes the same four-option effect question.
require_once __DIR__.'/_doctor_community_answers.php';
lcnRequireVotingRequest();
try{$b=lcnReadJsonBody();$id=filter_var($b['dr_id']??null,FILTER_VALIDATE_INT);$values=['pro'=>3,'neutral'=>2,'contra'=>1];if(!$id||!lcnDoctorExists($id)||!isset($values[$b['type']??'']))lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Bewertung.'],400);$voter=lcnVoterKey();lcnBeginVoteSecurity(lcnDoctorDatabase(),'doctor',$id,$b['type'],$voter);lcnSaveDoctorAnswer(lcnDoctorDatabase(),$id,$voter,'effect',$values[$b['type']]);lcnSendVoteJson(['ok'=>true,'dr_id'=>$id,'vote'=>$b['type'],'changed'=>true]);}catch(Throwable $e){lcnLogApiError('inc_doctor_votes',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Bewertung konnte nicht gespeichert werden.'],500);}
