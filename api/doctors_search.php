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

function getOptionalFloatParam($name, $default, $min, $max) {
    if (!isset($_GET[$name]) || $_GET[$name] === '') {
        return (float)$default;
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

function getOptionalBoolParam($name) {
    if (!isset($_GET[$name]) || $_GET[$name] === '') {
        return false;
    }

    return in_array((string)$_GET[$name], ['1', 'true', 'yes', 'on'], true);
}

function getOptionalStringParam($name, $maxLength = 80) {
    if (!isset($_GET[$name])) {
        return '';
    }

    $value = trim((string)$_GET[$name]);

    if ($value === '') {
        return '';
    }

    if (mb_strlen($value, 'UTF-8') > $maxLength) {
        throw new InvalidArgumentException("Parameter ist zu lang: " . $name);
    }

    return $value;
}

function getOptionalIntParam($name, $default, $min, $max) {
    if (!isset($_GET[$name]) || $_GET[$name] === '') {
        return (int)$default;
    }

    $value = filter_var($_GET[$name], FILTER_VALIDATE_INT);

    if ($value === false) {
        throw new InvalidArgumentException("Parameter ist keine gültige Ganzzahl: " . $name);
    }

    if ($value < $min || $value > $max) {
        throw new InvalidArgumentException("Parameter außerhalb des erlaubten Bereichs: " . $name);
    }

    return (int)$value;
}

function normalizeGermanSearchTerm($value) {
    $value = trim((string)$value);

    if ($value === '') {
        return '';
    }

    $value = mb_strtolower($value, 'UTF-8');

    return str_replace(
        ['ä', 'ö', 'ü', 'ß'],
        ['ae', 'oe', 'ue', 'ss'],
        $value
    );
}

function attachSpecialtyTermsToDoctors($pdo, &$items) {
    if (count($items) === 0) {
        return;
    }

    $doctorIds = [];

    foreach ($items as $item) {
        $drId = (int)($item['dr_id'] ?? 0);

        if ($drId > 0) {
            $doctorIds[$drId] = $drId;
        }
    }

    if (count($doctorIds) === 0) {
        return;
    }

    $placeholders = [];
    $params = [];

    foreach (array_values($doctorIds) as $index => $drId) {
        $placeholder = ':dr_id_' . $index;
        $placeholders[] = $placeholder;
        $params[$placeholder] = $drId;
    }

    $termsSql = "
        SELECT DISTINCT
            c.dr_id,
            t.term_id,
            t.term_type,
            t.term_code,
            t.term_label,
            t.term_desc
        FROM tbl_cpl_drs2terms_03 c
        INNER JOIN tbl_terms_03 t
            ON c.term_id = t.term_id
        WHERE c.dr_id IN (" . implode(', ', $placeholders) . ")
          AND t.term_type = 'specialty'
        ORDER BY t.term_label ASC
    ";

    $termsStmt = $pdo->prepare($termsSql);

    foreach ($params as $placeholder => $drId) {
        $termsStmt->bindValue($placeholder, $drId, PDO::PARAM_INT);
    }

    $termsStmt->execute();

    $termsByDoctor = [];

    foreach ($termsStmt->fetchAll() as $term) {
        $drId = (int)$term['dr_id'];

        if (!array_key_exists($drId, $termsByDoctor)) {
            $termsByDoctor[$drId] = [];
        }

        $termsByDoctor[$drId][] = [
            'term_id' => (int)$term['term_id'],
            'term_type' => (string)$term['term_type'],
            'term_code' => (string)($term['term_code'] ?? ''),
            'term_label' => (string)($term['term_label'] ?? ''),
            'term_desc' => (string)($term['term_desc'] ?? ''),
        ];
    }

    foreach ($items as &$item) {
        $drId = (int)($item['dr_id'] ?? 0);
        $specialtyTerms = $termsByDoctor[$drId] ?? [];

        $item['specialty_terms'] = $specialtyTerms;
        $item['specialty_labels'] = implode(', ', array_values(array_filter(array_map(function ($term) {
            return trim((string)($term['term_label'] ?? ''));
        }, $specialtyTerms))));
    }
    unset($item);
}

function getAllSpecialtyTerms($pdo) {
    $sql = "
        SELECT
            t.term_id,
            t.term_type,
            t.term_code,
            t.term_label,
            t.term_desc,
            COUNT(DISTINCT c.dr_id) AS doctor_count
        FROM tbl_terms_03 t
        INNER JOIN tbl_cpl_drs2terms_03 c
            ON t.term_id = c.term_id
        WHERE t.term_type = 'specialty'
        GROUP BY
            t.term_id,
            t.term_type,
            t.term_code,
            t.term_label,
            t.term_desc
        ORDER BY t.term_label ASC
    ";

    $stmt = $pdo->query($sql);
    $items = [];

    foreach ($stmt->fetchAll() as $term) {
        $items[] = [
            'term_id' => (int)$term['term_id'],
            'term_type' => (string)$term['term_type'],
            'term_code' => (string)($term['term_code'] ?? ''),
            'term_label' => (string)($term['term_label'] ?? ''),
            'term_desc' => (string)($term['term_desc'] ?? ''),
            'doctor_count' => (int)($term['doctor_count'] ?? 0),
        ];
    }

    return $items;
}

try {
    $lat = getFloatParam('lat', -90, 90);
    $lng = getFloatParam('lng', -180, 180);
    $drId = getOptionalIntParam('dr_id', 0, 0, 999999);

    $minPositiveRatio = getOptionalFloatParam('minPositiveRatio', 0, 0, 100);
    $maxNegativeRatio = getOptionalFloatParam('maxNegativeRatio', 100, 0, 100);

    $acceptsGkv = getOptionalBoolParam('acceptsGkv');
    $acceptsPkv = getOptionalBoolParam('acceptsPkv');
    $includeNoCoords = getOptionalBoolParam('includeNoCoords');

    $hasWebsite = getOptionalBoolParam('hasWebsite');
    $hasEmail = getOptionalBoolParam('hasEmail');
    $hasPhone = getOptionalBoolParam('hasPhone');

    $city = getOptionalStringParam('city', 80);
    $search = getOptionalStringParam('search', 120);
    $specialtyTermId = getOptionalIntParam('specialtyTermId', 0, 0, 999999);
    $searchNormalized = normalizeGermanSearchTerm($search);

    $radiusRaw = $_GET['radiusKm'] ?? '100';
    $radiusEnabled = true;
    $radiusKm = null;

    if ($radiusRaw === 'all') {
        $radiusEnabled = false;
    } else {
        $radiusKm = filter_var($radiusRaw, FILTER_VALIDATE_FLOAT);

        if ($radiusKm === false || $radiusKm < 1 || $radiusKm > 500) {
            throw new InvalidArgumentException("radiusKm muss zwischen 1 und 500 liegen oder 'all' sein.");
        }

        $radiusKm = (float)$radiusKm;
    }

    if ($radiusEnabled && $city !== '') {
        throw new InvalidArgumentException("Bitte entweder Radiusfilter oder Stadtfilter verwenden, nicht beides gleichzeitig.");
    }

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

    $whereParts = [];

    if ($drId > 0) {
        $whereParts[] = "dr_id = :dr_id";
    } else {
        if ($radiusEnabled) {
            if ($includeNoCoords) {
                $whereParts[] = "(distance_km <= :radiusKm OR has_coordinates = 0)";
            } else {
                $whereParts[] = "distance_km <= :radiusKm";
            }
        }

        $whereParts[] = "positive_ratio >= :minPositiveRatio";
        $whereParts[] = "negative_ratio <= :maxNegativeRatio";

        if ($acceptsGkv && $acceptsPkv) {
            $whereParts[] = "(dr_accepts_gkv = 'yes' OR dr_accepts_pkv = 'yes')";
        } elseif ($acceptsGkv) {
            $whereParts[] = "dr_accepts_gkv = 'yes'";
        } elseif ($acceptsPkv) {
            $whereParts[] = "dr_accepts_pkv = 'yes'";
        }

        if ($hasWebsite) {
            $whereParts[] = "(
                (loc_website IS NOT NULL AND loc_website <> '')
                OR (dr_website IS NOT NULL AND dr_website <> '')
            )";
        }

        if ($hasEmail) {
            $whereParts[] = "(
                (loc_email IS NOT NULL AND loc_email <> '')
                OR (dr_email IS NOT NULL AND dr_email <> '')
            )";
        }

        if ($hasPhone) {
            $whereParts[] = "(loc_phone IS NOT NULL AND loc_phone <> '')";
        }

        if ($city !== '') {
            $whereParts[] = "loc_city LIKE :city";
        }

        if ($specialtyTermId > 0) {
            $whereParts[] = "EXISTS (
                SELECT 1
                FROM tbl_cpl_drs2terms_03 cst
                WHERE cst.dr_id = results.dr_id
                  AND cst.term_id = :specialtyTermId
            )";
        }

        if ($search !== '') {
            $whereParts[] = "(
                dr_display_name LIKE :search
                OR dr_firstname LIKE :search
                OR dr_lastname LIKE :search
                OR dr_title_raw LIKE :search
                OR dr_type LIKE :search
                OR CONCAT_WS(' ', dr_title_raw, dr_firstname, dr_lastname) LIKE :search
                OR CONCAT_WS(' ', dr_firstname, dr_lastname) LIKE :search
                OR LOWER(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    CONCAT_WS(' ',
                                                        COALESCE(dr_display_name, ''),
                                                        COALESCE(dr_firstname, ''),
                                                        COALESCE(dr_lastname, ''),
                                                        COALESCE(dr_title_raw, ''),
                                                        COALESCE(dr_type, ''),
                                                        CONCAT_WS(' ', COALESCE(dr_title_raw, ''), COALESCE(dr_firstname, ''), COALESCE(dr_lastname, '')),
                                                        CONCAT_WS(' ', COALESCE(dr_firstname, ''), COALESCE(dr_lastname, ''))
                                                    ),
                                                    'Ä', 'Ae'
                                                ),
                                                'Ö', 'Oe'
                                            ),
                                            'Ü', 'Ue'
                                        ),
                                        'ẞ', 'SS'
                                    ),
                                    'ä', 'ae'
                                ),
                                'ö', 'oe'
                            ),
                            'ü', 'ue'
                        ),
                        'ß', 'ss'
                    )
                ) LIKE :searchNormalized
            )";
        }
    }

    $whereSql = count($whereParts) > 0
        ? "WHERE " . implode(" AND ", $whereParts)
        : "";

    $sql = "
        SELECT *
        FROM (
            SELECT
                base.*,

                CASE
                    WHEN base.total_votes > 0
                    THEN ROUND((base.pro / base.total_votes) * 100)
                    ELSE 0
                END AS positive_ratio,

                CASE
                    WHEN base.total_votes > 0
                    THEN ROUND((base.neutral / base.total_votes) * 100)
                    ELSE 0
                END AS neutral_ratio,

                CASE
                    WHEN base.total_votes > 0
                    THEN ROUND((base.contra / base.total_votes) * 100)
                    ELSE 0
                END AS negative_ratio

            FROM (
                SELECT
                    d.dr_id,
                    d.dr_display_name,
                    d.dr_type,
                    d.dr_is_dr,
                    d.dr_title_raw,
                    d.dr_firstname,
                    d.dr_lastname,
                    CASE
                        WHEN d.dr_lastname IS NOT NULL
                         AND TRIM(d.dr_lastname) <> ''
                        THEN
                            CASE
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'von %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'vom %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'van %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'zu %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 4))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'zum %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'zur %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'de %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 4))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'der %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                WHEN LOWER(TRIM(d.dr_lastname)) LIKE 'den %'
                                THEN TRIM(SUBSTRING(TRIM(d.dr_lastname), 5))
                                ELSE TRIM(d.dr_lastname)
                            END
                        WHEN d.dr_org_name IS NOT NULL
                         AND TRIM(d.dr_org_name) <> ''
                        THEN TRIM(d.dr_org_name)
                        ELSE TRIM(d.dr_display_name)
                    END AS dr_sort_lastname,
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

                    CASE
                        WHEN l.loc_lat IS NOT NULL
                         AND l.loc_lng IS NOT NULL
                         AND l.loc_lat <> ''
                         AND l.loc_lng <> ''
                        THEN 1
                        ELSE 0
                    END AS has_coordinates,

                    CASE
                        WHEN l.loc_lat IS NOT NULL
                         AND l.loc_lng IS NOT NULL
                         AND l.loc_lat <> ''
                         AND l.loc_lng <> ''
                        THEN (
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
                        )
                        ELSE NULL
                    END AS distance_km,

                    (
                        COALESCE(rv.pro, 0)
                        + COALESCE(wv.vote_improved, 0)
                    ) AS pro,

                    (
                        COALESCE(rv.neutral, 0)
                        + COALESCE(wv.vote_neutral, 0)
                    ) AS neutral,

                    (
                        COALESCE(rv.contra, 0)
                        + COALESCE(wv.vote_worsened, 0)
                    ) AS contra,

                    (
                        COALESCE(rv.pro, 0)
                        + COALESCE(wv.vote_improved, 0)
                        + COALESCE(rv.neutral, 0)
                        + COALESCE(wv.vote_neutral, 0)
                        + COALESCE(rv.contra, 0)
                        + COALESCE(wv.vote_worsened, 0)
                    ) AS total_votes

                FROM tbl_drs_03 d

                LEFT JOIN tbl_drs_locations_03 l
                    ON d.dr_id = l.dr_id
                   AND l.loc_is_primary = 1

                LEFT JOIN lcn_raw_doctor_votes rv
                    ON d.dr_id = rv.dr_id

                LEFT JOIN tbl_drs_votes_03 wv
                    ON d.dr_id = wv.dr_id
            ) AS base
        ) AS results
        {$whereSql}
        ORDER BY has_coordinates DESC, distance_km ASC, dr_display_name ASC
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(':lat1', $lat);
    $stmt->bindValue(':lat2', $lat);
    $stmt->bindValue(':lng1', $lng);

    if ($drId > 0) {
        $stmt->bindValue(':dr_id', $drId);
    } else {
        $stmt->bindValue(':minPositiveRatio', $minPositiveRatio);
        $stmt->bindValue(':maxNegativeRatio', $maxNegativeRatio);

        if ($radiusEnabled) {
            $stmt->bindValue(':radiusKm', $radiusKm);
        }

        if ($city !== '') {
            $stmt->bindValue(':city', '%' . $city . '%');
        }

        if ($specialtyTermId > 0) {
            $stmt->bindValue(':specialtyTermId', $specialtyTermId, PDO::PARAM_INT);
        }

        if ($search !== '') {
            $stmt->bindValue(':search', '%' . $search . '%');
            $stmt->bindValue(':searchNormalized', '%' . $searchNormalized . '%');
        }
    }

    $stmt->execute();

    $items = $stmt->fetchAll();

    attachSpecialtyTermsToDoctors($pdo, $items);
    $specialties = getAllSpecialtyTerms($pdo);

    foreach ($items as &$item) {
        $hasCoordinates = (int)$item['has_coordinates'] === 1;

        $item['dr_id'] = (int)$item['dr_id'];
        $item['dr_is_dr'] = (int)$item['dr_is_dr'];

        $item['loc_id'] = $item['loc_id'] !== null ? (int)$item['loc_id'] : null;
        $item['loc_is_primary'] = $item['loc_is_primary'] !== null ? (int)$item['loc_is_primary'] : null;

        $item['has_coordinates'] = $hasCoordinates;

        if ($hasCoordinates) {
            $distanceKm = (float)$item['distance_km'];

            $item['loc_lat'] = (float)$item['loc_lat'];
            $item['loc_lng'] = (float)$item['loc_lng'];
            $item['distance_km'] = round($distanceKm, 2);
            $item['distance_meters'] = (int)round($distanceKm * 1000);
        } else {
            $item['loc_lat'] = null;
            $item['loc_lng'] = null;
            $item['distance_km'] = null;
            $item['distance_meters'] = null;
        }

        $item['pro'] = (int)$item['pro'];
        $item['neutral'] = (int)$item['neutral'];
        $item['contra'] = (int)$item['contra'];
        $item['total_votes'] = (int)$item['total_votes'];

        $item['positive_ratio'] = (int)$item['positive_ratio'];
        $item['neutral_ratio'] = (int)$item['neutral_ratio'];
        $item['negative_ratio'] = (int)$item['negative_ratio'];
    }
    unset($item);

    echo json_encode([
        'ok' => true,
        'center' => [
            'lat' => $lat,
            'lng' => $lng,
        ],
        'radiusEnabled' => $radiusEnabled,
        'radiusKm' => $radiusEnabled ? $radiusKm : null,
        'filters' => [
            'dr_id' => $drId,
            'minPositiveRatio' => $minPositiveRatio,
            'maxNegativeRatio' => $maxNegativeRatio,
            'acceptsGkv' => $acceptsGkv,
            'acceptsPkv' => $acceptsPkv,
            'city' => $city,
            'search' => $search,
            'specialtyTermId' => $specialtyTermId,
            'includeNoCoords' => $includeNoCoords,
            'hasWebsite' => $hasWebsite,
            'hasEmail' => $hasEmail,
            'hasPhone' => $hasPhone,
        ],
        'distanceType' => 'air_line',
        'distanceLabel' => 'Luftlinie',
        'count' => count($items),
        'specialties' => $specialties,
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