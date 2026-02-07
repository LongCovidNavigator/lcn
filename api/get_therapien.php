<?php
// Fehleranzeige aktivieren
ini_set('display_errors', 1);
error_reporting(E_ALL);

// ---------------------------------------------
// BookStack-DB: Connection via BookStack .env
// .env liegt bei dir: C:/xampp/htdocs/bookstack/.env

function loadEnvFile(string $path): void {
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException("ENV-Datei nicht gefunden/lesbar: {$path}");
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;

        $pos = strpos($line, '=');
        if ($pos === false) continue;

        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));

        // Quotes entfernen
        if (
            (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
            (str_starts_with($val, "'") && str_ends_with($val, "'"))
        ) {
            $val = substr($val, 1, -1);
        }

        // Nur setzen, wenn nicht bereits gesetzt (Server-ENV kann Vorrang haben)
        if (getenv($key) === false) {
            putenv("$key=$val");
            $_ENV[$key] = $val;
        }
    }
}

function envOrFail(string $key): string {
    $val = getenv($key);
    if ($val === false || $val === '') {
        throw new RuntimeException("Fehlende ENV-Variable: {$key}");
    }
    return $val;
}

try {
    // .env laden
    $envPath = 'C:/xampp/htdocs/bookstack/.env';
    loadEnvFile($envPath);

    // DB-Config aus BookStack-.env
    $host = envOrFail('DB_HOST');
    $dbname = envOrFail('DB_DATABASE');   // explizit BookStack DB
    $username = envOrFail('DB_USERNAME');
    $password = envOrFail('DB_PASSWORD');

    $port = getenv('DB_PORT') ?: '3306';
    $charset = getenv('DB_CHARSET') ?: 'utf8mb4';

    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'DB-Verbindung fehlgeschlagen', 'details' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------------------------------------------
// Kapitel-ID für „Therapien und Behandlungen“
$chapterId = 1;

$sql = "
SELECT
    p.id,
    p.name AS title,
    p.slug,
    p.updated_at
FROM
    pages p
WHERE
    p.chapter_id = :chapter_id
    AND p.template = 0
ORDER BY
    p.name ASC
";

$stmt = $pdo->prepare($sql);
$stmt->execute(['chapter_id' => $chapterId]);
$results = $stmt->fetchAll();

// 🧠 Umwandeln in erwartetes JSON-Format
$mapped = array_map(function ($item) {
    return [
        'Behandlung' => $item['title'],
        'id' => $item['slug']
    ];
}, $results);

// Ausgabe
header('Content-Type: application/json; charset=utf-8');
echo json_encode($mapped, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
