<?php
require_once __DIR__.'/../scripts/prepare_feedback.php';
$p=fbLocalDatabase();$prefix=$argv[1]??'';if(!preg_match('/^__LCN_FEEDBACK_TEST_[a-f0-9]{16}__$/',$prefix))throw new RuntimeException('Invalid fixture prefix');
$p->beginTransaction();try{
$q=$p->prepare('SELECT id FROM tbl_feedback_ideas WHERE LEFT(title,?)=? FOR UPDATE');$q->execute([strlen($prefix),$prefix]);$ids=$q->fetchAll(PDO::FETCH_COLUMN);
foreach($ids as $id)$p->prepare('UPDATE tbl_feedback_ideas SET merged_into=NULL WHERE id=?')->execute([$id]);
foreach($ids as $id)$p->prepare('DELETE FROM tbl_feedback_ideas WHERE id=?')->execute([$id]);
$p->prepare('DELETE FROM tbl_feedback_reports WHERE LEFT(body,?)=?')->execute([strlen($prefix),$prefix]);$p->commit();echo "Local HTTP test fixtures cleaned.\n";
}catch(Throwable $e){$p->rollBack();throw $e;}
