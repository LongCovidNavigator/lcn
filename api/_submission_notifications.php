<?php
require_once __DIR__ . '/_lcn_db.php';

function lcnSubmissionReviewUrl(): string {
    $configured = lcnEnv('LCN_REVIEW_URL');
    if ($configured !== null && filter_var($configured, FILTER_VALIDATE_URL) !== false) return $configured;
    return 'https://long-covid-navigator.de/freigaben.php';
}

function lcnBuildSubmissionNotification(PDO $pdo): array {
    $lastRun = $pdo->query("SELECT MAX(completed_at) FROM submission_notification_runs WHERE delivery_status IN ('sent','skipped')")->fetchColumn();
    $periodStart = is_string($lastRun) && $lastRun !== '' ? $lastRun : date('Y-m-d H:i:s', time() - 86400);
    $stmt=$pdo->prepare("SELECT submission_id,entity_type,name,city,experience,created_at FROM community_submissions WHERE created_at>:period_start ORDER BY created_at ASC,submission_id ASC");
    $stmt->execute([':period_start'=>$periodStart]);$items=$stmt->fetchAll();
    $pending=(int)$pdo->query("SELECT COUNT(*) FROM community_submissions WHERE review_status IN ('pending','reviewing')")->fetchColumn();
    $doctorCount=count(array_filter($items,static fn(array $item):bool=>$item['entity_type']==='doctor'));
    $treatmentCount=count($items)-$doctorCount;
    $subject=sprintf('LCN: %d neue Vorschläge zur Prüfung',count($items));
    $lines=[$subject,'','Seit dem letzten Bericht sind neue Community-Vorschläge eingegangen:','Ärzt:innen / Praxen: '.$doctorCount,'Behandlungen: '.$treatmentCount,'Insgesamt noch offen: '.$pending];
    if($items){$lines[]='';$lines[]='Neue Vorschläge:';foreach($items as $item){$label=$item['entity_type']==='doctor'?'Praxis':'Behandlung';$place=trim((string)$item['city'])!==''?' – '.$item['city']:'';$rating=$item['experience']!==null?' – Erfahrung: '.$item['experience']:'';$lines[]=sprintf('- #%d [%s] %s%s%s',(int)$item['submission_id'],$label,$item['name'],$place,$rating);}}
    $lines[]='';$lines[]='Jetzt prüfen: '.lcnSubmissionReviewUrl();$lines[]='';$lines[]='Diese Nachricht wurde automatisch vom Long Covid Navigator erstellt.';
    return ['subject'=>$subject,'body'=>implode(PHP_EOL,$lines).PHP_EOL,'period_start'=>$periodStart,'items'=>$items,'new_count'=>count($items),'pending_count'=>$pending];
}

function lcnRunSubmissionNotifications(bool $dryRun=false): array {
    $pdo=lcnDatabase();$run=$pdo->prepare("INSERT INTO submission_notification_runs(delivery_status) VALUES('running')");$run->execute();$runId=(int)$pdo->lastInsertId();
    try{$report=lcnBuildSubmissionNotification($pdo);$status='skipped';
        if($dryRun){$status='dry_run';}
        elseif($report['new_count']>0){
            $to=lcnEnv('LCN_SUBMISSION_NOTIFY_TO',lcnEnv('LCN_MONITOR_TO'));
            $from=lcnEnv('LCN_SUBMISSION_NOTIFY_FROM',lcnEnv('LCN_MONITOR_FROM'));
            if($to===null||$from===null||filter_var($to,FILTER_VALIDATE_EMAIL)===false||filter_var($from,FILTER_VALIDATE_EMAIL)===false)throw new RuntimeException('Submission notification recipient or sender is not configured.');
            $headers=['From: '.$from,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit'];
            if(!mail($to,$report['subject'],$report['body'],implode("\r\n",$headers)))throw new RuntimeException('Submission notification mail transport reported a failure.');
            $status='sent';
        }
        $finish=$pdo->prepare('UPDATE submission_notification_runs SET completed_at=NOW(),period_start=:period,delivery_status=:status,new_submission_count=:new_count,pending_submission_count=:pending WHERE run_id=:id');
        $finish->execute([':period'=>$report['period_start'],':status'=>$status,':new_count'=>$report['new_count'],':pending'=>$report['pending_count'],':id'=>$runId]);
        return $report+['run_id'=>$runId,'delivery_status'=>$status];
    }catch(Throwable $error){$failed=$pdo->prepare("UPDATE submission_notification_runs SET completed_at=NOW(),delivery_status='failed',error_message=:error WHERE run_id=:id");$failed->execute([':error'=>substr($error->getMessage(),0,255),':id'=>$runId]);throw $error;}
}
