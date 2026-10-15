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
    checkAnswer(count($own) === count(lcnDoctorCommunityQuestions()), 'One answer per question/context');
    checkAnswer($own['adaptation'] === 5 && $own['costs-gkv'] === 6 && $own['costs-pkv'] === 6, 'Updated values');
    checkAnswer(lcnDoctorCommunity($pdo, 627)['questions']['adaptation']['real_count'] === $before + 1, 'Exactly one real answer');
    checkAnswer((array)lcnDoctorOwnAnswers($pdo, 2, $respondent) === [], 'Doctor isolation');
    checkAnswer((array)lcnDoctorOwnAnswers($pdo, 627, null) === [], 'Anonymous reader isolation');
    try { lcnSaveDoctorAnswer($pdo, 627, $respondent, 'wait', 99); throw new RuntimeException('Invalid option accepted'); } catch (InvalidArgumentException $expected) {}
    $clear = $pdo->prepare('DELETE FROM doctor_community_answers WHERE dr_id=? AND respondent_key=? AND question_key=? AND context_key=?');
    $remaining = count($own);
    foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
        $clear->execute([627, $respondent, $definition['question'], $definition['context']]);
        $own = (array)lcnDoctorOwnAnswers($pdo, 627, $respondent);
        checkAnswer(!isset($own[$key]) && count($own) === --$remaining, 'Clear only the selected answer: '.$key);
    }
    echo "PASS: all answers, updates, idempotency, aggregation, isolation, validation. Test writes rolled back.\n";
} finally { $pdo->rollBack(); }
