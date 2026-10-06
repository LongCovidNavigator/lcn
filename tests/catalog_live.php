<?php
require_once __DIR__.'/../api/_treatment_answers.php';
require_once __DIR__.'/../api/_submission_review.php';
$p=lcnDoctorDatabase();function liveCheck($ok,$message){if(!$ok)throw new RuntimeException($message);}
$before=$p->query('SELECT COUNT(*) FROM tbl_treatment_community_answers_nd')->fetchColumn();
$p->beginTransaction();try{
$key=hash('sha256','lcn-live-regression-test');
lcnSaveTreatmentAnswer($p,1,$key,'effect','','Verbesserung');$n=array_sum(lcnTreatmentAnswers($p,1,$key)['counts']['effect']);
lcnSaveTreatmentAnswer($p,1,$key,'effect','','Heilung');liveCheck(array_sum(lcnTreatmentAnswers($p,1,$key)['counts']['effect'])===$n,'Changed vote counted twice');
lcnSaveTreatmentAnswer($p,1,$key,'unit_cost','GKV','bis 50 €');lcnSaveTreatmentAnswer($p,1,$key,'unit_cost','PKV','bis 500 €');$a=(array)lcnTreatmentAnswers($p,1,$key)['own_answers'];liveCheck($a['unit_cost:GKV']['value']==='bis 50 €'&&$a['unit_cost:PKV']['value']==='bis 500 €','Insurance mix');
try{lcnSaveTreatmentAnswer($p,1,$key,'effect','GKV','Heilung');throw new RuntimeException('Invalid context accepted');}catch(InvalidArgumentException $e){}
lcnSaveTreatmentAnswer($p,1,$key,'effect','',null);liveCheck(!isset(((array)lcnTreatmentAnswers($p,1,$key)['own_answers'])['effect']),'Clear failed');
$row=['submission_id'=>0,'existing_target_id'=>0,'name'=>'Rollback test provider','website'=>'','email'=>'','phone'=>''];$id=lcnApproveDoctorSubmission($p,$row,['provider_type'=>'doctor','city'=>'Teststadt','street'=>'Testweg','treatment_ids'=>[1]]);liveCheck(lcnDoctorExists($id),'Provider approval');
$row['name']='Rollback test treatment';$tid=lcnApproveTreatmentSubmission($p,$row,['doctor_ids'=>[$id]]);liveCheck((bool)lcnNdDetail($p,$tid),'Treatment approval');
$q=$p->prepare('SELECT COUNT(*) FROM v_lcn_provider_treatments WHERE dr_id=? AND treat_id=?');$q->execute([$id,$tid]);liveCheck((int)$q->fetchColumn()===1,'Provider treatment link');
}finally{$p->rollBack();}
liveCheck($p->query('SELECT COUNT(*) FROM tbl_treatment_community_answers_nd')->fetchColumn()===$before,'Test leaked votes');
foreach(['api/doctors_search.php?lat=50&lng=7&radiusKm=all&includeNoCoords=1'=>324,'api/treatments_search.php'=>810] as $url=>$expected){$j=json_decode(file_get_contents('http://localhost/lcn/'.$url),true);liveCheck(($j['ok']??false)&&count($j['items'])===$expected,'Catalog count '.$url);}
echo "PASS: catalog visibility, approval writes, relations, vote upsert, insurance separation, validation, reset; test writes rolled back.\n";
