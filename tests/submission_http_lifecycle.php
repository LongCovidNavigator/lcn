<?php
if(PHP_SAPI !== 'cli'){http_response_code(404);exit;}
// Local HTTP integration: only uniquely marked test records are removed in finally.
require __DIR__.'/../api/_doctor_hybrid.php';
$p=lcnDoctorDatabase();$token=bin2hex(random_bytes(32));$who=hash_hmac('sha256',$token,lcnEnv('LCN_VOTER_SECRET'));$prefix='LCN QA '.bin2hex(random_bytes(5));$doctors=[];$therapies=[];$symptoms=[];
function httpTest($url,$data=null,$expected=200){global $token;$c=curl_init('http://localhost/lcn/api/'.$url);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_COOKIE=>'lcn_voter='.$token,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Origin: http://localhost','X-LCN-Admin-Request: 1']]);if($data!==null)curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($data)]);$raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);$json=json_decode($raw,true);if($status!==$expected||!is_array($json)||($expected<400&&!($json['ok']??false)))throw new RuntimeException($url.' HTTP '.$status.' '.$raw);return $json;}
function okHttp($test,$message){if(!$test)throw new RuntimeException($message);}
try{
 $new=httpTest('create_submission.php',['type'=>'doctor','name'=>$prefix.' Behandler','website'=>'https://example.test','simple_doctor'=>true,'city'=>'Wien','country'=>'AT','postal_code'=>'1010','street'=>'Testgasse','lat'=>48.2082,'lng'=>16.3738,'treatment_ids'=>[1]],201);$sid=$new['submission_id'];
 $pending=httpTest('catalog_relations.php?type=treatment&id=1');okHttp(in_array($sid,array_column($pending['pending'],'submission_id')),'New provider not immediately visible');
 httpTest('doctor_submission.php',['id'=>$sid,'question'=>'adaptation','value'=>5]);httpTest('doctor_submission.php',['id'=>$sid,'question'=>'costs-gkv','value'=>4]);
 $cost=httpTest('doctor_submission.php',['id'=>$sid,'action'=>'move_cost_context','question'=>'costs-at-public']);okHttp($cost['questions']['costs-at-public']['own']===4&&$cost['questions']['costs-gkv']['own']===null,'Pending cost context transfer');
 httpTest('catalog_relation_feedback.php',['key'=>'s:'.$sid,'stance'=>1]);
 $reviews=httpTest('review_submissions.php?status=all');$review=array_values(array_filter($reviews['items'],fn($r)=>$r['submission_id']===$sid))[0];okHttp($review['community_feedback']===['confirm'=>1,'oppose'=>0],'Admin must show confirmations separately from objections');
 $approved=httpTest('review_submissions.php',['submission_id'=>$sid,'action'=>'approve']);$dr=$approved['approved_target_id'];$doctors[]=$dr;
 $redirect=httpTest('doctor_submission.php?id='.$sid);okHttp($redirect['approved_target_id']===$dr,'Approved provisional page must redirect');
 httpTest('review_submissions.php',['submission_id'=>$sid,'action'=>'approve'],409);
 $q=$p->prepare('SELECT COUNT(*) FROM doctor_community_answers WHERE dr_id=? AND respondent_key=?');$q->execute([$dr,$who]);okHttp((int)$q->fetchColumn()===2,'Provisional answers lost on approval');
 $new=httpTest('create_submission.php',['type'=>'treatment','name'=>$prefix.' Therapie','simple_treatment'=>true,'doctor_ids'=>[$dr],'treatment_category'=>'Diagnostik'],201);$tidSubmission=$new['submission_id'];$pending=httpTest('catalog_relations.php?type=doctor&id='.$dr);okHttp(in_array($tidSubmission,array_column($pending['pending'],'submission_id')),'New therapy not immediately visible');
 httpTest('catalog_relation_feedback.php',['key'=>'s:'.$tidSubmission,'stance'=>-1]);$reviews=httpTest('review_submissions.php?status=all');$review=array_values(array_filter($reviews['items'],fn($r)=>$r['submission_id']===$tidSubmission))[0];okHttp($review['community_feedback']===['confirm'=>0,'oppose'=>1],'Admin must show objections');$a=httpTest('review_submissions.php',['submission_id'=>$tidSubmission,'action'=>'approve']);$tid=$a['approved_target_id'];$therapies[]=$tid;
 foreach(['doctor'=>$dr,'treatment'=>$tid] as $type=>$target){$name=$prefix.' Symptom '.$type;httpTest('symptom_proposal.php',['type'=>$type,'id'=>$target,'name'=>$name]);$pending=httpTest('symptom_proposal.php?type='.$type.'&id='.$target);$match=array_values(array_filter($pending['pending'],fn($r)=>$r['name']===$name));okHttp(count($match)===1,'Pending symptom invisible');httpTest('review_submissions.php',['submission_id'=>$match[0]['id'],'action'=>'approve']);$q=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE sym_name=?');$q->execute([$name]);$symptoms[]=(int)$q->fetchColumn();}
 $r=httpTest('catalog_relations.php',['action'=>'remove','doctor_id'=>$dr,'treatment_id'=>$tid],201);httpTest('review_submissions.php',['submission_id'=>$r['submission_id'],'action'=>'approve']);
 $q=$p->prepare('SELECT COUNT(*) FROM tbl_cpl_entities2treatments_nd WHERE lcn_id=? AND treat_nd_id=?');$q->execute([$dr,$tid]);okHttp((int)$q->fetchColumn()===0,'Removal failed');
 $r=httpTest('catalog_relations.php',['action'=>'add','doctor_id'=>$dr,'treatment_id'=>$tid],201);$dup=httpTest('catalog_relations.php',['action'=>'add','doctor_id'=>$dr,'treatment_id'=>$tid]);okHttp($dup['submission_id']===$r['submission_id'],'Duplicate proposal');httpTest('review_submissions.php',['submission_id'=>$r['submission_id'],'action'=>'reject']);
 echo "PASS HTTP: submit doctor/therapy/symptoms, immediate pending lists, provisional voting, cost transfer, approve, redirect, repeat-decision guard, remove, duplicate proposal and reject.\n";
}finally{
 $p->beginTransaction();
 try{
  foreach($doctors as $dr){foreach(['tbl_cpl_entities2treatments_nd'=>'lcn_id','tbl_drs_locations_03'=>'dr_id','doctor_community_answers'=>'dr_id','tbl_doctor_symptom_help_links'=>'dr_id','tbl_cpl_drs2terms_03'=>'dr_id'] as $table=>$col)$p->prepare("DELETE FROM $table WHERE $col=?")->execute([$dr]);$p->prepare('DELETE FROM tbl_entities_nd WHERE lcn_id=? AND anzeigename LIKE ?')->execute([$dr,$prefix.'%']);}
  foreach($therapies as $tid){foreach(['tbl_cpl_entities2treatments_nd','tbl_treatment_symptom_help_links'] as $table)$p->prepare("DELETE FROM $table WHERE treat_nd_id=?")->execute([$tid]);$p->prepare('DELETE FROM tbl_treatments_nd WHERE treat_nd_id=? AND treatmentname LIKE ?')->execute([$tid,$prefix.'%']);}
  foreach($symptoms as $id)$p->prepare('DELETE FROM tbl_symptoms WHERE sym_id=? AND sym_name LIKE ?')->execute([$id,$prefix.'%']);
  $q=$p->prepare('SELECT submission_id FROM community_submissions WHERE submitter_key=?');$q->execute([$who]);foreach($q->fetchAll(PDO::FETCH_COLUMN) as $id){$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key=? AND respondent_key=?')->execute(['s:'.$id,$who]);}
  $p->prepare('DELETE FROM catalog_relation_feedback WHERE respondent_key=?')->execute([$who]);$p->prepare('DELETE FROM community_submissions WHERE submitter_key=?')->execute([$who]);$p->prepare('DELETE FROM vote_request_events WHERE voter_key=?')->execute([$who]);$p->commit();echo "Test records removed.\n";
 }catch(Throwable $e){$p->rollBack();throw $e;}
}
