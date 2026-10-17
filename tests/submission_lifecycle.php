<?php
if(PHP_SAPI !== 'cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_submission_review.php';
require_once __DIR__.'/../api/_doctor_community_answers.php';
$p=lcnDoctorDatabase();$p->beginTransaction();
function lifecycleCheck($ok,$message){if(!$ok)throw new RuntimeException($message);}
function testSubmission($p,$type,$name,$payload,$existing=null){$p->prepare("INSERT INTO community_submissions(entity_type,existing_target_id,submission_kind,name,website,payload,submitter_key) VALUES(?,?,?,?,'',?,?)")->execute([$type,$existing,$existing?'change':'new',$name,json_encode($payload),hash('sha256','lifecycle-test')]);$q=$p->prepare('SELECT * FROM community_submissions WHERE submission_id=?');$q->execute([$p->lastInsertId()]);return $q->fetch();}
try{
 $user=hash('sha256','lifecycle-test-voter');
 $payload=['provider_type'=>'doctor','city'=>'Wien','country'=>'AT','postal_code'=>'1010','street'=>'Testgasse','lat'=>48.2082,'lng'=>16.3738,'treatment_ids'=>[1]];
 $row=testSubmission($p,'doctor','LCN Rollback Behandler '.bin2hex(random_bytes(5)),$payload);$sid=(int)$row['submission_id'];
 $p->prepare("INSERT INTO community_doctor_answers(submission_id,respondent_key,question_key,context_key,option_value) VALUES(?,?, 'adaptation','',5)")->execute([$sid,$user]);
 $p->prepare("INSERT INTO community_submission_votes(submission_id,voter_key,vote) VALUES(?,?,'pro')")->execute([$sid,$user]);
 $p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute(['s:'.$sid,$user]);
 $dr=lcnApproveDoctorSubmission($p,$row,$payload);
 $own=(array)lcnDoctorOwnAnswers($p,$dr,$user);lifecycleCheck(($own['adaptation']??0)===5&&($own['effect']??0)===3,'Pending answers and effect must survive approval');
 $q=$p->prepare('SELECT loc_country,loc_plz,loc_lat FROM tbl_drs_locations_03 WHERE dr_id=?');$q->execute([$dr]);$loc=$q->fetch();lifecycleCheck($loc['loc_country']==='AT'&&$loc['loc_plz']==='1010'&&abs($loc['loc_lat']-48.2082)<.001,'Location must survive approval');
 $q=$p->prepare('SELECT stance FROM catalog_relation_feedback WHERE relation_key=? AND respondent_key=?');$q->execute(['d:'.$dr.':t:1',$user]);lifecycleCheck((int)$q->fetchColumn()===1,'Relation feedback must survive approval');
 $payload=['treatment_category'=>'Diagnostik','doctor_ids'=>[$dr]];$row=testSubmission($p,'treatment','LCN Rollback Therapie '.bin2hex(random_bytes(5)),$payload);$sid=(int)$row['submission_id'];
 $p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,-1)')->execute(['s:'.$sid,$user]);
 $tid=lcnApproveTreatmentSubmission($p,$row,$payload);$q->execute(['d:'.$dr.':t:'.$tid,$user]);lifecycleCheck((int)$q->fetchColumn()===-1,'Treatment feedback must survive approval');
 foreach(['doctor'=>$dr,'treatment'=>$tid] as $type=>$target){$payload=['symptom_proposal'=>'LCN Rollback Symptom '.bin2hex(random_bytes(5))];$row=testSubmission($p,$type,'Symptom test',$payload,$target);$fn=$type==='doctor'?'lcnApproveDoctorSubmission':'lcnApproveTreatmentSubmission';$fn($p,$row,$payload);$fn($p,$row,$payload);$table=$type==='doctor'?'tbl_doctor_symptom_help_links':'tbl_treatment_symptom_help_links';$col=$type==='doctor'?'dr_id':'treat_nd_id';$q2=$p->prepare("SELECT COUNT(*) FROM $table l JOIN tbl_symptoms s ON s.sym_id=l.sym_id WHERE l.$col=? AND s.sym_name=?");$q2->execute([$target,$payload['symptom_proposal']]);lifecycleCheck((int)$q2->fetchColumn()===1,'Symptom approved once without duplication');}
 echo "PASS: new doctor and therapy approval, provisional answers, feedback, AT address/coordinates, both symptom approvals and idempotency. All writes rolled back.\n";
}finally{$p->rollBack();}
