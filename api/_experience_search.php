<?php
// Same four-category answers as experience_summary.php, grouped for search filters.
function lcnExperienceSearchSql(string $type, bool $includeDummy): string {
    if ($type === 'doctor') {
        $answers = "SELECT dr_id AS id, option_value - 1 AS effect, 1 AS n FROM doctor_community_answers WHERE question_key='effect' AND context_key='' AND option_value BETWEEN 1 AND 4";
        if ($includeDummy) $answers .= " UNION ALL SELECT dr_id, option_value - 1, 1 FROM doctor_community_dummy_answers WHERE question_key='effect' AND context_key='' AND option_value BETWEEN 1 AND 4";
    } else {
        $answers = "SELECT treat_nd_id AS id, FIELD(answer_value,'Verschlechterung','Keine Veränderung','Verbesserung','Heilung') - 1 AS effect, 1 AS n FROM tbl_treatment_community_answers_nd WHERE question_key IN ('effect','gesamtbewertung') AND context_key='' AND review_status IN ('active','approved') AND answer_value IN ('Verschlechterung','Keine Veränderung','Verbesserung','Heilung')";
        if ($includeDummy) $answers .= " UNION ALL SELECT treat_nd_id, option_index, answer_count FROM tbl_treatment_dummy_counts_nd WHERE question_key='effect' AND option_index BETWEEN 0 AND 3";
    }
    return "(SELECT id, SUM(IF(effect=0,n,0)) AS contra, SUM(IF(effect=1,n,0)) AS neutral, SUM(IF(effect=2,n,0)) AS pro, SUM(IF(effect=3,n,0)) AS healing, SUM(n) AS total_votes FROM ($answers) effect_answers GROUP BY id)";
}
