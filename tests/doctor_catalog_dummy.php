<?php
require_once __DIR__.'/../api/_doctor_community.php';
$p=lcnDoctorDatabase();$ids=lcnAllDoctorIds();$counts=[];
foreach($p->query('SELECT dr_id,question_key,context_key,COUNT(*) n FROM doctor_community_dummy_answers GROUP BY dr_id,question_key,context_key') as $r)$counts[(int)$r['dr_id']][$r['question_key'].'|'.$r['context_key']]=(int)$r['n'];
foreach($ids as $id)foreach(lcnDoctorCommunityQuestions() as $definition){
 $key=$definition['question'].'|'.$definition['context'];
 if(($counts[$id][$key]??0)<10)throw new RuntimeException("Missing dummy answers for provider $id, $key");
}
$id=end($ids);$on=lcnDoctorCommunity($p,$id,true);$off=lcnDoctorCommunity($p,$id,false);
foreach($on['questions'] as $key=>$q){
 if($q['dummy_count']<10)throw new RuntimeException('Dummy mode did not include catalog answers.');
 if($off['questions'][$key]['dummy_count']!==0)throw new RuntimeException('Dummy answers leaked into real-only mode.');
}
echo 'PASS: '.count($ids)." active providers have at least ten dummy answers in every field/context; real-only mode excludes them.\n";
