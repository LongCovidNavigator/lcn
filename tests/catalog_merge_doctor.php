<?php
require __DIR__.'/../api/_catalog_merge.php';$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $suffix=bin2hex(random_bytes(5));$p->prepare("INSERT INTO tbl_entities_nd(anzeigename,website) VALUES(?,?)")->execute(['Alt '.$suffix,'https://old.example']);$old=(int)$p->lastInsertId();
 $p->prepare("INSERT INTO community_submissions(entity_type,submission_kind,name,payload,submitter_key,duplicate_target_id) VALUES('doctor','new',?,?,?,?)")->execute(['Neu '.$suffix,json_encode(['website'=>'https://new.example']),hash('sha256',$suffix),$old]);$sid=(int)$p->lastInsertId();$row=lcnNdRows($p,'SELECT * FROM community_submissions WHERE submission_id=?',[$sid])[0];
 foreach([$old,-$sid] as $keep){$p->exec('SAVEPOINT direction');$plan=lcnMergePreview($p,$row,$keep);$choices=[];foreach($plan['conflicts'] as $c)$choices[$c['key']]='source';$target=lcnApplyCatalogMerge($p,$plan,$choices,$sid);if($target<1)throw new RuntimeException('No persistent destination');$p->exec('ROLLBACK TO SAVEPOINT direction');}
 echo "PASS: unpublished doctor proposal can merge into existing ID or retain the proposed record, with explicit conflict decisions. Rolled back.\n";
}finally{$p->rollBack();}
