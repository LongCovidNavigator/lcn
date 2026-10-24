<?php
require_once __DIR__.'/../api/_treatment_duplicates.php';
require_once __DIR__.'/../api/_treatments_nd.php';
$p=lcnTreatmentsNdDatabase();$p->beginTransaction();
try{
 $suffix=bin2hex(random_bytes(5));$ids=[];
 foreach(['Blutwäsche','Blutwäschen','Plasmaaustausch'] as $name){$p->prepare("INSERT INTO tbl_treatments_nd(treatmentname,review_status) VALUES(?,'pending_group')")->execute([$name.' '.$suffix]);$ids[]=(int)$p->lastInsertId();}
 $p->prepare("INSERT INTO tbl_aliases_03(alias,alias_type) VALUES(?,'umbrella_term')")->execute(['Blutwäsche '.$suffix]);$alias=(int)$p->lastInsertId();$p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id) VALUES(?,?)')->execute([$ids[2],$alias]);
 $items=lcnTreatmentDuplicateCandidates($p,'Blutwäsche '.$suffix);if($items[0]['id']!==$ids[0])throw new RuntimeException('Exact match not first');
 $byId=array_column($items,null,'id');if(!isset($byId[$ids[1]])||$byId[$ids[1]]['match_kind']!=='spelling')throw new RuntimeException('Singular/plural missing');if(isset($byId[$ids[2]]))throw new RuntimeException('Group member misclassified');
 $p->prepare("INSERT INTO tbl_aliases_03(alias,alias_type) VALUES(?,'abbreviation')")->execute(['XYZ'.$suffix]);$alias=(int)$p->lastInsertId();$p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id) VALUES(?,?)')->execute([$ids[0],$alias]);
 $items=lcnTreatmentDuplicateCandidates($p,'XYZ'.$suffix);if($items[0]['id']!==$ids[0]||$items[0]['match_kind']!=='identity')throw new RuntimeException('Abbreviation missing');
 echo "PASS: exact name first, singular/plural flagged as spelling, group members excluded, explicit abbreviation recognized. Rolled back.\n";
}finally{$p->rollBack();}
