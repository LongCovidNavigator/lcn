<?php
// Fehleranzeige aktivieren
ini_set('display_errors', 1);
error_reporting(E_ALL);

// DB-Verbindung
$host = 'localhost';
$dbname = 'bookstack_db';
$username = 'bookstack_user';
$password = 'willi';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB-Verbindung fehlgeschlagen: ' . $e->getMessage()]);
    exit;
}

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
	
ORDER BY p.name ASC
";

$stmt = $pdo->prepare($sql);
$stmt->execute(['chapter_id' => $chapterId]);
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
