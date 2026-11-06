<?php
require_once __DIR__.'/../scripts/prepare_feedback.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);echo 'PASS: '.$message.PHP_EOL;}
$p=fbLocalDatabase();$p->beginTransaction();
try {
 foreach([['title'=>[]],['title'=>'xx']] as $in){try{fbText($in,'title',180,5);throw new RuntimeException('Invalid title accepted');}catch(InvalidArgumentException $e){}}
 check(true,'invalid and short inputs rejected');
 try{fbEmail(['email'=>'not-an-email']);throw new RuntimeException('Invalid email accepted');}catch(InvalidArgumentException $e){}
 foreach([['entity_type'=>'bad','entity_id'=>1],['entity_type'=>'doctor','entity_id'=>2147483647],['entity_type'=>'symptom','entity_id'=>2147483647],['entity_type'=>'treatment','entity_id'=>2147483647]] as $ctx){try{fbContext($p,$ctx);throw new RuntimeException('Invalid entity accepted');}catch(InvalidArgumentException $e){}}
 check(true,'invalid types and nonexistent catalog references rejected');
 foreach(['doctor'=>['tbl_entities_nd','lcn_id'],'treatment'=>['tbl_treatments_nd','treat_nd_id'],'symptom'=>['tbl_symptoms','sym_id']] as $type=>[$table,$col]){$id=$p->query("SELECT `$col` FROM `$table` LIMIT 1")->fetchColumn();if($id)check(fbContext($p,['entity_type'=>$type,'entity_id'=>$id])===[$type,(int)$id],'existing '.$type.' ID preserved');}
 $q=$p->prepare("INSERT INTO tbl_feedback_ideas(title,description,category,moderation) VALUES('Transaction test','A transactional test idea','general',?)");$q->execute(['pending']);$a=(int)$p->lastInsertId();
 try{fbPublic(fbIdea($p,$a));throw new RuntimeException('Pending idea exposed');}catch(InvalidArgumentException $e){}
 check(true,'unmoderated idea blocked');
 $p->prepare("UPDATE tbl_feedback_ideas SET moderation='approved' WHERE id=?")->execute([$a]);fbPublic(fbIdea($p,$a));
 $q->execute(['approved']);$b=(int)$p->lastInsertId();
 $vote=$p->prepare('INSERT IGNORE INTO tbl_feedback_votes(idea_id,voter_key) VALUES(?,?)');$v=str_repeat('a',64);$v2=str_repeat('b',64);$vote->execute([$a,$v]);$vote->execute([$a,$v]);$vote->execute([$b,$v]);$vote->execute([$a,$v2]);
 $count=$p->prepare('SELECT COUNT(*) FROM tbl_feedback_votes WHERE idea_id=?');$count->execute([$a]);check((int)$count->fetchColumn()===2,'unique vote constraint deduplicates browser identity');
 $p->prepare("INSERT INTO tbl_feedback_comments(idea_id,body,moderation) VALUES(?,'<script>alert(1)</script>','pending'),(?,'Visible comment','approved')")->execute([$a,$a]);
 fbMerge($p,$a,$b);$count->execute([$b]);check((int)$count->fetchColumn()===2,'merge preserves votes and deduplicates shared supporters');$count->execute([$a]);check((int)$count->fetchColumn()===0,'source votes removed after transfer');
 $q=$p->prepare('SELECT moderation FROM tbl_feedback_comments WHERE idea_id=?');$q->execute([$b]);check(count($q->fetchAll())===2,'merge preserves approved and pending comments');check((int)fbIdea($p,$a)['merged_into']===$b,'stable source ID retains redirect');
 fbHistory($p,$b,'status','open','progress','Test reason');$q=$p->prepare("SELECT reason FROM tbl_feedback_history WHERE idea_id=? AND event_type='status'");$q->execute([$b]);check($q->fetchColumn()==='Test reason','status reason recorded');
 $p->prepare('DELETE FROM tbl_feedback_votes WHERE idea_id=? AND voter_key=?')->execute([$b,$v]);$count->execute([$b]);check((int)$count->fetchColumn()===1,'support can be withdrawn');
 echo "All database fixtures rolled back.\n";
}finally{if($p->inTransaction())$p->rollBack();}
