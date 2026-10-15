<?php
require_once __DIR__.'/../api/_doctor_hybrid.php';
require_once __DIR__.'/../api/_experience_summary.php';
$pdo=lcnDoctorDatabase();
$pdo->beginTransaction();
try {
    $before=lcnExperienceSummary($pdo);
    $respondent='summary-test-'.bin2hex(random_bytes(12));
    $doctor=(int)$pdo->query('SELECT lcn_id FROM tbl_entities_nd LIMIT 1')->fetchColumn();
    $treatment=(int)$pdo->query('SELECT treat_nd_id FROM tbl_treatments_nd LIMIT 1')->fetchColumn();
    $d=$pdo->prepare("INSERT INTO doctor_community_answers(dr_id,respondent_key,question_key,context_key,option_value) VALUES(?,?,'effect','',?)");
    $t=$pdo->prepare("INSERT INTO tbl_treatment_community_answers_nd(treat_nd_id,respondent_key,question_key,context_key,answer_value) VALUES(?,?,'effect','',?)");
    foreach(['Verschlechterung','Keine Veränderung','Verbesserung','Heilung'] as $index=>$label){
        $d->execute([$doctor,$respondent.$index,$index+1]);
        $t->execute([$treatment,$respondent.$index,$label]);
    }
    $after=lcnExperienceSummary($pdo);
    foreach(['doctor'=>$doctor,'treatment'=>$treatment] as $type=>$id) {
        $expected=array_map(fn($n)=>$n+1,$before[$type][$id]??[0,0,0,0]);
        if($after[$type][$id]!==$expected)throw new RuntimeException('Scale mismatch: '.$type);
    }
    echo "PASS: all four categories counted separately for treatments and providers; test writes rolled back.\n";
} finally {$pdo->rollBack();}
