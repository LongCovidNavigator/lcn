<?php
// Gibt die Bewertung aus der Datei "votes.json" direkt als JSON aus

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:8080");


$path = __DIR__ . "/../assets/data/votes.json";

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(["error" => "Datei nicht gefunden: votes.json"]);
    exit;
}

$json = file_get_contents($path);
$data = json_decode($json, true);

if (!$data) {
    http_response_code(500);
    echo json_encode(["error" => "Fehler beim Parsen von votes.json"]);
    exit;
}

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);


