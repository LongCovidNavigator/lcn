<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_treatment_answers.php';
$pdo=lcnTreatmentsNdDatabase();
$respondent=bin2hex(random_bytes(32));
$pdo->beginTransaction();
try {
    lcnSaveTreatmentAnswer($pdo,1,$respondent,'access','','Selbstmanagement / eigenständig umsetzbar');
    foreach(['GKV','AT-ELECTIVE','CH-BASIC-CHF'] as $context) {
        lcnSaveTreatmentAnswer($pdo,1,$respondent,'unit_cost',$context,'kostenlos');
        lcnSaveTreatmentAnswer($pdo,1,$respondent,'total_cost',$context,'bis 100 €');
    }
    $answers=(array)lcnTreatmentAnswers($pdo,1,$respondent)['own_answers'];
    if(count($answers)!==3)throw new RuntimeException('Cost answers must have only one context each.');
    lcnSaveTreatmentAnswer($pdo,1,$respondent,'access','',null);
    $answers=(array)lcnTreatmentAnswers($pdo,1,$respondent)['own_answers'];
    if(isset($answers['access']))throw new RuntimeException('Clearing self-management failed.');
    echo "PASS: self-management, free cost option, single country/native-currency answer per cost question and clearing. Transaction rolled back.\n";
} finally { $pdo->rollBack(); }
