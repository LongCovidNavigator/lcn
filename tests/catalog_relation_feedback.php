<?php
require_once __DIR__.'/../api/_treatments_nd.php';
$p=lcnDoctorDatabase();$p->beginTransaction();try{
$key='d:542:t:1';$user=hash('sha256','catalog-feedback-transaction-test');
$q=$p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,?) ON DUPLICATE KEY UPDATE stance=VALUES(stance)');
$q->execute([$key,$user,1]);$q->execute([$key,$user,-1]);
$check=$p->prepare('SELECT COUNT(*) n,MAX(stance) stance FROM catalog_relation_feedback WHERE relation_key=? AND respondent_key=?');$check->execute([$key,$user]);$row=$check->fetch();if((int)$row['n']!==1||(int)$row['stance']!==-1)throw new Exception('Eine Stimme muss die vorherige ersetzen.');
$p->prepare('DELETE FROM catalog_relation_feedback WHERE relation_key=? AND respondent_key=?')->execute([$key,$user]);$check->execute([$key,$user]);if((int)$check->fetch()['n']!==0)throw new Exception('Zurücknehmen fehlgeschlagen.');echo 'PASS: eine Stimme je Zuordnung, Wechsel und Zurücknehmen; Rollback.'.PHP_EOL;
}finally{$p->rollBack();}
