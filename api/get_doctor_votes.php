<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = lcnDatabase();

    $sql = "
        SELECT
            d.dr_id,
            d.dr_display_name,

            (
                COALESCE(rv.pro, 0)
                + COALESCE(wv.vote_improved, 0)
            ) AS pro,

            (
                COALESCE(rv.neutral, 0)
                + COALESCE(wv.vote_neutral, 0)
            ) AS neutral,

            (
                COALESCE(rv.contra, 0)
                + COALESCE(wv.vote_worsened, 0)
            ) AS contra

        FROM tbl_drs_03 d

        LEFT JOIN lcn_raw_doctor_votes rv
            ON d.dr_id = rv.dr_id

        LEFT JOIN tbl_drs_votes_03 wv
            ON d.dr_id = wv.dr_id

        WHERE d.dr_display_name IS NOT NULL
          AND d.dr_display_name <> ''

        ORDER BY d.dr_display_name ASC
    ";

    $stmt = $pdo->query($sql);
    $doctors = $stmt->fetchAll();

    echo json_encode($doctors, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    lcnLogApiError('get_doctor_votes', $e);
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => 'Ärztebewertungen konnten nicht geladen werden.'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
