<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
if (!$data || !isset($data["treatment"]) || !isset($data["votes"])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid input"]);
    exit;
}

$file = __DIR__ . "/../../assets/data/votes.json";

// Bestehende Einträge laden
$existing = [];
if (file_exists($file)) {
    $json = file_get_contents($file);
    $existing = json_decode($json, true) ?? [];
}

// Behandlung aktualisieren oder hinzufügen
$found = false;
foreach ($existing as &$entry) {
    if (strtolower($entry["Behandlung"]) === strtolower($data["treatment"])) {
        $entry["pro"] = $data["votes"]["hilft"] ?? 0;
        $entry["neutral"] = $data["votes"]["gleich"] ?? 0;
        $entry["contra"] = $data["votes"]["verschlechterung"] ?? 0;
        $found = true;
        break;
    }
}
unset($entry);

if (!$found) {
    $existing[] = [
        "Behandlung" => $data["treatment"],
        "pro" => $data["votes"]["hilft"] ?? 0,
        "neutral" => $data["votes"]["gleich"] ?? 0,
        "contra" => $data["votes"]["verschlechterung"] ?? 0
    ];
}

// Neue Datei schreiben
file_put_contents($file, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(["success" => true]);
