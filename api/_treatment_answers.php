<?php
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/../components/treatments_nd_reduced.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
function lcnTreatmentQuestions(PDO $p,int $id): array {
 $q=ND_REDUCED_SCALES;
 foreach(lcnNdRows($p,"SELECT DISTINCT sym_id FROM tbl_cpl_treatments_nd2symptoms WHERE treat_nd_id=? AND aktiv=1 AND sym_id IS NOT NULL",[$id]) as $r)$q['symptom-'.$r['sym_id']]=ND_REDUCED_SCALES['effect'];return $q;
}
function lcnTreatmentAnswers(PDO $p,int $id,?string $respondent): array {
 $definitions=lcnTreatmentQuestions($p,$id);$counts=[];$own=[];
 foreach($definitions as $key=>$options){foreach(in_array($key,['unit_cost','total_cost'],true)?['GKV','PKV']:[''] as $context)$counts[$key.($context?':'.$context:'')]=array_fill(0,count($options),0);}
 $aliases=['gesamtbewertung'=>'effect','crash_pem_risiko'=>'pem','durchfuehrungssetting'=>'setting','zugang'=>'access'];
 foreach(lcnNdRows($p,"SELECT question_key,context_key,answer_value,respondent_key,review_status FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=?",[$id]) as $r){
 $key=$aliases[$r['question_key']]??$r['question_key'];$index=array_search($r['answer_value'],$definitions[$key]??[],true);$k=$key.($r['context_key']?':'.$r['context_key']:'');
 if($index===false||!isset($counts[$k]))continue;
 if(in_array($r['review_status'],['active','approved'],true))$counts[$k][$index]++;
 if($respondent!==null&&hash_equals($respondent,$r['respondent_key']))$own[$k]=['value'=>$r['answer_value']];
 }return ['counts'=>$counts,'own_answers'=>(object)$own];
}
function lcnSaveTreatmentAnswer(PDO $p,int $id,string $respondent,string $key,string $context,?string $value): void {
 $questions=lcnTreatmentQuestions($p,$id);if(!isset($questions[$key])||!in_array($context,in_array($key,['unit_cost','total_cost'],true)?['GKV','PKV']:[''],true)||($value!==null&&!in_array($value,$questions[$key],true)))throw new InvalidArgumentException('Ungültige Antwort.');
 if($value===null){$q=$p->prepare('DELETE FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=? AND respondent_key=? AND question_key=? AND context_key=?');$q->execute([$id,$respondent,$key,$context]);}
 else{$q=$p->prepare("INSERT INTO tbl_treatment_community_answers_nd(treat_nd_id,respondent_key,question_key,context_key,answer_value) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE answer_value=VALUES(answer_value)");$q->execute([$id,$respondent,$key,$context,$value]);}
}
