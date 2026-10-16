<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_treatment_symptom_help.php';
$pdo=lcnTreatmentsNdDatabase();$respondent=bin2hex(random_bytes(32));$other=bin2hex(random_bytes(32));
$before=lcnTreatmentSymptomHelp($pdo,2,null);
$existing=array_column($before['symptoms'],'id');
$symptom=null;
foreach($before['catalog'] as $candidate)if(!in_array($candidate['id'],$existing,true)){$symptom=$candidate['id'];break;}
if($symptom===null)throw new RuntimeException('No unlinked symptom available for the test.');
$pdo->beginTransaction();
try {
    lcnSaveTreatmentSymptomHelp($pdo,2,$symptom,$respondent,true);
    lcnSaveTreatmentSymptomHelp($pdo,2,$symptom,$respondent,true);
    $find=static function($user)use($pdo,$symptom){foreach(lcnTreatmentSymptomHelp($pdo,2,$user)['symptoms'] as $row)if($row['id']===$symptom)return $row;throw new RuntimeException('Missing symptom link.');};
    $row=$find($respondent);
    if($row['count']!==1||!$row['selected']||$row['editorial'])throw new RuntimeException('Duplicate vote or incorrect origin.');
    lcnSaveTreatmentSymptomHelp($pdo,2,$symptom,$other,true);
    if($find($respondent)['count']!==2)throw new RuntimeException('Independent votes not counted.');
    lcnSaveTreatmentSymptomHelp($pdo,2,$symptom,$respondent,false);
    if($find($respondent)['count']!==1||$find($respondent)['selected'])throw new RuntimeException('Own vote not cleared.');
    lcnSaveTreatmentSymptomHelp($pdo,2,$symptom,$other,false);
    if($find(null)['count']!==0)throw new RuntimeException('Zero-vote link not retained.');
    try { lcnSaveTreatmentSymptomHelp($pdo,2,999999,$respondent,true);throw new RuntimeException('Invalid symptom accepted.'); }
    catch(InvalidArgumentException $expected){}
    echo "PASS: new connections, one vote per browser, independent voters, clearing, zero-vote persistence and invalid IDs. Transaction rolled back.\n";
} finally {$pdo->rollBack();}
