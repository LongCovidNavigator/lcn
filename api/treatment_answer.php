<?php
require_once __DIR__.'/_treatment_answers.php';
header('Cache-Control: private, no-store');
try {
 $write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$input=lcnReadJsonBody();}else{$input=$_GET;}
 $id=filter_var($input['treatment_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
 $p=lcnTreatmentsNdDatabase();if(!$id||!lcnNdRows($p,'SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?',[$id]))lcnSendVoteJson(['ok'=>false,'error'=>'Behandlung nicht gefunden.'],404);
 $respondent=$write?lcnVoterKey():lcnExistingVoterKey();
 if($write){lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$respondent);$action=$input['action']??'answer';if(!in_array($action,['answer','clear'],true)||!is_string($input['question']??null)||!is_string($input['context']??'')||($action==='answer'&&!is_string($input['value']??null)))throw new InvalidArgumentException('Ungültige Antwort.');lcnSaveTreatmentAnswer($p,$id,$respondent,$input['question'],$input['context']??'',$action==='clear'?null:$input['value']);}
 lcnSendVoteJson(['ok'=>true]+lcnTreatmentAnswers($p,$id,$respondent));
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){lcnLogApiError('treatment_answer',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Antwort konnte nicht gespeichert oder geladen werden. Bitte erneut versuchen.'],500);}
