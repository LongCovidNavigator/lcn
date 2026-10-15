<?php
// Real treatment-wide ratings, using the same approved answer source as treatment_answer.php.
function lcnApplyDoctorTreatmentRatings(PDO $pdo, array $treatments): array
{
    $ids=array_values(array_unique(array_map('intval',array_column($treatments,'treat_id'))));
    if(!$ids)return $treatments;
    $query=$pdo->prepare("SELECT treat_nd_id,answer_value,COUNT(*) n FROM tbl_treatment_community_answers_nd WHERE treat_nd_id IN (".implode(',',array_fill(0,count($ids),'?')).") AND question_key IN ('effect','gesamtbewertung') AND context_key='' AND review_status IN ('active','approved') AND answer_value IN ('Verschlechterung','Keine Veränderung','Verbesserung','Heilung') GROUP BY treat_nd_id,answer_value");
    $query->execute($ids);
    $counts=[];
    foreach($query as $row)$counts[(int)$row['treat_nd_id']][$row['answer_value']]=(int)$row['n'];
    foreach($treatments as &$treatment){
        $values=$counts[(int)$treatment['treat_id']]??[];
        $treatment['contra']=$values['Verschlechterung']??0;
        $treatment['neutral']=$values['Keine Veränderung']??0;
        $treatment['pro']=$values['Verbesserung']??0;
        $treatment['healing']=$values['Heilung']??0;
        $total=array_sum($values);
        $treatment['total_votes']=$total;
        foreach(['negative_ratio'=>'contra','neutral_ratio'=>'neutral','improvement_ratio'=>'pro','healing_ratio'=>'healing'] as $ratio=>$key)$treatment[$ratio]=$total?round(100*$treatment[$key]/$total,1):0;
        $treatment['positive_ratio']=$total?100*($treatment['pro']+$treatment['healing'])/$total:0;
    }
    unset($treatment);
    return $treatments;
}
