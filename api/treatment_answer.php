<?php
require_once __DIR__.'/_treatment_answers.php';
require_once __DIR__.'/_treatment_symptom_help.php';
header('Cache-Control: private, no-store');
try {
 $write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
 if($write){lcnRequireVotingRequest();$input=lcnReadJsonBody();}else{$input=$_GET;}
 $id=filter_var($input['treatment_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
 $p=lcnTreatmentsNdDatabase();if(!$id||!lcnNdRows($p,'SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?',[$id]))lcnSendVoteJson(['ok'=>false,'error'=>'Therapie nicht gefunden.'],404);
 $respondent=$write?lcnVoterKey():lcnExistingVoterKey();
 if($write&&($input['action']??'')==='move_cost_context'){lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$respondent);lcnMoveTreatmentCostContext($p,$id,$respondent,(string)($input['context']??''));}
 elseif($write){lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$respondent);$action=$input['action']??'answer';if(!in_array($action,['answer','clear'],true)||!is_string($input['question']??null)||!is_string($input['context']??'')||($action==='answer'&&!is_string($input['value']??null)))throw new InvalidArgumentException('Ungültige Antwort.');if(preg_match('/^symptom-help-([1-9][0-9]*)$/',$input['question'],$match)){if(($input['context']??'')!==''||($action==='answer'&&$input['value']!=='Ja'))throw new InvalidArgumentException('Ungültige Symptomangabe.');lcnSaveTreatmentSymptomHelp($p,$id,(int)$match[1],$respondent,$action!=='clear');}else{lcnSaveTreatmentAnswer($p,$id,$respondent,$input['question'],$input['context']??'',$action==='clear'?null:$input['value']);}}
 lcnSendVoteJson(['ok'=>true,'comparison_profiles'=>lcnTreatmentComparisonProfiles($p),'symptom_help'=>lcnTreatmentSymptomHelp($p,$id,$respondent)]+lcnTreatmentAnswers($p,$id,$respondent));
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){lcnLogApiError('treatment_answer',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Antwort konnte nicht gespeichert oder geladen werden. Bitte erneut versuchen.'],500);}
