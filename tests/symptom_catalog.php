<?php
require_once __DIR__.'/../scripts/prepare_symptom_catalog.php';
function checkSym(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);echo "PASS: $message\n";}
$p=symLocalDatabase();$p->beginTransaction();
try{
 $name='__symptom_test_'.bin2hex(random_bytes(6));$key=str_repeat('c',64);
 $p->prepare('INSERT INTO tbl_symptoms(sym_name,sym_category) VALUES(?,?)')->execute([$name,'Test A']);$sym=(int)$p->lastInsertId();
 $insert=$p->prepare('INSERT INTO tbl_symptom_requests(sym_id,name,category,category_snapshot,reason,voter_key) VALUES(?,?,?,?,?,?)');
 $insert->execute([$sym,$name,'Test B','Test A','Test',$key]);$id=(int)$p->lastInsertId();symReview($p,$id,true);checkSym(symRecord($p,$sym)['sym_category']==='Test B','approved category applied');
 try{symReview($p,$id,true);throw new RuntimeException('Repeated approval accepted');}catch(InvalidArgumentException $e){}checkSym(true,'repeated moderation rejected');
 $insert->execute([$sym,$name,'Test C','Test A','Stale',$key]);$stale=(int)$p->lastInsertId();try{symReview($p,$stale,true);throw new RuntimeException('Stale category accepted');}catch(InvalidArgumentException $e){}checkSym(symRecord($p,$sym)['sym_category']==='Test B','stale category proposal blocked');symReview($p,$stale,false);
 $insert->execute([null,$name.' new','Test New','','New',$key]);$new=(int)$p->lastInsertId();symReview($p,$new,true);$q=$p->prepare('SELECT COUNT(*) FROM tbl_symptoms WHERE sym_name=?');$q->execute([$name.' new']);checkSym((int)$q->fetchColumn()===1,'new symptom created on approval');
 $insert->execute([null,$name.' new','Test New','','Duplicate',$key]);$duplicate=(int)$p->lastInsertId();try{symReview($p,$duplicate,true);throw new RuntimeException('Duplicate accepted');}catch(InvalidArgumentException $e){}checkSym(true,'existing symptom cannot be approved twice');
 foreach([['name'=>[]],['name'=>'x']] as $bad){try{symText($bad,'name',100,2);throw new RuntimeException('Invalid name accepted');}catch(InvalidArgumentException $e){}}checkSym(true,'invalid names rejected');
 echo 'Category count: '.count(symCategories($p))."\n";
 echo 'Column: '.$p->query("SHOW COLUMNS FROM tbl_symptoms LIKE 'sym_category'")->fetch()['Type']."\n";
}finally{$p->rollBack();echo "All database fixtures rolled back.\n";}
