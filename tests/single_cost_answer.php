<?php
require_once __DIR__.'/../api/_treatment_answers.php';
require_once __DIR__.'/../api/_doctor_community_answers.php';
$p=lcnDoctorDatabase();$user=bin2hex(random_bytes(32));$p->beginTransaction();
try {
 lcnSaveTreatmentAnswer($p,1,$user,'unit_cost','GKV','bis 100 €');
 lcnSaveTreatmentAnswer($p,1,$user,'total_cost','GKV','bis 500 €');
 foreach(['AT-ELECTIVE','CH-BASIC-CHF','PKV'] as $context){
  lcnMoveTreatmentCostContext($p,1,$user,$context);
  $answers=(array)lcnTreatmentAnswers($p,1,$user)['own_answers'];
  if(count($answers)!==2||($answers['unit_cost:'.$context]['value']??null)!=='bis 100 €'||($answers['total_cost:'.$context]['value']??null)!=='bis 500 €')throw new RuntimeException('Therapy answer duplicated or lost during transfer.');
 }
 lcnSaveTreatmentAnswer($p,1,$user,'unit_cost','GKV','kostenlos');
 $answers=(array)lcnTreatmentAnswers($p,1,$user)['own_answers'];
 if(count($answers)!==2||isset($answers['unit_cost:PKV']))throw new RuntimeException('Direct answer created a second vote.');
 lcnMoveTreatmentCostContext($p,1,$user,'GKV');
 lcnSaveTreatmentAnswer($p,1,$user,'unit_cost','GKV',null);
 if(count((array)lcnTreatmentAnswers($p,1,$user)['own_answers'])!==1)throw new RuntimeException('Clearing moved vote failed.');
 lcnSaveDoctorAnswer($p,613,$user,'costs-gkv',5);
 foreach(['costs-at-elective','costs-ch-basic-CHF','costs-pkv'] as $key){
  lcnMoveDoctorCostContext($p,613,$user,$key);
  $answers=(array)lcnDoctorOwnAnswers($p,613,$user);
  if(count($answers)!==1||($answers[$key]??null)!==5)throw new RuntimeException('Provider answer duplicated or lost during transfer.');
 }
 lcnSaveDoctorAnswer($p,613,$user,'costs-gkv',8);
 $answers=(array)lcnDoctorOwnAnswers($p,613,$user);
 if(count($answers)!==1||($answers['costs-gkv']??null)!==8)throw new RuntimeException('Direct provider answer created a second vote.');
 try{lcnMoveTreatmentCostContext($p,1,$user,'INVALID');throw new RuntimeException('Invalid context accepted.');}catch(InvalidArgumentException $expected){}
 echo "PASS: one answer per cost question; country, insurance and native-currency transfers preserve values; direct answers replace old context; clearing works. Transaction rolled back.\n";
}finally{$p->rollBack();}
