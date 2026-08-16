<?php

require_once __DIR__ . '/_lcn_db.php';

function lcnBuildVoteMonitoringReport(PDO $pdo): array
{
    $lastSent = $pdo->query("
        SELECT COALESCE(MAX(completed_at), NOW() - INTERVAL 1 DAY)
        FROM vote_monitoring_runs
        WHERE delivery_status = 'sent'
    ")->fetchColumn();
    $periodStart = is_string($lastSent) ? $lastSent : date('Y-m-d H:i:s', time() - 86400);

    $doctorVotes = $pdo->prepare('SELECT COUNT(*) FROM doctor_votes WHERE updated_at >= :period_start');
    $doctorVotes->execute([':period_start' => $periodStart]);
    $doctorVoteCount = (int)$doctorVotes->fetchColumn();

    $treatmentVotes = $pdo->prepare('SELECT COUNT(*) FROM treatment_votes WHERE updated_at >= :period_start');
    $treatmentVotes->execute([':period_start' => $periodStart]);
    $treatmentVoteCount = (int)$treatmentVotes->fetchColumn();

    $events = $pdo->query("
        SELECT event_id, event_type, severity, target_type, target_id,
               vote_count, voter_count, source_count, vote_direction
        FROM vote_abuse_events
        WHERE reported_at IS NULL
        ORDER BY detected_at ASC, event_id ASC
    ")->fetchAll();
    $eventIds = array_map(static fn(array $event): int => (int)$event['event_id'], $events);

    $suspiciousVotes = (int)$pdo->query("
        SELECT
            (SELECT COUNT(*) FROM doctor_votes WHERE review_status = 'suspicious')
            +
            (SELECT COUNT(*) FROM treatment_votes WHERE review_status = 'suspicious')
    ")->fetchColumn();

    $doctorTargets = $pdo->query("
        SELECT d.dr_display_name AS label, v.vote, COUNT(*) AS vote_count
        FROM doctor_votes v
        INNER JOIN tbl_drs_03 d ON d.dr_id = v.dr_id
        WHERE v.review_status = 'suspicious'
        GROUP BY d.dr_id, d.dr_display_name, v.vote
        ORDER BY vote_count DESC, label ASC
        LIMIT 10
    ")->fetchAll();
    $treatmentTargets = $pdo->query("
        SELECT t.behandlung AS label, v.vote, COUNT(*) AS vote_count
        FROM treatment_votes v
        INNER JOIN tbl_treatments_03 t ON t.treat_id = v.treat_id
        WHERE v.review_status = 'suspicious'
        GROUP BY t.treat_id, t.behandlung, v.vote
        ORDER BY vote_count DESC, label ASC
        LIMIT 10
    ")->fetchAll();
    $eventTypes = array_values(array_unique(array_column($events, 'event_type')));
    $hardBlocks = count(array_filter(
        $events,
        static fn(array $event): bool => $event['event_type'] === 'HARD_RATE_LIMIT'
    ));

    $subject = 'LCN Voting-Monitoring – ' . date('d.m.Y');
    $lines = [
        $subject,
        '',
    ];

    if ($events === []) {
        $lines[] = 'Keine auffälligen Voting-Aktivitäten erkannt.';
    } else {
        $lines[] = 'Auffälligkeiten erkannt: ' . count($events);
        $lines[] = 'Verdächtige Votes: ' . $suspiciousVotes;
    }

    $lines[] = '';
    $lines[] = 'Votes seit letztem erfolgreichen Bericht:';
    $lines[] = 'Ärzt:innen: ' . $doctorVoteCount;
    $lines[] = 'Therapien: ' . $treatmentVoteCount;
    $lines[] = 'Abuse-Events: ' . count($events);

    if ($doctorTargets !== []) {
        $lines[] = '';
        $lines[] = 'Betroffene Ärzt:innen:';
        foreach ($doctorTargets as $target) {
            $lines[] = sprintf('- %s – %d %s', $target['label'], $target['vote_count'], $target['vote']);
        }
    }

    if ($treatmentTargets !== []) {
        $lines[] = '';
        $lines[] = 'Betroffene Therapien:';
        foreach ($treatmentTargets as $target) {
            $lines[] = sprintf('- %s – %d %s', $target['label'], $target['vote_count'], $target['vote']);
        }
    }

    if ($eventTypes !== []) {
        $lines[] = '';
        $lines[] = 'Event-Typen: ' . implode(', ', $eventTypes);
        $lines[] = 'Automatisch blockierte Quellen: ' . $hardBlocks;
    }

    $lines[] = '';
    $lines[] = 'Systemstatus: Bericht erfolgreich erzeugt.';

    return [
        'subject' => $subject,
        'body' => implode(PHP_EOL, $lines) . PHP_EOL,
        'period_start' => $periodStart,
        'doctor_vote_count' => $doctorVoteCount,
        'treatment_vote_count' => $treatmentVoteCount,
        'abuse_event_count' => count($events),
        'event_ids' => $eventIds,
    ];
}

function lcnRunVoteMonitoring(bool $dryRun = false): array
{
    $pdo = lcnDatabase();
    $run = $pdo->prepare("INSERT INTO vote_monitoring_runs (delivery_status) VALUES ('running')");
    $run->execute();
    $runId = (int)$pdo->lastInsertId();

    try {
        $report = lcnBuildVoteMonitoringReport($pdo);

        if ($dryRun) {
            $finish = $pdo->prepare("
                UPDATE vote_monitoring_runs
                SET completed_at = NOW(), delivery_status = 'dry_run',
                    doctor_vote_count = :doctor_votes,
                    treatment_vote_count = :treatment_votes,
                    abuse_event_count = :events
                WHERE run_id = :run_id
            ");
            $finish->execute([
                ':doctor_votes' => $report['doctor_vote_count'],
                ':treatment_votes' => $report['treatment_vote_count'],
                ':events' => $report['abuse_event_count'],
                ':run_id' => $runId,
            ]);
            return $report + ['run_id' => $runId, 'delivery_status' => 'dry_run'];
        }

        $to = lcnEnv('LCN_MONITOR_TO');
        $from = lcnEnv('LCN_MONITOR_FROM');

        if ($to === null || $from === null || filter_var($to, FILTER_VALIDATE_EMAIL) === false
            || filter_var($from, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException('Monitoring recipient or sender is not configured.');
        }

        $headers = [
            'From: ' . $from,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        if (!mail($to, $report['subject'], $report['body'], implode("\r\n", $headers))) {
            throw new RuntimeException('Monitoring mail transport reported a failure.');
        }

        $pdo->beginTransaction();

        if ($report['event_ids'] !== []) {
            $placeholders = implode(',', array_fill(0, count($report['event_ids']), '?'));
            $mark = $pdo->prepare("UPDATE vote_abuse_events SET reported_at = NOW() WHERE event_id IN ({$placeholders})");
            $mark->execute($report['event_ids']);
        }

        $finish = $pdo->prepare("
            UPDATE vote_monitoring_runs
            SET completed_at = NOW(), delivery_status = 'sent',
                doctor_vote_count = :doctor_votes,
                treatment_vote_count = :treatment_votes,
                abuse_event_count = :events
            WHERE run_id = :run_id
        ");
        $finish->execute([
            ':doctor_votes' => $report['doctor_vote_count'],
            ':treatment_votes' => $report['treatment_vote_count'],
            ':events' => $report['abuse_event_count'],
            ':run_id' => $runId,
        ]);
        $pdo->commit();

        return $report + ['run_id' => $runId, 'delivery_status' => 'sent'];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        $failed = $pdo->prepare("
            UPDATE vote_monitoring_runs
            SET completed_at = NOW(), delivery_status = 'failed', error_message = :error
            WHERE run_id = :run_id
        ");
        $failed->execute([
            ':error' => substr($error->getMessage(), 0, 255),
            ':run_id' => $runId,
        ]);
        throw $error;
    }
}
