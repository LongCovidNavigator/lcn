<?php
header('Content-Type: application/json');

$save_path = '../../assets/data/bewertung_static.json';

// Nur POST zulassen
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Only POST allowed"]);
    exit;
}

// Rohdaten einlesen
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

// Vorhandene Daten einlesen
$existing = file_exists($save_path) ? json_decode(file_get_contents($save_path), true) : [];

// Vorhandene Daten mit neuen überschreiben/ergänzen
foreach ($data as $item) {
    $name = $item["Behandlung"] ?? null;
    if (!$name) continue;

    $existing[$name] = [
        "Behandlung" => $name,
        "pro" => (int) ($item["pro"] ?? 0),
        "neutral" => (int) ($item["neutral"] ?? 0),
        "contra" => (int) ($item["contra"] ?? 0),
        "bewertung_url" => $item["bewertung_url"] ?? "",
        "protokoll_url" => $item["protokoll_url"] ?? ""
    ];
}

// Speichern
file_put_contents($save_path, json_encode(array_values($existing), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(["success" => true, "count" => count($data)]);
