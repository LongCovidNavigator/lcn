<?php
require_once __DIR__ . '/../api/_doctor_community_answers.php';
$pdo = lcnDoctorDatabase();
$respondent = bin2hex(random_bytes(32));
function checkAnswer(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$pdo->beginTransaction();
try {
    $before = lcnDoctorCommunity($pdo, 627)['questions']['adaptation']['real_count'];
    foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
        lcnSaveDoctorAnswer($pdo, 627, $respondent, $key, 1);
        lcnSaveDoctorAnswer($pdo, 627, $respondent, $key, count($definition['labels']));
        lcnSaveDoctorAnswer($pdo, 627, $respondent, $key, count($definition['labels']));
    }
    $own = (array)lcnDoctorOwnAnswers($pdo, 627, $respondent);
    $costKeys=array_keys(array_filter(lcnDoctorCommunityQuestions(),fn($d)=>$d['question']==='costs_total_v2'));
    checkAnswer(count($own) === count(lcnDoctorCommunityQuestions())-count($costKeys)+1, 'One answer per question, one cost context');
    checkAnswer($own['adaptation'] === 5 && !isset($own['costs-gkv'],$own['costs-pkv']) && $own[end($costKeys)] === 8, 'Updated values');
    checkAnswer(lcnDoctorCommunity($pdo, 627)['questions']['adaptation']['real_count'] === $before + 1, 'Exactly one real answer');
    checkAnswer((array)lcnDoctorOwnAnswers($pdo, 2, $respondent) === [], 'Doctor isolation');
    checkAnswer((array)lcnDoctorOwnAnswers($pdo, 627, null) === [], 'Anonymous reader isolation');
    try { lcnSaveDoctorAnswer($pdo, 627, $respondent, 'wait', 99); throw new RuntimeException('Invalid option accepted'); } catch (InvalidArgumentException $expected) {}
    $clear = $pdo->prepare('DELETE FROM doctor_community_answers WHERE dr_id=? AND respondent_key=? AND question_key=? AND context_key=?');
    $remaining = count($own);$previous=$own;
    foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
        $clear->execute([627, $respondent, $definition['question'], $definition['context']]);
        $own = (array)lcnDoctorOwnAnswers($pdo, 627, $respondent);
        $expectedRemoved=isset($previous[$key])?1:0;
        $remaining-=$expectedRemoved;
        checkAnswer(!isset($own[$key]) && count($own) === $remaining, 'Clear only the selected answer: '.$key);
        $previous=$own;
    }
    echo "PASS: all answers, updates, idempotency, aggregation, isolation, validation. Test writes rolled back.\n";
} finally { $pdo->rollBack(); }
