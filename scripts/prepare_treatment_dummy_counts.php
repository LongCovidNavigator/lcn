<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_treatment_answers.php';
$p=lcnTreatmentsNdDatabase();
$p->exec(file_get_contents(__DIR__.'/../migrations/018_treatment_dummy_counts.sql'));
$insert=$p->prepare('INSERT IGNORE INTO tbl_treatment_dummy_counts_nd VALUES (?,?,?,?)');
$items=lcnNdRows($p,'SELECT treat_nd_id FROM tbl_treatments_nd');
$p->beginTransaction();
try {
 foreach($items as $item)foreach(lcnTreatmentQuestions($p,(int)$item['treat_nd_id']) as $key=>$labels){
  $id=(int)$item['treat_nd_id'];$peak=crc32("$id:$key:peak")%count($labels);
  foreach($labels as $i=>$label){$count=2+crc32("$id:$key:$i")%13+($i===$peak?35:0);$insert->execute([$id,$key,$i,$count]);}
 }
 $p->commit();
}catch(Throwable $e){$p->rollBack();throw $e;}
echo count($items)." therapies have persistent, separate dummy counts.\n";
