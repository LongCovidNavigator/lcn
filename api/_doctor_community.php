<?php
require_once __DIR__ . '/_doctor_hybrid.php';

// Version 1: stable question keys; insurance is a context, never a cost option.
function lcnDoctorCommunityQuestions(): array
{
    $questions = [
        'adaptation' => ['question' => 'adaptation', 'context' => '', 'labels' => ['Hohe Belastung', 'Etwas belastender', 'Gut angepasst', 'Sehr gut angepasst', 'Individuell anpassbar']],
        'wait' => ['question' => 'wait', 'context' => '', 'labels' => ['Wenige Tage', 'Mehrere Wochen', 'Mehrere Monate', 'Etwa ein Jahr', 'Mehr als ein Jahr / mehrere Jahre']],
        'effect' => ['question' => 'effect', 'context' => '', 'labels' => ['Verschlechterung', 'Keine Veränderung', 'Verbesserung', 'Heilung']],
    ];
    foreach (['gkv', 'pkv', 'de-self', 'de-abroad', 'at-public', 'at-elective', 'at-private', 'at-abroad', 'ch-basic', 'ch-extra', 'ch-self', 'ch-abroad', 'other-self', 'other-abroad'] as $context) {
        $questions['costs-' . $context] = ['question' => 'costs', 'context' => $context, 'labels' => ['Komplett übernommen', 'Bis 100 €', 'Mehrere 100 €', 'Mehrere 1.000 €', '10.000 € oder mehr', 'Mehrere 10.000 €']];
    }
    foreach (['first', 'followup'] as $row => $appointment) {
        foreach (['onsite', 'phone', 'video'] as $column => $form) {
            $questions["appointment-$row-$column"] = ['question' => "appointment_{$appointment}_{$form}", 'context' => '', 'labels' => ['Ja', 'Nein']];
        }
    }
    return $questions;
}

function lcnDoctorCommunityIncludesDummy(): bool
{
    return in_array(strtolower(trim((string)lcnEnv('LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY', '0'))), ['1', 'true', 'yes', 'on'], true);
}

function lcnDoctorCommunity(PDO $pdo, int $doctorId): array
{
    if (!in_array($doctorId, LCN_PRIORITY_DOCTOR_IDS, true)) throw new InvalidArgumentException('Unknown doctor');
    $includeDummy = lcnDoctorCommunityIncludesDummy();
    $counts = [];
    $tables = ['doctor_community_answers' => 'real'];
    if ($includeDummy) $tables['doctor_community_dummy_answers'] = 'dummy';
    foreach ($tables as $table => $source) {
        $statement = $pdo->prepare("SELECT question_key, context_key, option_value, COUNT(*) AS n FROM $table WHERE dr_id = ? GROUP BY question_key, context_key, option_value");
        $statement->execute([$doctorId]);
        foreach ($statement as $row) {
            $counts[$row['question_key']][$row['context_key']][(int)$row['option_value']][$source] = (int)$row['n'];
        }
    }
    $questions = [];
    foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
        $options = [];
        $real = $dummy = 0;
        foreach ($definition['labels'] as $index => $label) {
            $values = $counts[$definition['question']][$definition['context']][$index + 1] ?? [];
            $real += $values['real'] ?? 0;
            $dummy += $values['dummy'] ?? 0;
            $options[] = ['value' => $index + 1, 'label' => $label, 'count' => array_sum($values)];
        }
        $total = $real + $dummy;
        $weighted = 0;
        foreach ($options as &$option) {
            $option['percent'] = $total ? round($option['count'] * 100 / $total, 1) : null;
            $weighted += $option['value'] * $option['count'];
        }
        unset($option);
        $maximum = $total ? max(array_column($options, 'count')) : 0;
        $modes = $total ? array_values(array_filter($options, fn($option) => $option['count'] === $maximum)) : [];
        $questions[$key] = ['total' => $total, 'real_count' => $real, 'dummy_count' => $dummy, 'options' => $options,
            'mode' => count($modes) === 1 ? $modes[0]['value'] : null,
            'mean' => $total ? round($weighted / $total, 1) : null];
    }
    return ['include_dummy' => $includeDummy, 'schema_version' => 1, 'questions' => $questions, 'adaptation_benchmark' => lcnDoctorAdaptationBenchmark($pdo, $includeDummy)];
}

function lcnDoctorAdaptationBenchmark(PDO $pdo, bool $includeDummy): array
{
    $ids = implode(',', LCN_PRIORITY_DOCTOR_IDS);
    $sources = ["SELECT dr_id, option_value, 0 AS is_dummy FROM doctor_community_answers WHERE question_key='adaptation' AND context_key='' AND dr_id IN ($ids)"];
    if ($includeDummy) $sources[] = "SELECT dr_id, option_value, 1 AS is_dummy FROM doctor_community_dummy_answers WHERE question_key='adaptation' AND context_key='' AND dr_id IN ($ids)";
    $sql = 'SELECT AVG(doctor_mean) AS mean, COUNT(*) AS doctor_count, COALESCE(SUM(answer_count),0) AS answer_count, COALESCE(SUM(dummy_count),0) AS dummy_count FROM (SELECT dr_id, AVG(option_value) AS doctor_mean, COUNT(*) AS answer_count, SUM(is_dummy) AS dummy_count FROM ('.implode(' UNION ALL ', $sources).') answers GROUP BY dr_id) doctors';
    $row = $pdo->query($sql)->fetch();
    return ['mean' => $row['mean'] === null ? null : round((float)$row['mean'], 1), 'doctor_count' => (int)$row['doctor_count'], 'catalog_count' => count(LCN_PRIORITY_DOCTOR_IDS), 'answer_count' => (int)$row['answer_count'], 'dummy_count' => (int)$row['dummy_count']];
}
