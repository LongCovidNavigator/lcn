<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = lcnDatabase();

    $sql = "
        SELECT
            dr_id,
            dr_display_name
        FROM tbl_drs_03
        WHERE dr_display_name IS NOT NULL
          AND dr_display_name <> ''
        ORDER BY dr_display_name ASC
    ";

    $stmt = $pdo->query($sql);
    $doctors = $stmt->fetchAll();

    echo json_encode($doctors, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    lcnLogApiError('get_doctors', $e);
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => 'Ärztedaten konnten nicht geladen werden.'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
