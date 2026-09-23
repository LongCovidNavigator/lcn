<?php
// CLI-only, additive and repeatable. Never writes to existing doctor/research/vote tables.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/_doctor_community.php';
$pdo = lcnDoctorDatabase();
$database = $pdo->query('SELECT DATABASE()')->fetchColumn();
if ($database !== 'lcn_hybrid_database') throw new RuntimeException('Expected local lcn_hybrid_database.');
$sql = file_get_contents(__DIR__ . '/../migrations/011_doctor_community.sql');
foreach (explode(';', $sql) as $statement) {
    if (trim($statement) !== '') $pdo->exec($statement);
}
$questions = lcnDoctorCommunityQuestions();
$pdo->beginTransaction();
try {
    $optionInsert = $pdo->prepare('INSERT INTO doctor_community_options (question_key, context_key, option_value, label) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label)');
    foreach ($questions as $question) {
        foreach ($question['labels'] as $index => $label) $optionInsert->execute([$question['question'], $question['context'], $index + 1, $label]);
    }
    // Existing rows, including manually refined dummy answers, remain unchanged.
    $insert = $pdo->prepare('INSERT INTO doctor_community_dummy_answers (dr_id, respondent_key, question_key, context_key, option_value) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE respondent_key = VALUES(respondent_key)');
    $exists = $pdo->prepare('SELECT COUNT(*) FROM tbl_entities_nd WHERE lcn_id = ? AND aktiv = 1');
    foreach (LCN_PRIORITY_DOCTOR_IDS as $id) {
        $exists->execute([$id]);
        if ((int)$exists->fetchColumn() !== 1) throw new RuntimeException("Missing active doctor $id");
        $respondents = 40 + ($id % 61);
        foreach ($questions as $key => $question) {
            $size = count($question['labels']);
            $peak = (int)(sprintf('%u', crc32("peak:$id:$key")) % $size);
            for ($i = 1; $i <= $respondents; $i++) {
                // Deterministic distributions vary per doctor and question, with a clear peak.
                $roll = (int)(sprintf('%u', crc32("answer:$id:$key:$i")) % 100);
                $value = $roll < 58 ? $peak + 1 : 1 + (int)(sprintf('%u', crc32("tail:$id:$key:$i")) % $size);
                $insert->execute([$id, sprintf('seed-v1-%03d', $i), $question['question'], $question['context'], $value]);
            }
        }
    }
    $pdo->commit();
} catch (Throwable $error) { $pdo->rollBack(); throw $error; }
echo json_encode(['database' => $database, 'doctors' => $pdo->query('SELECT COUNT(DISTINCT dr_id) FROM doctor_community_dummy_answers')->fetchColumn(),
    'dummy_answers' => $pdo->query('SELECT COUNT(*) FROM doctor_community_dummy_answers')->fetchColumn(),
    'real_answers' => $pdo->query('SELECT COUNT(*) FROM doctor_community_answers')->fetchColumn()], JSON_PRETTY_PRINT) . "\n";
