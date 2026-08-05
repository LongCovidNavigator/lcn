<?php
require_once __DIR__ . '/_security.php';

header('Content-Type: application/json; charset=utf-8');

function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception(".env-Datei nicht gefunden: " . $path);
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);

        if (count($parts) === 2) {
            $_ENV[trim($parts[0])] = trim($parts[1]);
        }
    }
}

try {
    $envPath = __DIR__ . '/../data2bs/data2lcn_db/.env';
    loadEnv($envPath);

    $host = $_ENV['LCN_DB_HOST'] ?? '127.0.0.1';
    $port = $_ENV['LCN_DB_PORT'] ?? '3306';
    $db   = $_ENV['LCN_DB_DATABASE'] ?? '';
    $user = $_ENV['LCN_DB_USERNAME'] ?? '';
    $pass = $_ENV['LCN_DB_PASSWORD'] ?? '';

    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

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
