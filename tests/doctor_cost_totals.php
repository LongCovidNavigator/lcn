<?php
require_once __DIR__.'/../api/_doctor_community_answers.php';
$p=lcnDoctorDatabase();$p->beginTransaction();
try {
 $respondent='test-cost-totals-transaction';
 foreach(['costs-gkv','costs-ch-basic-CHF'] as $key){
  lcnSaveDoctorAnswer($p,613,$respondent,$key,8);
  $answers=(array)lcnDoctorOwnAnswers($p,613,$respondent);
  if(($answers[$key]??null)!==8)throw new RuntimeException('New total cost option did not round-trip.');
 }
 $community=lcnDoctorCommunity($p,613,false);
 if(count($community['questions']['costs-gkv']['options'])!==8)throw new RuntimeException('Expected eight cost options.');
 echo "PASS: eight cost options, EUR/CHF storage and own answers. Transaction rolled back.\n";
} finally {$p->rollBack();}
