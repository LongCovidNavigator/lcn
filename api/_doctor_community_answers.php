<?php
require_once __DIR__ . '/_doctor_community.php';
require_once __DIR__ . '/_voting.php';

function lcnDoctorOwnAnswers(PDO $pdo, int $doctorId, ?string $respondent): object
{
    $answers = [];
    if ($respondent !== null) {
        $query = $pdo->prepare('SELECT question_key, context_key, option_value FROM doctor_community_answers WHERE dr_id = ? AND respondent_key = ?');
        $query->execute([$doctorId, $respondent]);
        foreach ($query as $row) foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
            if ($row['question_key'] === $definition['question'] && $row['context_key'] === $definition['context']) $answers[$key] = (int)$row['option_value'];
        }
    }
    return (object)$answers;
}

function lcnSaveDoctorAnswer(PDO $pdo, int $doctorId, string $respondent, string $key, int $value): void
{
    $definition = lcnDoctorCommunityQuestions()[$key] ?? null;
    if (!in_array($doctorId, LCN_PRIORITY_DOCTOR_IDS, true) || !$definition || $value < 1 || $value > count($definition['labels'])) throw new InvalidArgumentException('Ungültige Antwort.');
    $query = $pdo->prepare('INSERT INTO doctor_community_answers (dr_id, respondent_key, question_key, context_key, option_value) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)');
    $query->execute([$doctorId, $respondent, $definition['question'], $definition['context'], $value]);
}
