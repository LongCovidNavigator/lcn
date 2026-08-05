<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

function fetchJsonWithCurl($url) {
    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json'
        ],
    ]);

    $body = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($body === false || $curlError) {
        throw new Exception("Geoapify-Anfrage fehlgeschlagen: " . $curlError);
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        throw new Exception("Geoapify antwortete mit HTTP-Code " . $httpCode);
    }

    $data = json_decode($body, true);

    if (!is_array($data)) {
        throw new Exception("Geoapify-Antwort konnte nicht als JSON gelesen werden.");
    }

    return $data;
}

try {
    $query = trim($_GET['q'] ?? '');

    if ($query === '') {
        throw new InvalidArgumentException("Parameter fehlt: q");
    }

    if (mb_strlen($query) < 2) {
        throw new InvalidArgumentException("Der Suchbegriff ist zu kurz.");
    }

    if (mb_strlen($query) > 200) {
        throw new InvalidArgumentException("Der Suchbegriff ist zu lang.");
    }

    $apiKey = lcnEnv('GEOAPIFY_API_KEY', '');

    if ($apiKey === '' || $apiKey === 'DEIN_GEOAPIFY_KEY_HIER') {
        throw new Exception("GEOAPIFY_API_KEY fehlt in der .env-Datei.");
    }

    $url =
        'https://api.geoapify.com/v1/geocode/search' .
        '?text=' . urlencode($query) .
        '&format=json' .
        '&limit=5' .
        '&filter=countrycode:de' .
        '&lang=de' .
        '&apiKey=' . urlencode($apiKey);

    $data = fetchJsonWithCurl($url);
    $results = $data['results'] ?? [];

    if (count($results) === 0) {
        http_response_code(404);

        echo json_encode([
            'ok' => false,
            'error' => true,
            'message' => 'Kein Standort gefunden.',
            'query' => $query,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }

    $first = $results[0];

    $lat = $first['lat'] ?? null;
    $lng = $first['lon'] ?? null;

    if ($lat === null || $lng === null) {
        throw new Exception("Geoapify-Ergebnis enthält keine Koordinaten.");
    }

    $normalizedResults = array_map(static function ($result) use ($query) {
        return [
            'lat' => (float)($result['lat'] ?? 0),
            'lng' => (float)($result['lon'] ?? 0),
            'formatted' => $result['formatted'] ?? $query,
            'postcode' => $result['postcode'] ?? null,
            'city' => $result['city'] ?? ($result['county'] ?? null),
            'country' => $result['country'] ?? null,
        ];
    }, $results);

    echo json_encode([
        'ok' => true,
        'query' => $query,
        'source' => 'geoapify',
        'result' => [
            'lat' => (float)$lat,
            'lng' => (float)$lng,
            'formatted' => $first['formatted'] ?? $query,
            'postcode' => $first['postcode'] ?? null,
            'city' => $first['city'] ?? ($first['county'] ?? null),
            'country' => $first['country'] ?? null,
        ],
        'results' => $normalizedResults,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (InvalidArgumentException $e) {
    http_response_code(400);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => 'Ungueltige Ortsanfrage.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    lcnLogApiError('geocode_location', $e);
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => 'Ortssuche konnte nicht ausgefuehrt werden.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
