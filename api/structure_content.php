<?php
// get_content.php aufrufen (lokal!)
$json = file_get_contents('http://localhost/lcn/api/get_content.php');
$pages = json_decode($json, true);

// Ergebnisstruktur vorbereiten
$structured = [];

foreach ($pages as $page) {
    $markdown = $page['freitextRohversion'];
    $title = $page['title'];

    $structured[] = parseSchnellueberblick($markdown, $title);
}

// Ausgabe
header('Content-Type: application/json');
echo json_encode($structured, JSON_PRETTY_PRINT);

// ------------------------------------------------------------
// Funktion zur Extraktion der Schnellübersicht

function parseSchnellueberblick($markdown, $title = null) {
    $block = null;
    $result = [
        "Behandlung" => $title,
        "Eskalationsstufe" => null,
        "Nutzen" => null,
        "Wirkgeschwindigkeit" => null,
        "Aufwand" => null,
        "Kosten min" => null,
        "Kosten max" => null,
        "Crashrisiko" => null,
        "Wirkmechanismus" => null
    ];

    if (preg_match('/## ⚡ Schnellüberblick(.*?)\n## /s', $markdown . "\n## ", $match)) {
        $block = $match[1];
    } elseif (preg_match('/## ⚡ Schnellüberblick(.*)/s', $markdown, $match)) {
        $block = $match[1];
    }

    if (!$block) return $result;

    $lines = explode("\n", $block);
    foreach ($lines as $line) {
        if (strpos($line, '|') === false) continue;
        $cols = array_map('trim', explode('|', $line));
        if (count($cols) < 3) continue;

        [$label, $value] = [$cols[1], $cols[2]];

        switch (true) {
            case str_contains($label, 'Eskalationsstufe'):
                $result["Eskalationsstufe"] = $value;
                break;
            case str_contains($label, 'Wirkgeschwindigkeit'):
                $result["Wirkgeschwindigkeit"] = $value;
                break;
            case str_contains($label, 'Aufwand'):
                $parsed = parseNumberOrText($value);
                $result["Aufwand"] = is_numeric($parsed) ? (int) $parsed : $parsed;
                break;
            case str_contains($label, 'Kosten'):
                $parsed = parseKosten($value);
                $result["Kosten min"] = $parsed["min"];
                $result["Kosten max"] = $parsed["max"];
                break;
            case str_contains($label, 'Crashrisiko'):
                $result["Crashrisiko"] = $value;
                break;
            case str_contains($label, 'Wirkmechanismus'):
                $result["Wirkmechanismus"] = $value;
                break;
        }
    }

    return $result;
}

function parseKosten($text) {
    $text = str_replace(['€', '–', '-', ',', '.', ' '], ['', '-', '-', '', '', ''], $text);
    if (preg_match('/(\d+)-(\d+)/', $text, $m)) {
        return ["min" => (int)$m[1], "max" => (int)$m[2]];
    } elseif (preg_match('/(\d+)/', $text, $m)) {
        return ["min" => (int)$m[1], "max" => null];
    }
    return ["min" => null, "max" => null];
}

function parseNumberOrText($val) {
    $val = trim($val);
    if (is_numeric($val)) return $val;
    return $val ?: null;
}
