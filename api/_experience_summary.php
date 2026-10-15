<?php
function lcnExperienceSummary(PDO $pdo): array {
    $result = ['doctor' => [], 'treatment' => []];
    $labels = ['Verschlechterung','Keine Veränderung','Verbesserung','Heilung'];
    foreach ($pdo->query("SELECT dr_id AS id, option_value, COUNT(*) AS n FROM doctor_community_answers WHERE question_key='effect' AND context_key='' AND option_value BETWEEN 1 AND 4 GROUP BY dr_id,option_value") as $row) {
        $id = (int)$row['id'];
        $result['doctor'][$id] ??= [0,0,0,0];
        $result['doctor'][$id][(int)$row['option_value']-1] = (int)$row['n'];
    }
    foreach ($pdo->query("SELECT treat_nd_id AS id,answer_value,COUNT(*) AS n FROM tbl_treatment_community_answers_nd WHERE question_key IN ('effect','gesamtbewertung') AND context_key='' AND review_status IN ('active','approved') GROUP BY treat_nd_id,answer_value") as $row) {
        $index = array_search($row['answer_value'], $labels, true);
        if ($index === false) continue;
        $id = (int)$row['id'];
        $result['treatment'][$id] ??= [0,0,0,0];
        $result['treatment'][$id][$index] += (int)$row['n'];
    }
    return $result;
}
