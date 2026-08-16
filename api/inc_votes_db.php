<?php

require_once __DIR__ . '/_vote_abuse.php';

lcnRequireVotingRequest();

try {
    $input = lcnReadJsonBody();
    $treatId = filter_var($input['treat_id'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1],
    ]);
    $requestedVote = (string)($input['type'] ?? '');
    $voteMap = [
        'hilft' => 'pro',
        'gleich' => 'neutral',
        'verschlechterung' => 'contra',
        'pro' => 'pro',
        'neutral' => 'neutral',
        'contra' => 'contra',
    ];

    if ($treatId === false || !isset($voteMap[$requestedVote])) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Anfrage.'], 400);
    }

    $pdo = lcnDatabase();
    $exists = $pdo->prepare('SELECT behandlung FROM tbl_treatments_03 WHERE treat_id = :treat_id');
    $exists->execute([':treat_id' => $treatId]);
    $treatmentName = $exists->fetchColumn();

    if ($treatmentName === false) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Therapie nicht gefunden.'], 404);
    }

    $vote = $voteMap[$requestedVote];
    $voterKey = lcnVoterKey();
    $security = lcnBeginVoteSecurity($pdo, 'treatment', (int)$treatId, $vote, $voterKey);

    $pdo->beginTransaction();

    $currentStatement = $pdo->prepare("
        SELECT vote
        FROM treatment_votes
        WHERE voter_key = :voter_key AND treat_id = :treat_id
        FOR UPDATE
    ");
    $currentStatement->execute([':voter_key' => $voterKey, ':treat_id' => $treatId]);
    $previousVote = $currentStatement->fetchColumn();

    if ($previousVote === false) {
        $insert = $pdo->prepare("
            INSERT INTO treatment_votes (voter_key, treat_id, vote)
            VALUES (:voter_key, :treat_id, :vote)
        ");
        $insert->execute([':voter_key' => $voterKey, ':treat_id' => $treatId, ':vote' => $vote]);

        $aggregate = $pdo->prepare("
            INSERT INTO lcn_votes (Behandlung, {$vote})
            VALUES (:treatment_name, 1)
            ON DUPLICATE KEY UPDATE {$vote} = {$vote} + 1
        ");
        $aggregate->execute([':treatment_name' => $treatmentName]);
    } elseif ($previousVote !== $vote) {
        $update = $pdo->prepare("
            UPDATE treatment_votes
            SET vote = :vote,
                review_status = 'active',
                flag_reason = NULL,
                flagged_at = NULL,
                flag_event_id = NULL
            WHERE voter_key = :voter_key AND treat_id = :treat_id
        ");
        $update->execute([':vote' => $vote, ':voter_key' => $voterKey, ':treat_id' => $treatId]);

        $aggregate = $pdo->prepare("
            UPDATE lcn_votes
            SET {$previousVote} = GREATEST({$previousVote} - 1, 0),
                {$vote} = {$vote} + 1
            WHERE Behandlung = :treatment_name
        ");
        $aggregate->execute([':treatment_name' => $treatmentName]);
    }

    lcnCompleteVoteSecurity(
        $pdo,
        $security,
        'treatment',
        (int)$treatId,
        $vote,
        $previousVote !== $vote
    );
    $pdo->commit();

    lcnSendVoteJson([
        'ok' => true,
        'treat_id' => (int)$treatId,
        'vote' => $vote,
        'changed' => $previousVote !== $vote,
    ]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    lcnLogApiError('inc_votes_db', $error);
    lcnSendVoteJson(['ok' => false, 'error' => 'Die Bewertung konnte nicht gespeichert werden.'], 500);
}
