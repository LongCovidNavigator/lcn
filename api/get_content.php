<?php
// DB-Verbindung
$host = 'localhost';
$dbname = 'bookstack_db';
$username = 'bookstack_user';
$password = 'willi';

$dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];

$db = new PDO($dsn, $username, $password, $options);

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
header('Content-Type: application/json');
echo json_encode($pages, JSON_PRETTY_PRINT);

// ---------------------------------------------
// Hilfsfunktionen

function hasTemplateMarkers($text) {
    return strpos($text, '## ⚡ Schnellüberblick') !== false || strpos($text, '## 🩺 Empfohlene Ärzt') !== false;
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
