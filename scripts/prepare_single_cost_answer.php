<?php
// Preserve historical rows before enforcing one cost answer across contexts.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_treatment_answers.php';
$p=lcnTreatmentsNdDatabase();
foreach([
 ['doctor_community_answers','dr_id',"question_key IN ('costs','costs_total_v2')","CASE WHEN question_key IN ('costs','costs_total_v2') THEN 'costs' ELSE NULL END"],
 ['tbl_treatment_community_answers_nd','treat_nd_id',"question_key IN ('unit_cost','total_cost')","CASE WHEN question_key IN ('unit_cost','total_cost') THEN question_key ELSE NULL END"]
] as [$table,$entity,$where,$expression]){
 $backup=$table.'_cost_backup_20261016';
 $p->exec("CREATE TABLE IF NOT EXISTS $backup AS SELECT * FROM $table WHERE $where");
 $rows=$p->query("SELECT * FROM $table WHERE $where ORDER BY updated_at DESC,created_at DESC,question_key DESC,context_key DESC")->fetchAll();
 $seen=[];$removed=0;$p->beginTransaction();
 try{foreach($rows as $row){$key=$row[$entity].'|'.$row['respondent_key'].'|'.($entity==='dr_id'?'costs':$row['question_key']);if(isset($seen[$key])){$q=$p->prepare("DELETE FROM $table WHERE $entity=? AND respondent_key=? AND question_key=? AND context_key=?");$q->execute([$row[$entity],$row['respondent_key'],$row['question_key'],$row['context_key']]);$removed++;}else $seen[$key]=true;}$p->commit();}catch(Throwable $e){$p->rollBack();throw $e;}
 if(!$p->query("SHOW COLUMNS FROM $table LIKE 'single_cost_question'")->fetch())$p->exec("ALTER TABLE $table ADD COLUMN single_cost_question VARCHAR(80) GENERATED ALWAYS AS ($expression) PERSISTENT, ADD UNIQUE KEY unique_single_cost_answer ($entity,respondent_key,single_cost_question)");
 echo "$table: one answer per cost question enforced; $removed older duplicate rows archived.\n";
}
