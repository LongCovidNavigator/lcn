
<?php
header('Content-Type: application/json; charset=utf-8');

function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception(".env-Datei nicht gefunden: " . $path);
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);

        if (count($parts) === 2) {
            $_ENV[trim($parts[0])] = trim($parts[1]);
        }
    }
}

function getFloatParam($name, $min, $max) {
    if (!isset($_GET[$name])) {
        throw new InvalidArgumentException("Parameter fehlt: " . $name);
    }

    $value = filter_var($_GET[$name], FILTER_VALIDATE_FLOAT);

    if ($value === false) {
        throw new InvalidArgumentException("Parameter ist keine gültige Zahl: " . $name);
    }

    if ($value < $min || $value > $max) {
        throw new InvalidArgumentException("Parameter außerhalb des erlaubten Bereichs: " . $name);
    }

    return (float)$value;
}

try {
    $lat = getFloatParam('lat', -90, 90);
    $lng = getFloatParam('lng', -180, 180);
    $radiusKm = getFloatParam('radiusKm', 1, 500);

    $envPath = __DIR__ . '/../data2bs/data2lcn_db/.env';
    loadEnv($envPath);

    $host = $_ENV['LCN_DB_HOST'] ?? '127.0.0.1';
    $port = $_ENV['LCN_DB_PORT'] ?? '3306';
    $db   = $_ENV['LCN_DB_DATABASE'] ?? '';
    $user = $_ENV['LCN_DB_USERNAME'] ?? '';
    $pass = $_ENV['LCN_DB_PASSWORD'] ?? '';

    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    /*
        Distanzberechnung:
        - 6371 = mittlerer Erdradius in km
        - Ergebnis ist Luftlinie, keine Fahrstrecke
        - LEAST(1, ...) verhindert seltene Rundungsfehler bei ACOS()
    */
    $sql = "
        SELECT *
        FROM (
            SELECT
                d.dr_id,
                d.dr_display_name,
                d.dr_type,
                d.dr_is_dr,
                d.dr_title_raw,
                d.dr_firstname,
                d.dr_lastname,
                d.dr_org_name,
                d.dr_website AS dr_website,
                d.dr_email AS dr_email,
                d.dr_accepts_gkv,
                d.dr_accepts_pkv,

                l.loc_id,
                l.loc_label,
                l.loc_is_primary,
                l.loc_country,
                l.loc_plz,
                l.loc_city,
                l.loc_street,
                l.loc_housenumber,
                l.loc_phone,
                l.loc_email,
                l.loc_website,
                l.loc_lat,
                l.loc_lng,
                l.loc_address_visibility,
                l.loc_geo_type,

                (
                    6371 * ACOS(
                        LEAST(
                            1,
                            COS(RADIANS(:lat1))
                            * COS(RADIANS(l.loc_lat))
                            * COS(RADIANS(l.loc_lng) - RADIANS(:lng1))
                            + SIN(RADIANS(:lat2))
                            * SIN(RADIANS(l.loc_lat))
                        )
                    )
                ) AS distance_km

            FROM tbl_drs_locations_03 l
            INNER JOIN tbl_drs_03 d
                ON d.dr_id = l.dr_id

            WHERE l.loc_is_primary = 1
              AND l.loc_lat IS NOT NULL
              AND l.loc_lng IS NOT NULL
              AND l.loc_lat <> ''
              AND l.loc_lng <> ''
        ) AS results
        WHERE distance_km <= :radiusKm
        ORDER BY distance_km ASC, dr_display_name ASC
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':lat1', $lat);
    $stmt->bindValue(':lat2', $lat);
    $stmt->bindValue(':lng1', $lng);
    $stmt->bindValue(':radiusKm', $radiusKm);

    $stmt->execute();

    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $distanceKm = (float)$item['distance_km'];

        $item['dr_id'] = (int)$item['dr_id'];
        $item['loc_id'] = (int)$item['loc_id'];
        $item['loc_is_primary'] = (int)$item['loc_is_primary'];

        $item['loc_lat'] = (float)$item['loc_lat'];
        $item['loc_lng'] = (float)$item['loc_lng'];

        $item['distance_km'] = round($distanceKm, 2);
        $item['distance_meters'] = (int)round($distanceKm * 1000);
    }
    unset($item);

    echo json_encode([
        'ok' => true,
        'center' => [
            'lat' => $lat,
            'lng' => $lng,
        ],
        'radiusKm' => $radiusKm,
        'distanceType' => 'air_line',
        'distanceLabel' => 'Luftlinie',
        'count' => count($items),
        'items' => $items,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (InvalidArgumentException $e) {
    http_response_code(400);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}