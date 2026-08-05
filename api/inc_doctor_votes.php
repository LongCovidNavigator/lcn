<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $drId = isset($input['dr_id']) ? (int)$input['dr_id'] : 0;
    $type = $input['type'] ?? '';

    if ($drId <= 0) {
        throw new Exception("Ungültige dr_id.");
    }

    $allowedTypes = ['pro', 'neutral', 'contra'];

    if (!in_array($type, $allowedTypes, true)) {
        throw new Exception("Ungültiger Vote-Typ.");
    }

    $pdo = lcnDatabase();

    $sql = "
        INSERT INTO tbl_drs_votes_03 (
            dr_id,
            vote_improved,
            vote_neutral,
            vote_worsened,
            updated_at
        )
        VALUES (
            :dr_id,
            CASE WHEN :type1 = 'pro' THEN 1 ELSE 0 END,
            CASE WHEN :type2 = 'neutral' THEN 1 ELSE 0 END,
            CASE WHEN :type3 = 'contra' THEN 1 ELSE 0 END,
            NOW()
        )
        ON DUPLICATE KEY UPDATE
            vote_improved = vote_improved + CASE WHEN :type4 = 'pro' THEN 1 ELSE 0 END,
            vote_neutral = vote_neutral + CASE WHEN :type5 = 'neutral' THEN 1 ELSE 0 END,
            vote_worsened = vote_worsened + CASE WHEN :type6 = 'contra' THEN 1 ELSE 0 END,
            updated_at = NOW()
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':dr_id' => $drId,
        ':type1' => $type,
        ':type2' => $type,
        ':type3' => $type,
        ':type4' => $type,
        ':type5' => $type,
        ':type6' => $type,
    ]);

    echo json_encode([
        'ok' => true,
        'dr_id' => $drId,
        'type' => $type
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    lcnLogApiError('inc_doctor_votes', $e);
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => 'Die Bewertung konnte nicht gespeichert werden.'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
