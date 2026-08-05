<?php
require_once __DIR__ . '/_security.php';

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

        // Nur setzen, wenn nicht bereits gesetzt (Server-ENV soll Vorrang haben können)
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

// .env laden
$envPath = 'C:/xampp/htdocs/bookstack/.env';
loadEnvFile($envPath);

// DB-Config aus BookStack-.env
$host = envOrFail('DB_HOST');
$dbname = envOrFail('DB_DATABASE');   // <- für dieses Script explizit BookStack DB
$username = envOrFail('DB_USERNAME');
$password = envOrFail('DB_PASSWORD');

$port = getenv('DB_PORT') ?: '3306';
$charset = getenv('DB_CHARSET') ?: 'utf8mb4';

$dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

$db = new PDO($dsn, $username, $password, $options);

// ---------------------------------------------
// SQL-Abfrage: Nur nicht-gelöschte Nicht-Templates
$sql = "
SELECT
    p.id,
    p.name AS title,
    p.slug,
    p.editor,
    p.markdown,
    p.html
FROM
    pages p
WHERE
    p.template = 0
    AND p.deleted_at IS NULL
ORDER BY
    p.name ASC
";

$stmt = $db->query($sql);

// Ergebnisse vorbereiten
$pages = [];

foreach ($stmt as $row) {
    $id = $row['id'];
    $title = trim($row['title']);
    $markdown = $row['markdown'];
    $html = $row['html'];
    $content = $markdown ?: strip_tags($html);

    $templateUsed = hasTemplateMarkers($content);
    $struktur = $templateUsed ? parseStructuredContent($content) : null;

    $pages[] = [
        'id' => $id,
        'title' => $title,
        'slug' => $row['slug'],
        'editor' => $row['editor'],
        'templateUsed' => $templateUsed,
        'struktur' => $struktur,
        'freitextRohversion' => $content
    ];
}

// JSON-Ausgabe
header('Content-Type: application/json; charset=utf-8');
echo json_encode($pages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// ---------------------------------------------
// Hilfsfunktionen

function hasTemplateMarkers($text) {
    return strpos($text, '## ⚡ Schnellüberblick') !== false
        || strpos($text, '## 🩺 Empfohlene Ärzt') !== false;
}

function parseStructuredContent($text) {
    $struktur = [];

    // Schnellüberblick extrahieren
    if (preg_match('/## ⚡ Schnellüberblick.*?\|.*?\n(.*?)\n\n/s', $text, $match)) {
        $rows = explode("\n", trim($match[1]));
        $schnell = [];
        foreach ($rows as $row) {
            $cols = array_map('trim', explode('|', $row));
            if (count($cols) >= 2) {
                $key = strtolower(strip_tags($cols[0]));
                $val = strip_tags($cols[1]);
                $schnell[$key] = $val;
            }
        }
        $struktur['schnellüberblick'] = $schnell;
    }

    return $struktur;
}
