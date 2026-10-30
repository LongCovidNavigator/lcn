<?php
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/../components/treatments_nd_reduced.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
require_once __DIR__.'/_doctor_online.php';
function lcnTreatmentCostContexts(): array {
 $base=['GKV','PKV','DE-SELF','DE-ABROAD','AT-PUBLIC','AT-ELECTIVE','AT-PRIVATE','AT-ABROAD','CH-BASIC','CH-EXTRA','CH-SELF','CH-ABROAD'];
 return array_merge($base,array_map(static fn($key)=>$key.'-CHF',$base));
}
function lcnTreatmentQuestions(PDO $p,int $id): array {
 $q=ND_REDUCED_SCALES;
 foreach(lcnNdRows($p,"SELECT DISTINCT sym_id FROM tbl_cpl_treatments_nd2symptoms WHERE treat_nd_id=? AND aktiv=1 AND sym_id IS NOT NULL",[$id]) as $r)$q['symptom-'.$r['sym_id']]=ND_REDUCED_SCALES['effect'];return $q;
}
function lcnTreatmentAnswers(PDO $p,int $id,?string $respondent): array {
 $definitions=lcnTreatmentQuestions($p,$id);$counts=[];$own=[];
 foreach($definitions as $key=>$options){foreach(in_array($key,['unit_cost','total_cost'],true)?lcnTreatmentCostContexts():[''] as $context)$counts[$key.($context?':'.$context:'')]=array_fill(0,count($options),0);}
 $aliases=['gesamtbewertung'=>'effect','crash_pem_risiko'=>'pem','durchfuehrungssetting'=>'setting','zugang'=>'access'];
 foreach(lcnNdRows($p,"SELECT question_key,context_key,answer_value,respondent_key,review_status FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=?",[$id]) as $r){
 $key=$aliases[$r['question_key']]??$r['question_key'];$index=array_search($r['answer_value'],$definitions[$key]??[],true);$k=$key.($r['context_key']?':'.$r['context_key']:'');
 if($index===false||!isset($counts[$k]))continue;
 if(in_array($r['review_status'],['active','approved'],true))$counts[$k][$index]++;
 if($respondent!==null&&hash_equals($respondent,$r['respondent_key']))$own[$k]=['value'=>$r['answer_value']];
 }return ['counts'=>$counts,'own_answers'=>(object)$own];
}
function lcnTreatmentComparisonProfiles(PDO $p): array {
 $profiles=[];
 $definitions=ND_REDUCED_SCALES;
 foreach(lcnNdRows($p,'SELECT treat_nd_id,typ,durchfuehrungssetting,zugang FROM tbl_treatments_nd') as $r){$id=(int)$r['treat_nd_id'];$profiles[$id]=['id'=>$id,'counts'=>[],'dummy_counts'=>[],'provider_count'=>0,'independent_at_home'=>lcnNdIndependentAtHome($r),'home_delivery'=>lcnNdCanTreatAtHome($r),'home_visit_setting'=>mb_stripos((string)($r['durchfuehrungssetting']??''),'Hausbesuch')!==false,'freely_available'=>preg_match('/frei erhältlich|Selbstmanagement|eigenständig umsetzbar/iu',(string)($r['zugang']??''))===1,'prescription_required'=>lcnNdRequiresPrescription($r),'online_at_home'=>false];}
 foreach(lcnNdRows($p,'SELECT treat_nd_id,question_key,option_index,answer_count FROM tbl_treatment_dummy_counts_nd') as $r){$id=(int)$r['treat_nd_id'];if(!isset($profiles[$id]))continue;$key=$r['question_key'];$profiles[$id]['dummy_counts'][$key][(int)$r['option_index']]=(int)$r['answer_count'];}
 $aliases=['gesamtbewertung'=>'effect','crash_pem_risiko'=>'pem','durchfuehrungssetting'=>'setting','zugang'=>'access'];
 $rows=lcnNdRows($p,"SELECT a.treat_nd_id,t.typ,t.durchfuehrungssetting,a.question_key,a.context_key,a.answer_value,COUNT(*) AS n FROM tbl_treatment_community_answers_nd a JOIN tbl_treatments_nd t ON t.treat_nd_id=a.treat_nd_id WHERE a.review_status IN ('active','approved') GROUP BY a.treat_nd_id,t.typ,t.durchfuehrungssetting,a.question_key,a.context_key,a.answer_value");
 foreach($rows as $r){
  $key=$aliases[$r['question_key']]??$r['question_key'];
  if(!isset($definitions[$key]))continue;
  $index=array_search($r['answer_value'],$definitions[$key],true);
  $cost=in_array($key,['unit_cost','total_cost'],true);
  if($index===false||!in_array($r['context_key'],$cost?lcnTreatmentCostContexts():[''],true))continue;
  $id=(int)$r['treat_nd_id'];$k=$key.($cost?':'.$r['context_key']:'');
  if(!isset($profiles[$id]))$profiles[$id]=['id'=>$id,'counts'=>[],'independent_at_home'=>lcnNdIndependentAtHome($r),'home_delivery'=>lcnNdCanTreatAtHome($r),'home_visit_setting'=>mb_stripos((string)($r['durchfuehrungssetting']??''),'Hausbesuch')!==false,'freely_available'=>preg_match('/frei erhältlich|Selbstmanagement|eigenständig umsetzbar/iu',(string)($r['zugang']??''))===1,'prescription_required'=>lcnNdRequiresPrescription($r),'online_at_home'=>false];
  if(!isset($profiles[$id]['counts'][$k]))$profiles[$id]['counts'][$k]=array_fill(0,count($definitions[$key]),0);
  $profiles[$id]['counts'][$k][$index]+=(int)$r['n'];
 }
 foreach(lcnNdRows($p,"SELECT c.treat_nd_id,COUNT(DISTINCT c.lcn_id) n FROM tbl_cpl_entities2treatments_nd c JOIN tbl_entities_nd e ON e.lcn_id=c.lcn_id AND e.aktiv=1 WHERE c.relation_status IN ('bestand','belegt') GROUP BY c.treat_nd_id") as $row){$id=(int)$row['treat_nd_id'];if(isset($profiles[$id]))$profiles[$id]['provider_count']=(int)$row['n'];}
 $remote=lcnDoctorOnlineAccess($p);
 foreach(lcnNdRows($p,"SELECT treat_nd_id,lcn_id FROM tbl_cpl_entities2treatments_nd WHERE relation_status IN ('bestand','belegt') AND lcn_id IS NOT NULL") as $provider){$id=(int)$provider['treat_nd_id'];if(isset($profiles[$id])&&$profiles[$id]['home_delivery']&&($remote[(int)$provider['lcn_id']]['complete']??false))$profiles[$id]['online_at_home']=true;}
 foreach($profiles as &$profile)$profile['providers']=[];unset($profile);
 foreach(lcnNdRows($p,"SELECT DISTINCT c.treat_nd_id,c.lcn_id,l.loc_lat,l.loc_lng,e.hausbesuche FROM tbl_cpl_entities2treatments_nd c JOIN tbl_entities_nd e ON e.lcn_id=c.lcn_id AND e.aktiv=1 LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=e.lcn_id WHERE c.relation_status IN ('bestand','belegt')") as $provider){$id=(int)$provider['treat_nd_id'];if(isset($profiles[$id]))$profiles[$id]['providers'][]=['id'=>(int)$provider['lcn_id'],'lat'=>$provider['loc_lat']===null?null:(float)$provider['loc_lat'],'lng'=>$provider['loc_lng']===null?null:(float)$provider['loc_lng'],'home_visit'=>$provider['hausbesuche']==='ja'];}
 return array_values($profiles);
}
function lcnSaveTreatmentAnswer(PDO $p,int $id,string $respondent,string $key,string $context,?string $value): void {
 $questions=lcnTreatmentQuestions($p,$id);if(!isset($questions[$key])||!in_array($context,in_array($key,['unit_cost','total_cost'],true)?lcnTreatmentCostContexts():[''],true)||($value!==null&&!in_array($value,$questions[$key],true)))throw new InvalidArgumentException('Ungültige Antwort.');
 if($value===null){$q=$p->prepare('DELETE FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=? AND respondent_key=? AND question_key=? AND context_key=?');$q->execute([$id,$respondent,$key,$context]);}
 else{$q=$p->prepare("INSERT INTO tbl_treatment_community_answers_nd(treat_nd_id,respondent_key,question_key,context_key,answer_value) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE context_key=VALUES(context_key),answer_value=VALUES(answer_value)");$q->execute([$id,$respondent,$key,$context,$value]);}
}

function lcnMoveTreatmentCostContext(PDO $p,int $id,string $respondent,string $context): void {
 if(!in_array($context,lcnTreatmentCostContexts(),true))throw new InvalidArgumentException('Ungültiger Versicherungskontext.');
 $own=!$p->inTransaction();if($own)$p->beginTransaction();
 try{$rows=lcnNdRows($p,"SELECT question_key,answer_value FROM tbl_treatment_community_answers_nd WHERE treat_nd_id=? AND respondent_key=? AND question_key IN ('unit_cost','total_cost') FOR UPDATE",[$id,$respondent]);foreach($rows as $row)lcnSaveTreatmentAnswer($p,$id,$respondent,$row['question_key'],$context,$row['answer_value']);if($own)$p->commit();}catch(Throwable $e){if($own)$p->rollBack();throw $e;}
}
