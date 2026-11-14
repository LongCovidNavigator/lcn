<?php
require_once __DIR__.'/_feedback.php';
require_once __DIR__.'/_feedback_smtp.php';

function fbSendArchiveMail(string $subject, string $body): bool {
 $from=lcnEnv('LCN_FEEDBACK_NOTIFY_FROM',lcnEnv('LCN_SUBMISSION_NOTIFY_FROM',lcnEnv('LCN_MONITOR_FROM','feedback@lcnavi.de')));
 $headers="From: $from\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
 return fbSmtpSend('admin@lcnavi.de',$subject,$body,$headers);
}

/** One summary per run, with a single reminder for each archive period. */
function fbRunArchiveReminders(PDO $p,bool $dryRun=false,?callable $send=null): array {
 $lock='lcn_feedback_archive:'.substr(hash('sha256',(string)$p->query('SELECT DATABASE()')->fetchColumn()),0,32);
 $q=$p->prepare('SELECT GET_LOCK(?,0)');
 $q->execute([$lock]);
 if((int)$q->fetchColumn()!==1)return [];
 try{
  $days=LCN_FEEDBACK_ARCHIVE_DAYS;
  $pending=[];
  $counts=[];
  foreach(LCN_FEEDBACK_ARCHIVE_TABLES as $kind=>[$table,$state]){
   $rows=$p->query("SELECT id,archived_at FROM $table WHERE $state='archived' AND archive_reminded_at IS NULL AND archived_at<=DATE_SUB(NOW(),INTERVAL $days DAY)")->fetchAll();
   $pending[$kind]=$rows;
   $counts[$kind]=count($rows);
  }
  if($dryRun||!array_sum($counts))return $counts;
  $body="Im LCN-Archiv sind Einträge zur Löschung fällig.\n\nIdeen: {$counts['ideas']}\nKommentare: {$counts['comments']}\nVertrauliches Feedback: {$counts['reports']}\n\nBitte in der Feedback-Verwaltung unter „Archiviert“ prüfen und löschen.\n";
  $send??='fbSendArchiveMail';
  if(!$send('LCN: Löschung im Feedback-Archiv fällig',$body))throw new RuntimeException('Archive reminder was not accepted.');
  $p->beginTransaction();
  try{
   foreach(LCN_FEEDBACK_ARCHIVE_TABLES as $kind=>[$table,$state]){
    $update=$p->prepare("UPDATE $table SET archive_reminded_at=NOW() WHERE id=? AND $state='archived' AND archived_at=?");
    foreach($pending[$kind] as $row)$update->execute([$row['id'],$row['archived_at']]);
   }
   $p->commit();
  }catch(Throwable $error){$p->rollBack();throw $error;}
  return $counts;
 }finally{
  $q=$p->prepare('DO RELEASE_LOCK(?)');
  $q->execute([$lock]);
 }
}
