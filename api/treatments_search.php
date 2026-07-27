<?php
header('Content-Type: application/json; charset=utf-8');

function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);

        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;

        if (getenv($key) === false) {
            putenv($key . '=' . $value);
        }
    }
}

function getIntParam($name, $default, $min, $max) {
    $value = $_GET[$name] ?? $default;

    if (!is_numeric($value)) {
        return $default;
    }

    $value = (int)$value;

    if ($value < $min) {
        return $min;
    }

    if ($value > $max) {
        return $max;
    }

    return $value;
}

function getIntListParam($name) {
    if (!isset($_GET[$name])) {
        return [];
    }

    $raw = trim((string)$_GET[$name]);

    if ($raw === '') {
        return [];
    }

    $values = array_filter(array_map('trim', explode(',', $raw)), function ($value) {
        return $value !== '' && is_numeric($value);
    });

    $ids = array_map('intval', $values);
    $ids = array_filter($ids, function ($id) {
        return $id > 0;
    });

    return array_values(array_unique($ids));
}

function getFloatParam($name, $default = null) {
    if (!isset($_GET[$name])) {
        return $default;
    }

    $value = trim((string)$_GET[$name]);

    if ($value === '' || !is_numeric($value)) {
        return $default;
    }

    return (float)$value;
}

function getStringParam($name, $default = '') {
    return trim((string)($_GET[$name] ?? $default));
}

function getBoolParam($name, $default = false) {
    if (!isset($_GET[$name])) {
        return $default;
    }

    $value = strtolower(trim((string)$_GET[$name]));

    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function getAllowedAliasDirectTypesSql() {
    return "'abbreviation', 'spelling_variant', 'spelling_variant_en', 'language_variant_en', 'language_variant_de', 'alternate_name', 'long_form', 'long_form_en', 'long_name', 'generic_name', 'trade_name', 'synonym', 'active_ingredient', 'primary_name'";
}

function getAliasDirectSafetySql($aliasTableAlias = 'a', $cplTableAlias = 'cta') {
    return "
        {$aliasTableAlias}.alias_type IN (" . getAllowedAliasDirectTypesSql() . ")
        AND COALESCE({$cplTableAlias}.note, '') NOT LIKE '%Kombitherapie-Alias%'
        AND COALESCE({$cplTableAlias}.note, '') NOT LIKE '%combo_alias%'
        AND COALESCE({$cplTableAlias}.note, '') NOT LIKE '%Sammelbegriff%'
        AND COALESCE({$cplTableAlias}.note, '') NOT LIKE '%umbrella_term%'
    ";
}

function hasValidCoordinates($lat, $lng) {
    if ($lat === null || $lng === null) {
        return false;
    }

    if (!is_numeric($lat) || !is_numeric($lng)) {
        return false;
    }

    $lat = (float)$lat;
    $lng = (float)$lng;

    return $lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180;
}

function calculateDistanceKm($lat1, $lng1, $lat2, $lng2) {
    $earthRadiusKm = 6371;

    $latFrom = deg2rad((float)$lat1);
    $lngFrom = deg2rad((float)$lng1);
    $latTo = deg2rad((float)$lat2);
    $lngTo = deg2rad((float)$lng2);

    $latDelta = $latTo - $latFrom;
    $lngDelta = $lngTo - $lngFrom;

    $angle = 2 * asin(sqrt(
        pow(sin($latDelta / 2), 2) +
        cos($latFrom) * cos($latTo) * pow(sin($lngDelta / 2), 2)
    ));

    return $earthRadiusKm * $angle;
}

function enrichItemsWithNearestProviders(
    PDO $pdo,
    array &$items,
    float $userLat,
    float $userLng,
    string $providerCity = '',
    bool $hasProviderRadius = false,
    ?float $radiusKm = null,
    bool $acceptsGkv = false
) {
    if (empty($items)) {
        return [
            'enabled' => true,
            'has_user_location' => true,
            'mode' => 'nearest_provider_per_treatment',
            'providers_with_coordinates' => 0,
            'treatments_with_nearest_provider' => 0,
            'providers' => [],
            'legend' => [],
        ];
    }

    $treatIds = [];
    $treatmentNamesById = [];

    foreach ($items as $item) {
        if (isset($item['treat_id']) && is_numeric($item['treat_id'])) {
            $treatId = (int)$item['treat_id'];
            $treatIds[] = $treatId;
            $treatmentNamesById[$treatId] = $item['behandlung'] ?? '';
        }
    }

    $treatIds = array_values(array_unique($treatIds));
    $showAllMatchingProviders = count($treatIds) > 0 && count($treatIds) <= 5;

    if (empty($treatIds)) {
        return [
            'enabled' => true,
            'has_user_location' => true,
            'mode' => 'nearest_provider_per_treatment',
            'providers_with_coordinates' => 0,
            'treatments_with_nearest_provider' => 0,
            'providers' => [],
            'legend' => [],
        ];
    }

    $placeholders = [];
    $params = [];

    foreach ($treatIds as $index => $treatId) {
        $placeholder = ':map_treat_id_' . $index;
        $placeholders[] = $placeholder;
        $params[$placeholder] = $treatId;
    }

    $providerSql = "
        SELECT
            c.treat_id,
            c.dr_id,
            c.sort_order,

            d.dr_display_name,
            d.dr_website,
            d.dr_email,

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
            l.loc_lng

        FROM tbl_cpl_drs2treatments_03 c

        INNER JOIN tbl_drs_03 d
            ON c.dr_id = d.dr_id

        INNER JOIN tbl_drs_locations_03 l
            ON c.dr_id = l.dr_id

        WHERE c.treat_id IN (" . implode(', ', $placeholders) . ")
          AND c.treat_id IS NOT NULL
          AND c.dr_id IS NOT NULL
          AND (:map_accepts_gkv = 0 OR d.dr_accepts_gkv = 'yes')
          AND l.loc_lat IS NOT NULL
          AND l.loc_lng IS NOT NULL
          AND l.loc_lat <> ''
          AND l.loc_lng <> ''
          AND (:map_provider_city = ''
               OR l.loc_city COLLATE utf8mb4_unicode_ci LIKE :map_provider_city_like)
          AND (
                :map_has_provider_radius = 0
                OR (
                    6371 * 2 * ASIN(
                        SQRT(
                            POW(SIN(RADIANS(l.loc_lat - :map_provider_lat_a) / 2), 2)
                            + COS(RADIANS(:map_provider_lat_b))
                            * COS(RADIANS(l.loc_lat))
                            * POW(SIN(RADIANS(l.loc_lng - :map_provider_lng) / 2), 2)
                        )
                    )
                ) <= :map_radius_km
          )

        ORDER BY
            c.treat_id ASC,
            l.loc_is_primary DESC,
            c.sort_order ASC,
            d.dr_display_name ASC
    ";

    $providerStmt = $pdo->prepare($providerSql);

    foreach ($params as $key => $value) {
        $providerStmt->bindValue($key, $value, PDO::PARAM_INT);
    }

    $providerStmt->bindValue(':map_provider_city', $providerCity);
    $providerStmt->bindValue(':map_provider_city_like', '%' . $providerCity . '%');
    $providerStmt->bindValue(':map_has_provider_radius', $hasProviderRadius ? 1 : 0, PDO::PARAM_INT);
    $providerStmt->bindValue(':map_provider_lat_a', $userLat);
    $providerStmt->bindValue(':map_provider_lat_b', $userLat);
    $providerStmt->bindValue(':map_provider_lng', $userLng);
    $providerStmt->bindValue(':map_radius_km', $radiusKm ?? 0);
    $providerStmt->bindValue(':map_accepts_gkv', $acceptsGkv ? 1 : 0, PDO::PARAM_INT);

    $providerStmt->execute();
    $providerRows = $providerStmt->fetchAll();

    $nearestByTreatId = [];
    $providersWithCoordinates = 0;
    $allMatchingProviders = [];

    foreach ($providerRows as $row) {
        if (!hasValidCoordinates($row['loc_lat'], $row['loc_lng'])) {
            continue;
        }

        $providersWithCoordinates++;

        $treatId = (int)$row['treat_id'];
        $providerLat = (float)$row['loc_lat'];
        $providerLng = (float)$row['loc_lng'];
        $distanceKm = calculateDistanceKm($userLat, $userLng, $providerLat, $providerLng);

        $candidate = [
            'treat_id' => $treatId,
            'treatment_name' => $treatmentNamesById[$treatId] ?? '',
            'dr_id' => (int)$row['dr_id'],
            'dr_display_name' => $row['dr_display_name'],

            'loc_label' => $row['loc_label'],
            'loc_is_primary' => (int)$row['loc_is_primary'],
            'loc_country' => $row['loc_country'],
            'loc_plz' => $row['loc_plz'],
            'loc_city' => $row['loc_city'],
            'loc_street' => $row['loc_street'],
            'loc_housenumber' => $row['loc_housenumber'],

            'loc_phone' => $row['loc_phone'],
            'loc_email' => $row['loc_email'] ?: $row['dr_email'],
            'loc_website' => $row['loc_website'] ?: $row['dr_website'],

            'loc_lat' => $providerLat,
            'loc_lng' => $providerLng,

            'distance_km' => round($distanceKm, 1),
            'distance_km_exact' => $distanceKm,
        ];

        if ($showAllMatchingProviders) {
            $providerForMap = $candidate;
            unset($providerForMap['distance_km_exact']);
            $allMatchingProviders[] = $providerForMap;
        }

        if (
            !isset($nearestByTreatId[$treatId]) ||
            $distanceKm < $nearestByTreatId[$treatId]['distance_km_exact']
        ) {
            $nearestByTreatId[$treatId] = $candidate;
        }
    }

    $treatmentsWithNearestProvider = 0;

    foreach ($items as &$item) {
        $treatId = (int)$item['treat_id'];

        if (isset($nearestByTreatId[$treatId])) {
            $nearestProvider = $nearestByTreatId[$treatId];
            unset($nearestProvider['distance_km_exact']);

            $item['nearest_provider'] = $nearestProvider;
            $item['nearest_provider_distance_km'] = $nearestProvider['distance_km'];

            $treatmentsWithNearestProvider++;
        } else {
            $item['nearest_provider'] = null;
            $item['nearest_provider_distance_km'] = null;
        }
    }
    unset($item);

    $legend = [];

    if ($showAllMatchingProviders) {
        foreach ($treatIds as $index => $treatId) {
            $legend[] = [
                'treat_id' => $treatId,
                'treatment_name' => $treatmentNamesById[$treatId] ?? '',
                'color_index' => $index,
            ];
        }
    }

    return [
        'enabled' => true,
        'has_user_location' => true,
        'mode' => $showAllMatchingProviders ? 'all_matching_providers' : 'nearest_provider_per_treatment',
        'providers_with_coordinates' => $providersWithCoordinates,
        'treatments_with_nearest_provider' => $treatmentsWithNearestProvider,
        'providers' => $showAllMatchingProviders ? $allMatchingProviders : [],
        'legend' => $legend,
    ];
}

try {
    $envPath = __DIR__ . '/../data2bs/data2lcn_db/.env';
    loadEnv($envPath);

    $host = $_ENV['LCN_DB_HOST'] ?? '127.0.0.1';
    $port = $_ENV['LCN_DB_PORT'] ?? '3306';
    $db   = $_ENV['LCN_DB_DATABASE'] ?? '';
    $user = $_ENV['LCN_DB_USERNAME'] ?? '';
    $pass = $_ENV['LCN_DB_PASSWORD'] ?? '';

    if ($db === '') {
        throw new Exception('LCN_DB_DATABASE fehlt.');
    }

    $lowerDbName = strtolower(trim($db));

    if (in_array($lowerDbName, ['bookstack_db', 'bookstack', 'bookstackdb'], true)) {
        throw new Exception('Refusing to use BookStack DB. Check LCN_DB_DATABASE.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $treatId = getIntParam('treat_id', 0, 0, 999999);
    $treatIds = getIntListParam('treat_ids');
    $hasTreatIdsParam = isset($_GET['treat_ids']);

    $search = getStringParam('search');
    $category = getStringParam('category');
	$subcategory = getStringParam('subcategory');

    $searchMode = getStringParam('search_mode', 'basic');

    if (!in_array($searchMode, ['basic', 'alias_direct', 'alias_extended'], true)) {
        $searchMode = 'basic';
    }

    $aliasSuggest = getStringParam('alias_suggest');
    $aliasSuggestQuery = getStringParam('q');

    $providerCity = getStringParam('provider_city');
    $providerCity = preg_replace('/\s+/', ' ', $providerCity);

    $providerLat = getFloatParam('provider_lat', null);
    $providerLng = getFloatParam('provider_lng', null);
    $radiusKm = getFloatParam('radius_km', null);

    $hasProviderRadius =
        $radiusKm !== null &&
        $radiusKm > 0 &&
        hasValidCoordinates($providerLat, $providerLng);

    if (!$hasProviderRadius) {
        $radiusKm = null;
        $providerLat = null;
        $providerLng = null;
    }

    $minPositive = getIntParam('min_positive', 0, 0, 100);
    $maxNegative = getIntParam('max_negative', 100, 0, 100);

    $minProvider = getIntParam('min_provider', 0, 0, 9999);
    $onlyWithProvider = getBoolParam('only_with_provider', false);
    $acceptsGkv = getBoolParam('accepts_gkv', false);
    $mappedProvidersOnly = getBoolParam('mapped_providers_only', false);
    $includeNoCoords = getBoolParam('include_no_coords', false) && $hasProviderRadius && !$mappedProvidersOnly;

    if ($onlyWithProvider) {
        $minProvider = max(1, $minProvider);
    }

    $includeMap = getBoolParam('include_map', false);
    $userLat = getFloatParam('lat', null);
    $userLng = getFloatParam('lng', null);
    $hasUserLocationForMap = $includeMap && hasValidCoordinates($userLat, $userLng);

    $sort = getStringParam('sort', 'name');
    $direction = strtolower(getStringParam('direction', 'asc'));

    $allowedSortColumns = [
        'name' => 'results.behandlung',
        'positive_ratio' => 'results.positive_ratio',
        'negative_ratio' => 'results.negative_ratio',
        'total_votes' => 'results.total_votes',
        'provider_count' => 'results.provider_count',
        'matching_provider_count' => 'results.matching_provider_count',
        'category' => 'results.typ',
    ];

    if (!array_key_exists($sort, $allowedSortColumns)) {
        $sort = 'name';
    }

    if (!in_array($direction, ['asc', 'desc'], true)) {
        $direction = 'asc';
    }

    $orderColumn = $allowedSortColumns[$sort];
    $orderDirection = strtoupper($direction);

    if ($aliasSuggest === '1') {
        $suggestions = [];

        if ($aliasSuggestQuery !== '') {
            if ($searchMode === 'basic') {
                $suggestStmt = $pdo->prepare("
                    SELECT
                        t.behandlung AS value,
                        t.behandlung AS label,
                        t.treat_id,
                        t.typ,
                        'basic' AS match_mode,
                        'treatment_name' AS match_type
                    FROM tbl_treatments_03 t
                    WHERE t.behandlung COLLATE utf8mb4_unicode_ci LIKE :suggest_search
                    ORDER BY t.behandlung ASC
                    LIMIT 20
                ");

                $suggestStmt->bindValue(':suggest_search', '%' . $aliasSuggestQuery . '%');
                $suggestStmt->execute();
                $suggestions = $suggestStmt->fetchAll();
            } else {
                $aliasModeFilter = '';

                if ($searchMode === 'alias_direct') {
                    $aliasModeFilter = " AND (" . getAliasDirectSafetySql('a', 'cta') . ")";
                }

                $suggestStmt = $pdo->prepare("
                    SELECT
                        a.alias AS value,
                        CONCAT(a.alias, ' → ', GROUP_CONCAT(DISTINCT t.behandlung ORDER BY t.behandlung SEPARATOR ' | ')) AS label,
                        a.alias_id,
                        a.alias_type,
                        COUNT(DISTINCT cta.treat_id) AS treatment_count,
                        GROUP_CONCAT(DISTINCT t.treat_id ORDER BY t.behandlung SEPARATOR ',') AS treat_ids,
                        GROUP_CONCAT(DISTINCT t.behandlung ORDER BY t.behandlung SEPARATOR ' | ') AS treatments,
                        :suggest_mode AS match_mode,
                        'alias' AS match_type
                    FROM tbl_aliases_03 a
                    INNER JOIN tbl_cpl_treatments2aliases_03 cta
                        ON cta.alias_id = a.alias_id
                    INNER JOIN tbl_treatments_03 t
                        ON t.treat_id = cta.treat_id
                    WHERE a.alias COLLATE utf8mb4_unicode_ci LIKE :suggest_search
                    {$aliasModeFilter}
                    GROUP BY
                        a.alias_id,
                        a.alias,
                        a.alias_type
                    ORDER BY
                        CASE WHEN a.alias COLLATE utf8mb4_unicode_ci = :suggest_exact THEN 0 ELSE 1 END,
                        a.alias ASC
                    LIMIT 20
                ");

                $suggestStmt->bindValue(':suggest_search', '%' . $aliasSuggestQuery . '%');
                $suggestStmt->bindValue(':suggest_exact', $aliasSuggestQuery);
                $suggestStmt->bindValue(':suggest_mode', $searchMode);
                $suggestStmt->execute();
                $suggestions = $suggestStmt->fetchAll();
            }
        }

        echo json_encode([
            'ok' => true,
            'mode' => $searchMode,
            'query' => $aliasSuggestQuery,
            'suggestions' => $suggestions,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }

    if ($aliasSuggest === 'smart') {
        $suggestions = [];

        if ($aliasSuggestQuery !== '') {
            $directStmt = $pdo->prepare("
                SELECT
                    t.treat_id,
                    t.behandlung,
                    t.typ
                FROM tbl_treatments_03 t
                WHERE t.behandlung COLLATE utf8mb4_unicode_ci LIKE :suggest_search
                ORDER BY
                    CASE WHEN t.behandlung COLLATE utf8mb4_unicode_ci = :suggest_exact THEN 0 ELSE 1 END,
                    t.behandlung ASC
                LIMIT 30
            ");

            $directStmt->bindValue(':suggest_search', '%' . $aliasSuggestQuery . '%');
            $directStmt->bindValue(':suggest_exact', $aliasSuggestQuery);
            $directStmt->execute();

            foreach ($directStmt->fetchAll() as $row) {
                $suggestions[] = [
                    'group_key' => 'direct',
                    'group_label' => 'Direkte Treffer',
                    'label' => $row['behandlung'],
                    'description' => $row['typ'] ? 'Direkter Treatment-Name · Kategorie: ' . $row['typ'] : 'Direkter Treatment-Name',
                    'badge' => 'Name',
                    'search_mode' => 'basic',
                    'search_value' => $row['behandlung'],
                    'treat_id' => (int)$row['treat_id'],
                ];
            }

            $aliasStmt = $pdo->prepare("
                SELECT
                    a.alias_id,
                    a.alias,
                    a.alias_type,
                    c.treat_id,
                    c.note,
                    t.behandlung,
                    t.typ
                FROM tbl_aliases_03 a
                INNER JOIN tbl_cpl_treatments2aliases_03 c
                    ON c.alias_id = a.alias_id
                INNER JOIN tbl_treatments_03 t
                    ON t.treat_id = c.treat_id
                WHERE a.alias COLLATE utf8mb4_unicode_ci LIKE :suggest_search
                ORDER BY
                    CASE WHEN a.alias COLLATE utf8mb4_unicode_ci = :suggest_exact THEN 0 ELSE 1 END,
                    a.alias ASC,
                    c.sort_order ASC,
                    t.behandlung ASC
                LIMIT 500
            ");

            $aliasStmt->bindValue(':suggest_search', '%' . $aliasSuggestQuery . '%');
            $aliasStmt->bindValue(':suggest_exact', $aliasSuggestQuery);
            $aliasStmt->execute();

            $aliasGroups = [];

            foreach ($aliasStmt->fetchAll() as $row) {
                $aliasId = (int)$row['alias_id'];

                if (!isset($aliasGroups[$aliasId])) {
                    $aliasGroups[$aliasId] = [
                        'alias_id' => $aliasId,
                        'alias' => $row['alias'],
                        'alias_type' => $row['alias_type'],
                        'rows' => [],
                    ];
                }

                $aliasGroups[$aliasId]['rows'][] = $row;
            }

            foreach ($aliasGroups as $group) {
                $rows = $group['rows'];
                $treatmentCount = count(array_unique(array_map(function ($row) {
                    return (int)$row['treat_id'];
                }, $rows)));

                foreach ($rows as $row) {
                    $note = (string)($row['note'] ?? '');
                    $noteLower = mb_strtolower($note, 'UTF-8');
                    $aliasType = (string)($row['alias_type'] ?? '');
                    $aliasTypeLower = mb_strtolower($aliasType, 'UTF-8');

                    $isSpecial = $treatmentCount > 1
                        || $aliasTypeLower === 'umbrella_term'
                        || str_contains($noteLower, 'kombitherapie-alias')
                        || str_contains($noteLower, 'combo_alias')
                        || str_contains($noteLower, 'sammelbegriff')
                        || str_contains($noteLower, 'umbrella_term');

                    $isCleanAliasTarget = !$isSpecial
                        || $note === ''
                        || $note === null
                        || $note === $row['alias_type'];

                    if ($isCleanAliasTarget) {
                        $suggestions[] = [
                            'group_key' => 'alias',
                            'group_label' => 'Alias / Synonym',
                            'label' => $row['alias'] . ' → ' . $row['behandlung'],
                            'description' => $row['alias_type'] ? 'Alias-Typ: ' . $row['alias_type'] : 'Eindeutiger Alias-Treffer',
                            'badge' => 'Alias',
                            'search_mode' => 'alias_direct',
                            'search_value' => $row['alias'],
                            'alias_id' => (int)$row['alias_id'],
                            'treat_id' => (int)$row['treat_id'],
                        ];
                    }

                    if ($isSpecial) {
                        $suggestions[] = [
                            'group_key' => 'extended',
                            'group_label' => 'Oberbegriff / Kombibegriff',
                            'label' => $row['alias'] . ' → ' . $row['behandlung'],
                            'description' => 'Erweiterte Suche über ' . $treatmentCount . ' verknüpfte Therapien.',
                            'badge' => 'Erweitert',
                            'search_mode' => 'alias_extended',
                            'search_value' => $row['alias'],
                            'alias_id' => (int)$row['alias_id'],
                            'treat_id' => (int)$row['treat_id'],
                        ];
                    }
                }
            }
        }

        echo json_encode([
            'ok' => true,
            'query' => $aliasSuggestQuery,
            'suggestions' => $suggestions,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }

    $baseSql = "
        FROM (
            SELECT
                calculated.*,

                CASE
                    WHEN calculated.total_votes > 0
                    THEN ROUND((calculated.pro / calculated.total_votes) * 100)
                    ELSE 0
                END AS positive_ratio,

                CASE
                    WHEN calculated.total_votes > 0
                    THEN ROUND((calculated.neutral / calculated.total_votes) * 100)
                    ELSE 0
                END AS neutral_ratio,

                CASE
                    WHEN calculated.total_votes > 0
                    THEN ROUND((calculated.contra / calculated.total_votes) * 100)
                    ELSE 0
                END AS negative_ratio

            FROM (
                SELECT
                    t.treat_id,
                    t.slug,
                    t.behandlung,
                    t.typ,
					t.unterkategorie,
                    t.aufwand,
                    t.crashrisiko,
                    t.eskalationsstufe,
                    t.kosten,
                    t.nutzen,
                    t.wirkgeschwindigkeit,
                    t.wirkmechanismus,
                    t.indikationen_anwendungsgebiete,

                    (
                        COALESCE(lv.pro, 0)
                        + COALESCE(rv.pro, 0)
                    ) AS pro,

                    (
                        COALESCE(lv.neutral, 0)
                        + COALESCE(rv.neutral, 0)
                    ) AS neutral,

                    (
                        COALESCE(lv.contra, 0)
                        + COALESCE(rv.contra, 0)
                    ) AS contra,

                    (
                        COALESCE(lv.pro, 0)
                        + COALESCE(rv.pro, 0)
                        + COALESCE(lv.neutral, 0)
                        + COALESCE(rv.neutral, 0)
                        + COALESCE(lv.contra, 0)
                        + COALESCE(rv.contra, 0)
                    ) AS total_votes,

                    COALESCE(pc.provider_count, 0) AS total_provider_count,

                    CASE
                        WHEN :mapped_providers_only_for_select = 1
                        THEN COALESCE(kpc.mapped_provider_count, 0)
                        ELSE COALESCE(pc.provider_count, 0)
                    END AS provider_count,

                    COALESCE(mpc.matching_provider_count, 0) AS matching_provider_count
                    ,COALESCE(upc.unlocated_provider_count, 0) AS unlocated_provider_count

                FROM tbl_treatments_03 t

                LEFT JOIN (
                    SELECT
                        TRIM(Behandlung) AS behandlung_key,
                        SUM(COALESCE(pro, 0)) AS pro,
                        SUM(COALESCE(neutral, 0)) AS neutral,
                        SUM(COALESCE(contra, 0)) AS contra
                    FROM lcn_votes
                    WHERE Behandlung IS NOT NULL
                      AND TRIM(Behandlung) <> ''
                    GROUP BY TRIM(Behandlung)
                ) lv
                    ON LOWER(TRIM(t.behandlung)) COLLATE utf8mb4_unicode_ci
                     = LOWER(lv.behandlung_key) COLLATE utf8mb4_unicode_ci

                LEFT JOIN (
                    SELECT
                        TRIM(Behandlung) AS behandlung_key,
                        SUM(COALESCE(pro, 0)) AS pro,
                        SUM(COALESCE(neutral, 0)) AS neutral,
                        SUM(COALESCE(contra, 0)) AS contra
                    FROM lcn_raw_votes
                    WHERE Behandlung IS NOT NULL
                      AND TRIM(Behandlung) <> ''
                    GROUP BY TRIM(Behandlung)
                ) rv
                    ON LOWER(TRIM(t.behandlung)) COLLATE utf8mb4_unicode_ci
                     = LOWER(rv.behandlung_key) COLLATE utf8mb4_unicode_ci

                LEFT JOIN (
                    SELECT
                        treat_id,
                        COUNT(DISTINCT dr_id) AS provider_count
                    FROM tbl_cpl_drs2treatments_03
                    WHERE treat_id IS NOT NULL
                      AND dr_id IS NOT NULL
                    GROUP BY treat_id
                ) pc
                    ON t.treat_id = pc.treat_id

                LEFT JOIN (
                    SELECT
                        c.treat_id,
                        COUNT(DISTINCT c.dr_id) AS mapped_provider_count
                    FROM tbl_cpl_drs2treatments_03 c
                    INNER JOIN tbl_drs_03 d
                        ON c.dr_id = d.dr_id
                    INNER JOIN tbl_drs_locations_03 l
                        ON c.dr_id = l.dr_id
                    WHERE c.treat_id IS NOT NULL
                      AND c.dr_id IS NOT NULL
                      AND l.loc_lat IS NOT NULL
                      AND l.loc_lng IS NOT NULL
                      AND l.loc_lat <> ''
                      AND l.loc_lng <> ''
                      AND (:accepts_gkv_for_mapped = 0 OR d.dr_accepts_gkv = 'yes')
                    GROUP BY c.treat_id
                ) kpc
                    ON t.treat_id = kpc.treat_id

                LEFT JOIN (
                    SELECT
                        c.treat_id,
                        COUNT(DISTINCT c.dr_id) AS matching_provider_count
                    FROM tbl_cpl_drs2treatments_03 c
                    INNER JOIN tbl_drs_03 d
                        ON c.dr_id = d.dr_id
                    INNER JOIN tbl_drs_locations_03 l
                        ON c.dr_id = l.dr_id
                    WHERE c.treat_id IS NOT NULL
                      AND c.dr_id IS NOT NULL
                      AND (:accepts_gkv_for_count = 0 OR d.dr_accepts_gkv = 'yes')
                      AND (
                            :mapped_providers_only_for_count = 0
                            OR (
                                l.loc_lat IS NOT NULL
                                AND l.loc_lng IS NOT NULL
                                AND l.loc_lat <> ''
                                AND l.loc_lng <> ''
                            )
                      )
                      AND (:provider_city_for_count = ''
                           OR l.loc_city COLLATE utf8mb4_unicode_ci LIKE :provider_city_like_for_count)
                      AND (
                            :has_provider_radius_for_count = 0
                            OR (
                                l.loc_lat IS NOT NULL
                                AND l.loc_lng IS NOT NULL
                                AND l.loc_lat <> ''
                                AND l.loc_lng <> ''
                                AND (
                                    6371 * 2 * ASIN(
                                        SQRT(
                                            POW(SIN(RADIANS(l.loc_lat - :provider_lat_for_count_a) / 2), 2)
                                            + COS(RADIANS(:provider_lat_for_count_b))
                                            * COS(RADIANS(l.loc_lat))
                                            * POW(SIN(RADIANS(l.loc_lng - :provider_lng_for_count) / 2), 2)
                                        )
                                    )
                                ) <= :radius_km_for_count
                            )
                      )
                    GROUP BY c.treat_id
                ) mpc
                    ON t.treat_id = mpc.treat_id

                LEFT JOIN (
                    SELECT
                        c.treat_id,
                        COUNT(DISTINCT c.dr_id) AS unlocated_provider_count
                    FROM tbl_cpl_drs2treatments_03 c
                    INNER JOIN tbl_drs_03 d
                        ON c.dr_id = d.dr_id
                    WHERE c.treat_id IS NOT NULL
                      AND c.dr_id IS NOT NULL
                      AND (:accepts_gkv_for_unlocated = 0 OR d.dr_accepts_gkv = 'yes')
                      AND NOT EXISTS (
                          SELECT 1
                          FROM tbl_drs_locations_03 ul
                          WHERE ul.dr_id = c.dr_id
                            AND ul.loc_lat IS NOT NULL
                            AND ul.loc_lng IS NOT NULL
                            AND ul.loc_lat <> ''
                            AND ul.loc_lng <> ''
                      )
                    GROUP BY c.treat_id
                ) upc
                    ON t.treat_id = upc.treat_id
            ) AS calculated
        ) AS results
    ";

    $whereParts = [];
    $params = [
        ':mapped_providers_only_for_select' => $mappedProvidersOnly ? 1 : 0,
        ':provider_city_for_count' => $providerCity,
        ':provider_city_like_for_count' => '%' . $providerCity . '%',
        ':has_provider_radius_for_count' => $hasProviderRadius ? 1 : 0,
        ':provider_lat_for_count_a' => $hasProviderRadius ? (float)$providerLat : 0,
        ':provider_lat_for_count_b' => $hasProviderRadius ? (float)$providerLat : 0,
        ':provider_lng_for_count' => $hasProviderRadius ? (float)$providerLng : 0,
        ':radius_km_for_count' => $hasProviderRadius ? (float)$radiusKm : 0,
        ':accepts_gkv_for_count' => $acceptsGkv ? 1 : 0,
        ':mapped_providers_only_for_count' => $mappedProvidersOnly ? 1 : 0,
        ':accepts_gkv_for_unlocated' => $acceptsGkv ? 1 : 0,
        ':accepts_gkv_for_mapped' => $acceptsGkv ? 1 : 0,
    ];

    if ($hasTreatIdsParam) {
		if (empty($treatIds)) {
			$whereParts[] = "1 = 0";
		} else {
			$treatIdPlaceholders = [];

			foreach ($treatIds as $index => $currentTreatId) {
				$placeholder = ':selected_treat_id_' . $index;
				$treatIdPlaceholders[] = $placeholder;
				$params[$placeholder] = $currentTreatId;
			}

			$whereParts[] = "results.treat_id IN (" . implode(', ', $treatIdPlaceholders) . ")";
		}
	} elseif ($treatId > 0) {
		$whereParts[] = "results.treat_id = :treat_id";
		$params[':treat_id'] = $treatId;
	}

	if ($treatId <= 0) {
		if (!$hasTreatIdsParam && $search !== '') {
			$searchWhere = "
				results.behandlung COLLATE utf8mb4_unicode_ci LIKE :search
			";

			if ($searchMode === 'alias_direct') {
				$searchWhere .= "
					OR EXISTS (
						SELECT 1
						FROM tbl_cpl_treatments2aliases_03 cta
						INNER JOIN tbl_aliases_03 a
							ON a.alias_id = cta.alias_id
						WHERE cta.treat_id = results.treat_id
						  AND a.alias COLLATE utf8mb4_unicode_ci LIKE :search
						  AND (" . getAliasDirectSafetySql('a', 'cta') . ")
					)
				";
			} elseif ($searchMode === 'alias_extended') {
				$searchWhere .= "
					OR EXISTS (
						SELECT 1
						FROM tbl_cpl_treatments2aliases_03 cta
						INNER JOIN tbl_aliases_03 a
							ON a.alias_id = cta.alias_id
						WHERE cta.treat_id = results.treat_id
						  AND a.alias COLLATE utf8mb4_unicode_ci LIKE :search
					)
				";
			}

			$whereParts[] = "({$searchWhere})";
			$params[':search'] = '%' . $search . '%';
		}

		if ($category !== '') {
			$whereParts[] = "results.typ COLLATE utf8mb4_unicode_ci = :category";
			$params[':category'] = $category;
		}

		if ($subcategory !== '') {
			$whereParts[] = "results.unterkategorie COLLATE utf8mb4_unicode_ci = :subcategory";
			$params[':subcategory'] = $subcategory;
		}

        if ($providerCity !== '' || $hasProviderRadius || $acceptsGkv) {
            if ($includeNoCoords) {
                $whereParts[] = "(results.matching_provider_count > 0 OR results.unlocated_provider_count > 0)";
            } else {
			    $whereParts[] = "results.matching_provider_count > 0";
            }
		}

		$whereParts[] = "results.positive_ratio >= :min_positive";
		$params[':min_positive'] = $minPositive;

		$whereParts[] = "results.negative_ratio <= :max_negative";
		$params[':max_negative'] = $maxNegative;

		$whereParts[] = "results.provider_count >= :min_provider";
		$params[':min_provider'] = $minProvider;

        if ($mappedProvidersOnly) {
            $whereParts[] = "results.provider_count > 0";
        }
	}

    $whereSql = '';

    if (!empty($whereParts)) {
        $whereSql = " WHERE " . implode(" AND ", $whereParts);
    }

    $totalCount = (int)$pdo->query("SELECT COUNT(*) FROM tbl_treatments_03")->fetchColumn();

    $categoriesStmt = $pdo->query("
		SELECT DISTINCT typ
		FROM tbl_treatments_03
		WHERE typ IS NOT NULL
		  AND TRIM(typ) <> ''
		ORDER BY typ ASC
	");

	$categories = array_map(function ($row) {
		return $row['typ'];
	}, $categoriesStmt->fetchAll());

	$subcategoriesStmt = $pdo->query("
		SELECT DISTINCT typ, unterkategorie
		FROM tbl_treatments_03
		WHERE typ IS NOT NULL
		  AND TRIM(typ) <> ''
		  AND unterkategorie IS NOT NULL
		  AND TRIM(unterkategorie) <> ''
		ORDER BY typ ASC, unterkategorie ASC
	");

	$subcategoriesByCategory = [];

	foreach ($subcategoriesStmt->fetchAll() as $row) {
		$mainCategory = $row['typ'];

		if (!isset($subcategoriesByCategory[$mainCategory])) {
			$subcategoriesByCategory[$mainCategory] = [];
		}

		$subcategoriesByCategory[$mainCategory][] = $row['unterkategorie'];
	}

	$subcategories = $category !== ''
		? ($subcategoriesByCategory[$category] ?? [])
		: [];

    $countSql = "
        SELECT COUNT(*)
        {$baseSql}
        {$whereSql}
    ";

    $countStmt = $pdo->prepare($countSql);

    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }

    $countStmt->execute();
    $filteredCount = (int)$countStmt->fetchColumn();

    $itemsSql = "
        SELECT
            results.*
        {$baseSql}
        {$whereSql}
        ORDER BY {$orderColumn} {$orderDirection}, results.behandlung ASC
    ";

    $itemsStmt = $pdo->prepare($itemsSql);

    foreach ($params as $key => $value) {
        $itemsStmt->bindValue($key, $value);
    }

    $itemsStmt->execute();
    $items = $itemsStmt->fetchAll();

    foreach ($items as &$item) {
        $item['treat_id'] = (int)$item['treat_id'];

        $item['pro'] = (int)$item['pro'];
        $item['neutral'] = (int)$item['neutral'];
        $item['contra'] = (int)$item['contra'];
        $item['total_votes'] = (int)$item['total_votes'];

        $item['positive_ratio'] = (int)$item['positive_ratio'];
        $item['neutral_ratio'] = (int)$item['neutral_ratio'];
        $item['negative_ratio'] = (int)$item['negative_ratio'];

        $item['provider_count'] = (int)$item['provider_count'];
        $item['total_provider_count'] = (int)$item['total_provider_count'];
        $item['matching_provider_count'] = (int)$item['matching_provider_count'];
        $item['unlocated_provider_count'] = (int)$item['unlocated_provider_count'];
    }
    unset($item);

    $map = [
		'enabled' => $includeMap,
		'has_user_location' => $hasUserLocationForMap,
		'mode' => 'nearest_provider_per_treatment',
		'providers_with_coordinates' => 0,
		'treatments_with_nearest_provider' => 0,
		'providers' => [],
		'legend' => [],
	];

    if ($includeMap && $hasUserLocationForMap) {
        $map = enrichItemsWithNearestProviders(
            $pdo,
            $items,
            (float)$userLat,
            (float)$userLng,
            $providerCity,
            $hasProviderRadius,
            $radiusKm,
            $acceptsGkv
        );
    } elseif ($includeMap) {
        foreach ($items as &$item) {
            $item['nearest_provider'] = null;
            $item['nearest_provider_distance_km'] = null;
        }
        unset($item);
    }

    echo json_encode([
		'ok' => true,
		'count' => $filteredCount,
		'total_count' => $totalCount,
		'categories' => $categories,
		'subcategories' => $subcategories,
		'subcategories_by_category' => $subcategoriesByCategory,
		'items' => $items,
		'filters' => [
            'treat_id' => $treatId,
            'treat_ids' => $treatIds,
            'search' => $search,
			'search_mode' => $searchMode,
			'category' => $category,
			'subcategory' => $subcategory,
			'provider_city' => $providerCity,
            'provider_lat' => $hasProviderRadius ? (float)$providerLat : null,
            'provider_lng' => $hasProviderRadius ? (float)$providerLng : null,
            'radius_km' => $hasProviderRadius ? (float)$radiusKm : null,
            'min_positive' => $minPositive,
            'max_negative' => $maxNegative,
            'min_provider' => $minProvider,
            'only_with_provider' => $onlyWithProvider,
            'accepts_gkv' => $acceptsGkv,
            'include_no_coords' => $includeNoCoords,
            'mapped_providers_only' => $mappedProvidersOnly,
            'sort' => $sort,
            'direction' => $direction,
            'include_map' => $includeMap,
            'lat' => $hasUserLocationForMap ? (float)$userLat : null,
            'lng' => $hasUserLocationForMap ? (float)$userLng : null,
        ],
        'map' => $map,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
