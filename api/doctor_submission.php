<?php
require_once __DIR__ . '/_submission_treatments.php';
require_once __DIR__ . '/_doctor_community_answers.php';
header('Cache-Control: private, no-store');
try {
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if ($method==='POST') { lcnRequireVotingRequest(); $body=lcnReadJsonBody(); } elseif ($method==='GET') { $body=$_GET; } else { lcnSendVoteJson(['ok'=>false],405); }
    $id=filter_var($body['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $pdo=lcnDoctorDatabase();
    $pdo->beginTransaction();
    $query=$pdo->prepare("SELECT submission_id,name,website,payload,review_status FROM community_submissions WHERE submission_id=? AND entity_type='doctor' AND review_status IN ('pending','reviewing','approved') FOR UPDATE");$query->execute([$id]);$row=$query->fetch();
    if(!$row){$pdo->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>'Eintrag nicht verfügbar.'],404);}
    $definitions=lcnDoctorCommunityQuestions();
    if($method==='POST' && ($body['action']??'')==='reset'){
        $delete=$pdo->prepare('DELETE FROM community_doctor_answers WHERE submission_id=? AND respondent_key=?');$delete->execute([$id,lcnVoterKey()]);
    } elseif($method==='POST' && ($body['action']??'')==='clear'){
        $key=$body['question']??null;
        if(!is_string($key)||!isset($definitions[$key])){$pdo->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Frage.'],422);}
        $definition=$definitions[$key];
        $delete=$pdo->prepare('DELETE FROM community_doctor_answers WHERE submission_id=? AND respondent_key=? AND question_key=? AND context_key=?');$delete->execute([$id,lcnVoterKey(),$definition['question'],$definition['context']]);
    } elseif($method==='POST'){
        $key=$body['question']??null;$value=$body['value']??null;
        if(!is_string($key)||!isset($definitions[$key])||!is_int($value)||$value<1||$value>count($definitions[$key]['labels'])){$pdo->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Antwort.'],422);}
        $definition=$definitions[$key];
        $save=$pdo->prepare('INSERT INTO community_doctor_answers(submission_id,respondent_key,question_key,context_key,option_value) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE option_value=VALUES(option_value)');$save->execute([$id,lcnVoterKey(),$definition['question'],$definition['context'],$value]);
    }
    $query=$pdo->prepare('SELECT question_key,context_key,option_value,COUNT(*) n FROM community_doctor_answers WHERE submission_id=? GROUP BY question_key,context_key,option_value');$query->execute([$id]);$counts=$query->fetchAll();
    $query=$pdo->prepare('SELECT question_key,context_key,option_value FROM community_doctor_answers WHERE submission_id=? AND respondent_key=?');$query->execute([$id,lcnExistingVoterKey()??'']);$own=$query->fetchAll();
    $questions=[];foreach($definitions as $key=>$definition){$options=[];$selected=null;foreach($definition['labels'] as $i=>$label){$count=0;foreach($counts as $r)if($r['question_key']===$definition['question']&&$r['context_key']===$definition['context']&&(int)$r['option_value']===$i+1)$count=(int)$r['n'];$options[]=['label'=>$label,'value'=>$i+1,'count'=>$count];}foreach($own as $r)if($r['question_key']===$definition['question']&&$r['context_key']===$definition['context'])$selected=(int)$r['option_value'];$questions[$key]=['options'=>$options,'own'=>$selected,'total'=>array_sum(array_column($options,'count'))];}
    $pdo->commit();$payload=json_decode($row['payload'],true);
    $treatments=[];$ids=lcnSubmissionTreatmentIds($payload);
    if($ids){$query=$pdo->prepare('SELECT treat_id,behandlung,typ,unterkategorie FROM tbl_treatments_03 WHERE treat_id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$query->execute($ids);foreach($query as $treatment)$treatments[$treatment['typ']?:'Weitere Behandlungen'][]=$treatment;}
    lcnSendVoteJson(['adaptation_benchmark'=>lcnDoctorAdaptationBenchmark($pdo,false),'treatments_grouped'=>(object)$treatments,'ok'=>true,'name'=>$row['name'],'website'=>$row['website'],'organization'=>$payload['organization']??'','primary_care'=>($payload['primary_care']??false)===true,'specialist_care'=>($payload['specialist_care']??false)===true,'address'=>$payload['address']??'','status'=>$row['review_status'],'questions'=>$questions]);
}catch(Throwable $error){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();lcnLogApiError('doctor_submission',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Angaben konnten nicht geladen oder gespeichert werden.'],500);}
