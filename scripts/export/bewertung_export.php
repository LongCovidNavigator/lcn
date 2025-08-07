<?php
// Gibt die Bewertung aus der Datei "bewertung_static.json" direkt als JSON aus

header("Content-Type: application/json");

$path = __DIR__ . "/../../assets/data/bewertung_static.json";

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(["error" => "Datei nicht gefunden: bewertung_static.json"]);
    exit;
}

$json = file_get_contents($path);
$data = json_decode($json, true);

if (!$data) {
    http_response_code(500);
    echo json_encode(["error" => "Fehler beim Parsen von bewertung_static.json"]);
    exit;
}

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
