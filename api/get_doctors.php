<?php
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
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}