<?php
require_once __DIR__.'/../api/_treatment_answers.php';
require_once __DIR__.'/../api/_doctor_treatment_ratings.php';
$pdo=lcnDoctorDatabase();
$id=(int)$pdo->query('SELECT treat_id FROM v_lcn_provider_treatments WHERE dr_id=627 ORDER BY treat_id LIMIT 1')->fetchColumn();
function verifyTreatmentRating($condition,$message){if(!$condition)throw new RuntimeException($message);}
$pdo->beginTransaction();
try{
    $base=lcnApplyDoctorTreatmentRatings($pdo,[['treat_id'=>$id]])[0];
    $keys=[];
    foreach(['Verschlechterung','Keine Veränderung','Verbesserung','Heilung'] as $value){
        $key=bin2hex(random_bytes(32));$keys[]=$key;
        lcnSaveTreatmentAnswer($pdo,$id,$key,'effect','',$value);
    }
    $result=lcnApplyDoctorTreatmentRatings($pdo,[['treat_id'=>$id]])[0];
    verifyTreatmentRating($result['total_votes']===$base['total_votes']+4,'All four real answers must load.');
    foreach(['contra','neutral','pro','healing'] as $key)verifyTreatmentRating($result[$key]===$base[$key]+1,'Missing category '.$key);
    $detail=lcnTreatmentAnswers($pdo,$id,null);
    verifyTreatmentRating(array_sum($detail['counts']['effect'])===$result['total_votes'],'Doctor and treatment pages must use the same totals.');
    verifyTreatmentRating(abs($result['positive_ratio']-100*($result['pro']+$result['healing'])/$result['total_votes'])<.001,'Positive includes improvement and healing.');
    lcnSaveTreatmentAnswer($pdo,$id,$keys[3],'effect','','Verbesserung');
    $changed=lcnApplyDoctorTreatmentRatings($pdo,[['treat_id'=>$id]])[0];
    verifyTreatmentRating($changed['total_votes']===$result['total_votes']&&$changed['healing']===$base['healing'],'Changed answer must replace the old category.');
    lcnSaveTreatmentAnswer($pdo,$id,$keys[3],'effect','',null);
    verifyTreatmentRating(lcnApplyDoctorTreatmentRatings($pdo,[['treat_id'=>$id]])[0]['total_votes']===$base['total_votes']+3,'Cleared answer must disappear.');
    echo "PASS: real treatment ratings, all four categories, shared totals, positive filter values, update and clear. Test writes rolled back.\n";
}finally{$pdo->rollBack();}
