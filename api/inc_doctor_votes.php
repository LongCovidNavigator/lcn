<?php

require_once __DIR__ . '/_vote_abuse.php';

lcnRequireVotingRequest();

try {
    $input = lcnReadJsonBody();
    $drId = filter_var($input['dr_id'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1],
    ]);
    $vote = (string)($input['type'] ?? '');

    if ($drId === false || !in_array($vote, ['pro', 'neutral', 'contra'], true)) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Anfrage.'], 400);
    }

    $pdo = lcnDatabase();
    $exists = $pdo->prepare('SELECT 1 FROM tbl_drs_03 WHERE dr_id = :dr_id');
    $exists->execute([':dr_id' => $drId]);

    if (!$exists->fetchColumn()) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Arzt oder Praxis nicht gefunden.'], 404);
    }

    $voterKey = lcnVoterKey();
    $security = lcnBeginVoteSecurity($pdo, 'doctor', (int)$drId, $vote, $voterKey);
    $aggregateColumns = [
        'pro' => 'vote_improved',
        'neutral' => 'vote_neutral',
        'contra' => 'vote_worsened',
    ];

    $pdo->beginTransaction();

    $currentStatement = $pdo->prepare("
        SELECT vote
        FROM doctor_votes
        WHERE voter_key = :voter_key AND dr_id = :dr_id
        FOR UPDATE
    ");
    $currentStatement->execute([':voter_key' => $voterKey, ':dr_id' => $drId]);
    $previousVote = $currentStatement->fetchColumn();

    if ($previousVote === false) {
        $insert = $pdo->prepare("
            INSERT INTO doctor_votes (voter_key, dr_id, vote)
            VALUES (:voter_key, :dr_id, :vote)
        ");
        $insert->execute([':voter_key' => $voterKey, ':dr_id' => $drId, ':vote' => $vote]);

        $column = $aggregateColumns[$vote];
        $aggregate = $pdo->prepare("
            INSERT INTO tbl_drs_votes_03 (dr_id, {$column})
            VALUES (:dr_id, 1)
            ON DUPLICATE KEY UPDATE {$column} = {$column} + 1
        ");
        $aggregate->execute([':dr_id' => $drId]);
    } elseif ($previousVote !== $vote) {
        $update = $pdo->prepare("
            UPDATE doctor_votes
            SET vote = :vote,
                review_status = 'active',
                flag_reason = NULL,
                flagged_at = NULL,
                flag_event_id = NULL
            WHERE voter_key = :voter_key AND dr_id = :dr_id
        ");
        $update->execute([':vote' => $vote, ':voter_key' => $voterKey, ':dr_id' => $drId]);

        $oldColumn = $aggregateColumns[$previousVote];
        $newColumn = $aggregateColumns[$vote];
        $aggregate = $pdo->prepare("
            UPDATE tbl_drs_votes_03
            SET {$oldColumn} = GREATEST({$oldColumn} - 1, 0),
                {$newColumn} = {$newColumn} + 1
            WHERE dr_id = :dr_id
        ");
        $aggregate->execute([':dr_id' => $drId]);
    }

    lcnCompleteVoteSecurity(
        $pdo,
        $security,
        'doctor',
        (int)$drId,
        $vote,
        $previousVote !== $vote
    );
    $pdo->commit();

    lcnSendVoteJson([
        'ok' => true,
        'dr_id' => (int)$drId,
        'vote' => $vote,
        'changed' => $previousVote !== $vote,
    ]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    lcnLogApiError('inc_doctor_votes', $error);
    lcnSendVoteJson(['ok' => false, 'error' => 'Die Bewertung konnte nicht gespeichert werden.'], 500);
}
