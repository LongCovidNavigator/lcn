<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_doctor_symptom_help.php';
$pdo=lcnTreatmentsNdDatabase();$respondent=bin2hex(random_bytes(32));$other=bin2hex(random_bytes(32));
$before=lcnDoctorSymptomHelp($pdo,613,null);
$existing=array_column($before['symptoms'],'id');
$symptom=null;
foreach($before['catalog'] as $candidate)if(!in_array($candidate['id'],$existing,true)){$symptom=$candidate['id'];break;}
if($symptom===null)throw new RuntimeException('No unlinked symptom available for the test.');
$pdo->beginTransaction();
try {
    lcnSaveDoctorSymptomHelp($pdo,613,$symptom,$respondent,true);
    lcnSaveDoctorSymptomHelp($pdo,613,$symptom,$respondent,true);
    $find=static function($user)use($pdo,$symptom){foreach(lcnDoctorSymptomHelp($pdo,613,$user)['symptoms'] as $row)if($row['id']===$symptom)return $row;throw new RuntimeException('Missing symptom link.');};
    $row=$find($respondent);
    if($row['count']!==1||!$row['selected']||$row['suggested'])throw new RuntimeException('Duplicate vote or incorrect origin.');
    lcnSaveDoctorSymptomHelp($pdo,613,$symptom,$other,true);
    if($find($respondent)['count']!==2)throw new RuntimeException('Independent votes not counted.');
    lcnSaveDoctorSymptomHelp($pdo,613,$symptom,$respondent,false);
    if($find($respondent)['count']!==1||$find($respondent)['selected'])throw new RuntimeException('Own vote not cleared.');
    lcnSaveDoctorSymptomHelp($pdo,613,$symptom,$other,false);
    if($find(null)['count']!==0)throw new RuntimeException('Zero-vote link not retained.');
    try { lcnSaveDoctorSymptomHelp($pdo,613,999999,$respondent,true);throw new RuntimeException('Invalid symptom accepted.'); }
    catch(InvalidArgumentException $expected){}
    echo "PASS: new connections, one vote per browser, independent voters, clearing, zero-vote persistence and invalid IDs. Transaction rolled back.\n";
} finally {$pdo->rollBack();}
