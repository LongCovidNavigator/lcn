<?php
// Fehleranzeige für Debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

$host = 'localhost';
$dbname = 'bookstack_db';
$username = 'bookstack_user';
$password = 'willi';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Datenbankverbindung fehlgeschlagen: ' . $e->getMessage()]);
    exit;
}

$chapterId = 1;

$sql = "
SELECT
    p.id,
    p.name AS title,
    p.slug AS page_slug,
    b.slug AS book_slug,
    p.updated_at
FROM
    pages p
JOIN
    books b ON p.book_id = b.id
WHERE
    p.chapter_id = :chapter_id
ORDER BY p.name ASC
";

$stmt = $pdo->prepare($sql);
$stmt->execute(['chapter_id' => $chapterId]);
$pages = $stmt->fetchAll(PDO::FETCH_ASSOC);

header('Content-Type: application/json; charset=utf-8');
echo json_encode($pages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
