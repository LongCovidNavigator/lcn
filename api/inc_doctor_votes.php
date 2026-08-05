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
