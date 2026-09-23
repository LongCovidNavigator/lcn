<?php
require_once __DIR__ . '/../api/_doctor_community.php';
$pdo = lcnDoctorDatabase();
function verify($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$expected = LCN_PRIORITY_DOCTOR_IDS; sort($expected);
$actual = array_map('intval', $pdo->query('SELECT DISTINCT dr_id FROM doctor_community_dummy_answers ORDER BY dr_id')->fetchAll(PDO::FETCH_COLUMN));
verify($actual === $expected, 'Exactly the 39 selected doctors must have dummy data.');
$originalFlag = getenv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY');
try {
    putenv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=1');
    foreach ($expected as $id) {
        $data = lcnDoctorCommunity($pdo, $id);
        verify(count($data['questions']) === 11, 'All eleven question/context combinations required.');
        foreach ($data['questions'] as $key => $question) {
            verify($question['dummy_count'] > 0, "Missing $id/$key dummy answers");
            verify(array_sum(array_column($question['options'], 'count')) === $question['total'], 'Count sum mismatch');
            verify(abs(array_sum(array_column($question['options'], 'percent')) - 100) < .5, 'Percent sum mismatch');
            verify(count($question['options']) === count(lcnDoctorCommunityQuestions()[$key]['labels']), 'Scale mismatch');
        }
    }
    putenv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=0');
    foreach ($expected as $id) foreach (lcnDoctorCommunity($pdo, $id)['questions'] as $question) {
        verify($question['dummy_count'] === 0, 'Dummy data leaked with flag disabled');
        verify($question['total'] === $question['real_count'], 'Real-only total mismatch');
        if (!$question['total']) verify($question['options'][0]['percent'] === null, 'No answers must not look like zero percent.');
    }
    $before = lcnDoctorCommunity($pdo, 627)['questions']['effect']['real_count'];
    $pdo->beginTransaction();
    $respondent = bin2hex(random_bytes(32));
    $insert = $pdo->prepare("INSERT INTO doctor_community_answers (dr_id, respondent_key, question_key, context_key, option_value) VALUES (627, ?, 'effect', '', ?)");
    $insert->execute([$respondent, 4]);
    verify(lcnDoctorCommunity($pdo, 627)['questions']['effect']['real_count'] === $before + 1, 'Real answers are not aggregated.');
    try { $insert->execute([$respondent, 1]); throw new RuntimeException('Duplicate answer allowed'); } catch (PDOException $expectedError) { verify($expectedError->getCode() === '23000', 'Unexpected duplicate error'); }
    try { $insert->execute([bin2hex(random_bytes(32)), 5]); throw new RuntimeException('Invalid scale option allowed'); } catch (PDOException $expectedError) { verify($expectedError->getCode() === '23000', 'Unexpected option error'); }
    putenv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=1');
    $combined = lcnDoctorCommunity($pdo, 627)['questions']['effect'];
    verify($combined['real_count'] === $before + 1 && $combined['dummy_count'] > 0, 'Source separation failed');
    $pdo->rollBack();
    echo "PASS: 39 doctors, 11 questions, valid distributions, dummy switch on/off, real/dummy separation, uniqueness, allowed options. Test inserts rolled back.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    putenv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=' . ($originalFlag === false ? '' : $originalFlag));
}
