<?php

require_once __DIR__ . '/_voting.php';

function lcnVoteSecurityConfig(): array
{
    return [
        'soft_per_minute' => 5,
        'soft_per_10_minutes' => 30,
        'soft_voters_per_10_minutes' => 10,
        'hard_per_10_minutes' => 100,
        'hard_voters_per_10_minutes' => 50,
        'block_minutes' => 30,
        'target_votes_10_minutes' => 15,
        'target_votes_1_hour' => 40,
        'target_direction_10_minutes' => 12,
        'request_retention_hours' => 48,
    ];
}

function lcnVoteSourceKey(): string
{
    $address = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $secret = lcnEnv('LCN_VOTER_SECRET');

    if ($address === '' || $secret === null || strlen($secret) < 32) {
        throw new RuntimeException('Voting source could not be derived.');
    }

    return hash_hmac('sha256', 'source:' . $address, $secret);
}

function lcnCreateOrUpdateAbuseEvent(PDO $pdo, array $event): int
{
    $dedupeKey = hash('sha256', implode('|', [
        $event['event_type'],
        $event['source_key'] ?? '',
        $event['target_type'] ?? '',
        $event['target_id'] ?? '',
        $event['vote_direction'] ?? '',
        $event['bucket'],
    ]));
    $statement = $pdo->prepare("
        INSERT INTO vote_abuse_events (
            event_type, severity, target_type, target_id, window_start, window_end,
            vote_count, voter_count, source_count, vote_direction, source_key,
            details, dedupe_key
        ) VALUES (
            :event_type, :severity, :target_type, :target_id, :window_start, NOW(),
            :vote_count, :voter_count, :source_count, :vote_direction, :source_key,
            :details, :dedupe_key
        )
        ON DUPLICATE KEY UPDATE
            detected_at = NOW(),
            window_start = VALUES(window_start),
            window_end = NOW(),
            vote_count = VALUES(vote_count),
            voter_count = VALUES(voter_count),
            source_count = VALUES(source_count),
            details = VALUES(details),
            event_id = LAST_INSERT_ID(event_id)
    ");
    $statement->execute([
        ':event_type' => $event['event_type'],
        ':severity' => $event['severity'],
        ':target_type' => $event['target_type'] ?? null,
        ':target_id' => $event['target_id'] ?? null,
        ':window_start' => $event['window_start'],
        ':vote_count' => $event['vote_count'] ?? 0,
        ':voter_count' => $event['voter_count'] ?? 0,
        ':source_count' => $event['source_count'] ?? 0,
        ':vote_direction' => $event['vote_direction'] ?? null,
        ':source_key' => $event['source_key'] ?? null,
        ':details' => json_encode($event['details'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':dedupe_key' => $dedupeKey,
    ]);

    return (int)$pdo->lastInsertId();
}

function lcnBeginVoteSecurity(
    PDO $pdo,
    string $targetType,
    int $targetId,
    string $voteDirection,
    string $voterKey
): array {
    $config = lcnVoteSecurityConfig();
    $sourceKey = lcnVoteSourceKey();
    $block = $pdo->prepare('SELECT blocked_until FROM vote_source_blocks WHERE source_key = :source_key');
    $block->execute([':source_key' => $sourceKey]);
    $blockedUntil = $block->fetchColumn();

    if ($blockedUntil !== false && strtotime((string)$blockedUntil) > time()) {
        header('Retry-After: ' . max(1, strtotime((string)$blockedUntil) - time()));
        lcnSendVoteJson(['ok' => false, 'error' => 'Zu viele Voting-Anfragen. Bitte später erneut versuchen.'], 429);
    }

    $insert = $pdo->prepare("
        INSERT INTO vote_request_events (
            source_key, voter_key, target_type, target_id, vote_direction
        ) VALUES (:source_key, :voter_key, :target_type, :target_id, :vote_direction)
    ");
    $insert->execute([
        ':source_key' => $sourceKey,
        ':voter_key' => $voterKey,
        ':target_type' => $targetType,
        ':target_id' => $targetId,
        ':vote_direction' => $voteDirection,
    ]);
    $requestId = (int)$pdo->lastInsertId();

    $counts = $pdo->prepare("
        SELECT
            SUM(occurred_at >= NOW() - INTERVAL 1 MINUTE) AS requests_1m,
            COUNT(*) AS requests_10m,
            COUNT(DISTINCT voter_key) AS voters_10m
        FROM vote_request_events
        WHERE source_key = :source_key
          AND occurred_at >= NOW() - INTERVAL 10 MINUTE
    ");
    $counts->execute([':source_key' => $sourceKey]);
    $row = $counts->fetch() ?: [];
    $requests1m = (int)($row['requests_1m'] ?? 0);
    $requests10m = (int)($row['requests_10m'] ?? 0);
    $voters10m = (int)($row['voters_10m'] ?? 0);
    $primaryEventId = null;

    $signals = [];

    if ($requests1m > $config['soft_per_minute']) {
        $signals[] = ['RATE_1MIN', 'warning', $requests1m, '1m'];
    }

    if ($requests10m > $config['soft_per_10_minutes']) {
        $signals[] = ['RATE_10MIN', 'warning', $requests10m, '10m'];
    }

    if ($voters10m > $config['soft_voters_per_10_minutes']) {
        $signals[] = ['MANY_VOTERS_FROM_SOURCE', 'warning', $requests10m, '10m'];
    }

    foreach ($signals as [$type, $severity, $voteCount, $window]) {
        $eventId = lcnCreateOrUpdateAbuseEvent($pdo, [
            'event_type' => $type,
            'severity' => $severity,
            'source_key' => $sourceKey,
            'window_start' => date('Y-m-d H:i:s', time() - ($window === '1m' ? 60 : 600)),
            'vote_count' => $voteCount,
            'voter_count' => $voters10m,
            'source_count' => 1,
            'bucket' => date('YmdHi', (int)(time() / ($window === '1m' ? 60 : 600)) * ($window === '1m' ? 60 : 600)),
            'details' => ['requests_1m' => $requests1m, 'requests_10m' => $requests10m],
        ]);
        $primaryEventId ??= $eventId;
    }

    if ($requests10m > $config['hard_per_10_minutes'] || $voters10m > $config['hard_voters_per_10_minutes']) {
        $eventId = lcnCreateOrUpdateAbuseEvent($pdo, [
            'event_type' => 'HARD_RATE_LIMIT',
            'severity' => 'critical',
            'source_key' => $sourceKey,
            'window_start' => date('Y-m-d H:i:s', time() - 600),
            'vote_count' => $requests10m,
            'voter_count' => $voters10m,
            'source_count' => 1,
            'bucket' => date('YmdHi', (int)(time() / 600) * 600),
            'details' => ['block_minutes' => $config['block_minutes']],
        ]);
        $block = $pdo->prepare("
            INSERT INTO vote_source_blocks (source_key, blocked_until, reason, event_id)
            VALUES (:source_key, NOW() + INTERVAL :minutes MINUTE, 'HARD_RATE_LIMIT', :event_id)
            ON DUPLICATE KEY UPDATE
                blocked_until = VALUES(blocked_until), reason = VALUES(reason), event_id = VALUES(event_id)
        ");
        $block->bindValue(':source_key', $sourceKey);
        $block->bindValue(':minutes', $config['block_minutes'], PDO::PARAM_INT);
        $block->bindValue(':event_id', $eventId, PDO::PARAM_INT);
        $block->execute();
        header('Retry-After: ' . ($config['block_minutes'] * 60));
        lcnSendVoteJson(['ok' => false, 'error' => 'Zu viele Voting-Anfragen. Bitte später erneut versuchen.'], 429);
    }

    if (random_int(1, 100) === 1) {
        $cleanup = $pdo->prepare('DELETE FROM vote_request_events WHERE occurred_at < NOW() - INTERVAL :hours HOUR');
        $cleanup->bindValue(':hours', $config['request_retention_hours'], PDO::PARAM_INT);
        $cleanup->execute();
        $pdo->exec('DELETE FROM vote_source_blocks WHERE blocked_until < NOW() - INTERVAL 1 DAY');
    }

    return [
        'request_id' => $requestId,
        'source_key' => $sourceKey,
        'voter_key' => $voterKey,
        'event_id' => $primaryEventId,
    ];
}

function lcnCompleteVoteSecurity(
    PDO $pdo,
    array $security,
    string $targetType,
    int $targetId,
    string $voteDirection,
    bool $changed
): ?int {
    $update = $pdo->prepare('UPDATE vote_request_events SET vote_changed = :changed WHERE request_id = :request_id');
    $update->execute([':changed' => $changed ? 1 : 0, ':request_id' => $security['request_id']]);
    $primaryEventId = $security['event_id'] ?? null;

    if ($primaryEventId !== null) {
        $table = $targetType === 'doctor' ? 'doctor_votes' : 'treatment_votes';
        $column = $targetType === 'doctor' ? 'dr_id' : 'treat_id';
        $flag = $pdo->prepare("
            UPDATE {$table}
            SET review_status = 'suspicious', flag_reason = 'SOURCE_RATE_SIGNAL',
                flagged_at = NOW(), flag_event_id = :event_id
            WHERE voter_key = :voter_key AND {$column} = :target_id
              AND review_status = 'active'
        ");
        $flag->execute([
            ':event_id' => $primaryEventId,
            ':voter_key' => $security['voter_key'],
            ':target_id' => $targetId,
        ]);
    }

    if (!$changed) {
        return $primaryEventId;
    }

    $config = lcnVoteSecurityConfig();
    $windows = [
        ['minutes' => 10, 'threshold' => $config['target_votes_10_minutes'], 'type' => 'TARGET_SPIKE_10MIN'],
        ['minutes' => 60, 'threshold' => $config['target_votes_1_hour'], 'type' => 'TARGET_SPIKE_1H'],
    ];

    foreach ($windows as $window) {
        $statement = $pdo->prepare("
            SELECT COUNT(*) AS vote_count,
                   COUNT(DISTINCT voter_key) AS voter_count,
                   COUNT(DISTINCT source_key) AS source_count
            FROM vote_request_events
            WHERE target_type = :target_type AND target_id = :target_id
              AND vote_changed = 1
              AND occurred_at >= NOW() - INTERVAL {$window['minutes']} MINUTE
        ");
        $statement->execute([':target_type' => $targetType, ':target_id' => $targetId]);
        $counts = $statement->fetch() ?: [];

        if ((int)($counts['vote_count'] ?? 0) > $window['threshold']) {
            $eventId = lcnCreateOrUpdateAbuseEvent($pdo, [
                'event_type' => $window['type'],
                'severity' => 'warning',
                'target_type' => $targetType,
                'target_id' => $targetId,
                'window_start' => date('Y-m-d H:i:s', time() - ($window['minutes'] * 60)),
                'vote_count' => (int)$counts['vote_count'],
                'voter_count' => (int)$counts['voter_count'],
                'source_count' => (int)$counts['source_count'],
                'bucket' => date('YmdHi', (int)(time() / ($window['minutes'] * 60)) * ($window['minutes'] * 60)),
                'details' => ['window_minutes' => $window['minutes']],
            ]);
            $primaryEventId ??= $eventId;
            lcnFlagTargetVotes($pdo, $targetType, $targetId, $eventId, $window['type'], $window['minutes']);
        }
    }

    $direction = $pdo->prepare("
        SELECT COUNT(*) AS vote_count,
               COUNT(DISTINCT voter_key) AS voter_count,
               COUNT(DISTINCT source_key) AS source_count
        FROM vote_request_events
        WHERE target_type = :target_type AND target_id = :target_id
          AND vote_direction = :vote_direction AND vote_changed = 1
          AND occurred_at >= NOW() - INTERVAL 10 MINUTE
    ");
    $direction->execute([
        ':target_type' => $targetType,
        ':target_id' => $targetId,
        ':vote_direction' => $voteDirection,
    ]);
    $directionCounts = $direction->fetch() ?: [];

    if ((int)($directionCounts['vote_count'] ?? 0) > $config['target_direction_10_minutes']) {
        $eventId = lcnCreateOrUpdateAbuseEvent($pdo, [
            'event_type' => 'TARGET_DIRECTION_SPIKE',
            'severity' => 'warning',
            'target_type' => $targetType,
            'target_id' => $targetId,
            'vote_direction' => $voteDirection,
            'window_start' => date('Y-m-d H:i:s', time() - 600),
            'vote_count' => (int)$directionCounts['vote_count'],
            'voter_count' => (int)$directionCounts['voter_count'],
            'source_count' => (int)$directionCounts['source_count'],
            'bucket' => date('YmdHi', (int)(time() / 600) * 600),
            'details' => ['window_minutes' => 10],
        ]);
        $primaryEventId ??= $eventId;
        lcnFlagTargetVotes($pdo, $targetType, $targetId, $eventId, 'TARGET_DIRECTION_SPIKE', 10);
    }

    return $primaryEventId;
}

function lcnFlagTargetVotes(
    PDO $pdo,
    string $targetType,
    int $targetId,
    int $eventId,
    string $reason,
    int $windowMinutes
): void {
    $table = $targetType === 'doctor' ? 'doctor_votes' : 'treatment_votes';
    $column = $targetType === 'doctor' ? 'dr_id' : 'treat_id';
    $statement = $pdo->prepare("
        UPDATE {$table}
        SET review_status = 'suspicious', flag_reason = :reason,
            flagged_at = NOW(), flag_event_id = :event_id
        WHERE {$column} = :target_id
          AND review_status = 'active'
          AND updated_at >= NOW() - INTERVAL :minutes MINUTE
    ");
    $statement->bindValue(':reason', $reason);
    $statement->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $statement->bindValue(':target_id', $targetId, PDO::PARAM_INT);
    $statement->bindValue(':minutes', $windowMinutes, PDO::PARAM_INT);
    $statement->execute();
}
