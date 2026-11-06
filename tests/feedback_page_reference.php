<?php
require_once __DIR__.'/../scripts/prepare_feedback.php';
require_once __DIR__.'/../api/_feedback_page_reference.php';
function refCheck($ok,$label){if(!$ok)throw new RuntimeException($label);echo 'PASS: '.$label.PHP_EOL;}
foreach([
 ['page_path'=>'https://example.org','reference_mode'=>'confirm'],
 ['page_path'=>'../private/lcn.env','reference_mode'=>'confirm'],
 ['page_path'=>'index.html','reference_mode'=>'none'],
 ['page_path'=>'','reference_mode'=>'confirm'],
 ['page_path'=>'arzt_detail.html?id=542','entity_type'=>'doctor','entity_id'=>613,'reference_mode'=>'other'],
 ['page_path'=>'index.html','entity_type'=>'doctor','entity_id'=>542,'reference_mode'=>'other']
] as $in){try{fbReferencePath($in);throw new RuntimeException('Invalid reference accepted');}catch(InvalidArgumentException $e){}}
refCheck(true,'external paths, traversal, mismatched entities, stale removed context and missing confirmation rejected');
refCheck(fbReferencePath(['page_path'=>'index.html?q=private','reference_mode'=>'confirm'])==='index.html','unapproved query parameters removed');
refCheck(fbReferencePath(['page_path'=>'arzt_detail.html?id=542#zugang','entity_type'=>'doctor','entity_id'=>542,'reference_mode'=>'confirm'])==='arzt_detail.html?id=542#zugang','entity and active tab preserved');
refCheck(fbReferencePath(['page_path'=>'','reference_mode'=>'none'])==='','no-reference submission supported');
$p=fbLocalDatabase();$p->beginTransaction();try{
$p->exec("INSERT INTO tbl_feedback_ideas(title,description,category) VALUES('Reference transaction test','A reference test description','general')");$id=(int)$p->lastInsertId();
$p->prepare('INSERT INTO tbl_feedback_page_references(idea_id,page_path,section_label,element_label) VALUES(?,?,?,?)')->execute([$id,'arzt_detail.html?id=542#zugang','Zugänglichkeit','Kosten']);
$q=$p->prepare('SELECT * FROM tbl_feedback_page_references WHERE idea_id=?');$q->execute([$id]);$r=$q->fetch();refCheck($r['section_label']==='Zugänglichkeit'&&$r['element_label']==='Kosten','page context persisted separately from description');refCheck(fbReadPageReference($p,$id)['label']==='Behandler-Detailseite','reference uses the correct public page wording');
$p->prepare('DELETE FROM tbl_feedback_ideas WHERE id=?')->execute([$id]);$q->execute([$id]);refCheck(!$q->fetch(),'reference follows its idea foreign key');
}finally{$p->rollBack();}
echo "All reference fixtures rolled back.\n";
