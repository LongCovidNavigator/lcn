<?php
require_once __DIR__ . '/_doctor_hybrid.php';

// Version 1: stable question keys; insurance is a context, never a cost option.
function lcnDoctorCommunityQuestions(): array
{
    $questions = [
        'adaptation' => ['question' => 'adaptation', 'context' => '', 'labels' => ['Hohe Belastung', 'Etwas belastender', 'Gut angepasst', 'Sehr gut angepasst', 'Individuell anpassbar']],
        'wait' => ['question' => 'wait', 'context' => '', 'labels' => ['Wenige Tage', 'Mehrere Wochen', 'Mehrere Monate', 'Etwa ein Jahr', 'Mehr als ein Jahr / mehrere Jahre']],
        'wait-followup' => ['question' => 'wait_followup', 'context' => '', 'labels' => ['Wenige Tage', 'Mehrere Wochen', 'Mehrere Monate', 'Etwa ein Jahr', 'Mehr als ein Jahr / mehrere Jahre']],
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

function lcnDoctorCommunity(PDO $pdo, int $doctorId, ?bool $includeDummy = null): array
{
    if (!lcnDoctorExists($doctorId)) throw new InvalidArgumentException('Unknown doctor');
    $includeDummy ??= lcnDoctorCommunityIncludesDummy();
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
    $treatmentExamples = [];
    if ($includeDummy) {
        $query = $pdo->prepare('SELECT e.* FROM treatment_experience_dummy_counts e WHERE EXISTS (SELECT 1 FROM v_lcn_provider_treatments p WHERE p.treat_id=e.treat_id AND p.dr_id=?)');
        $query->execute([$doctorId]);
        foreach ($query as $row) $treatmentExamples[(int)$row['treat_id']] = array_map('intval', $row);
    }
    return ['include_dummy' => $includeDummy, 'schema_version' => 1, 'questions' => $questions, 'treatment_experiences' => (object)$treatmentExamples, 'comparison_profiles' => lcnDoctorComparisonProfiles($pdo, $includeDummy), 'adaptation_benchmark' => lcnDoctorAdaptationBenchmark($pdo, $includeDummy)];
}

function lcnDoctorComparisonProfiles(PDO $pdo, bool $includeDummy): array
{
    $profiles=[];
    foreach(lcnAllDoctorIds() as $id) $profiles[$id]=['id'=>$id,'questions'=>[],'treatmentCount'=>0,'categoryCount'=>0,'editorialCount'=>0,'editorialTotal'=>0,'lat'=>null,'lng'=>null];
    $definitions=[];
    foreach(lcnDoctorCommunityQuestions() as $key=>$def) $definitions[$def['question'].'|'.$def['context']]=[$key,count($def['labels'])];
    foreach($includeDummy?['doctor_community_answers','doctor_community_dummy_answers']:['doctor_community_answers'] as $table) {
        foreach($pdo->query("SELECT dr_id,question_key,context_key,option_value,COUNT(*) n FROM $table GROUP BY dr_id,question_key,context_key,option_value") as $row) {
            $id=(int)$row['dr_id'];$definition=$definitions[$row['question_key'].'|'.$row['context_key']]??null;
            if(!isset($profiles[$id])||!$definition)continue;
            [$key,$size]=$definition;
            if(!isset($profiles[$id]['questions'][$key]))$profiles[$id]['questions'][$key]=['options'=>array_fill(0,$size,['count'=>0])];
            $profiles[$id]['questions'][$key]['options'][(int)$row['option_value']-1]['count']+=(int)$row['n'];
        }
    }
    $total=(int)$pdo->query('SELECT COUNT(*) FROM tbl_treatments_nd WHERE is_top_treatment=1')->fetchColumn();
    foreach($pdo->query("SELECT p.dr_id,COUNT(DISTINCT p.treat_id) treatments,COUNT(DISTINCT NULLIF(TRIM(t.typ),'')) categories,COUNT(DISTINCT CASE WHEN n.is_top_treatment=1 THEN p.treat_id END) editorial FROM v_lcn_provider_treatments p JOIN v_lcn_treatments t ON t.treat_id=p.treat_id LEFT JOIN tbl_treatments_nd n ON n.treat_nd_id=p.treat_id GROUP BY p.dr_id") as $row) {
        $id=(int)$row['dr_id'];if(!isset($profiles[$id]))continue;
        $profiles[$id]['treatmentCount']=(int)$row['treatments'];$profiles[$id]['categoryCount']=(int)$row['categories'];$profiles[$id]['editorialCount']=(int)$row['editorial'];$profiles[$id]['editorialTotal']=$total;
    }
    $located=[];
    foreach($pdo->query('SELECT dr_id,loc_lat,loc_lng FROM tbl_drs_locations_03 WHERE loc_lat IS NOT NULL AND loc_lng IS NOT NULL ORDER BY loc_is_primary DESC,loc_id') as $row) {
        $id=(int)$row['dr_id'];if(!isset($profiles[$id])||isset($located[$id]))continue;
        $profiles[$id]['lat']=(float)$row['loc_lat'];$profiles[$id]['lng']=(float)$row['loc_lng'];$located[$id]=true;
    }
    return array_values($profiles);
}

function lcnDoctorAdaptationBenchmark(PDO $pdo, bool $includeDummy): array
{
    $ids = implode(',', lcnAllDoctorIds());
    $sources = ["SELECT dr_id, option_value, 0 AS is_dummy FROM doctor_community_answers WHERE question_key='adaptation' AND context_key='' AND dr_id IN ($ids)"];
    if ($includeDummy) $sources[] = "SELECT dr_id, option_value, 1 AS is_dummy FROM doctor_community_dummy_answers WHERE question_key='adaptation' AND context_key='' AND dr_id IN ($ids)";
    $sql = 'SELECT AVG(doctor_mean) AS mean, COUNT(*) AS doctor_count, COALESCE(SUM(answer_count),0) AS answer_count, COALESCE(SUM(dummy_count),0) AS dummy_count FROM (SELECT dr_id, AVG(option_value) AS doctor_mean, COUNT(*) AS answer_count, SUM(is_dummy) AS dummy_count FROM ('.implode(' UNION ALL ', $sources).') answers GROUP BY dr_id HAVING COUNT(*) >= 11) doctors';
    $row = $pdo->query($sql)->fetch();
    return ['mean' => $row['mean'] === null ? null : round((float)$row['mean'], 1), 'doctor_count' => (int)$row['doctor_count'], 'catalog_count' => count(lcnAllDoctorIds()), 'answer_count' => (int)$row['answer_count'], 'dummy_count' => (int)$row['dummy_count']];
}
