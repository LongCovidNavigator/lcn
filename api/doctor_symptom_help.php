<?php
require_once __DIR__.'/_doctor_symptom_help.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try {
 $write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$input=lcnReadJsonBody();}else $input=$_GET;
 $id=filter_var($input['dr_id']??null,FILTER_VALIDATE_INT);
 if(!$id||!lcnDoctorExists($id))throw new InvalidArgumentException('Behandler nicht gefunden.');
 $p=lcnDoctorDatabase();$respondent=$write?lcnVoterKey():lcnExistingVoterKey();
 if($write){
  $symptom=$input['symptom_id']??null;$action=$input['action']??'answer';
  if(!is_int($symptom)||!in_array($action,['answer','clear'],true))throw new InvalidArgumentException('Ungültige Symptomangabe.');
  lcnBeginVoteSecurity($p,'doctor',$id,'neutral',$respondent);
  lcnSaveDoctorSymptomHelp($p,$id,$symptom,$respondent,$action==='answer');
 }
 lcnSendVoteJson(['ok'=>true,'symptom_help'=>lcnDoctorSymptomHelp($p,$id,$respondent)]);
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){lcnLogApiError('doctor_symptom_help',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Symptomangaben konnten nicht gespeichert oder geladen werden.'],500);}
