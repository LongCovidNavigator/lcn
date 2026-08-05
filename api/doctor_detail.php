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

function sendJson($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function groupTermsByType($terms) {
    $grouped = [
        'specialty' => [],
        'badge' => [],
        'accessibility' => [],
        'other' => [],
    ];

    foreach ($terms as $term) {
        $type = $term['term_type'] ?? 'other';

        if (!array_key_exists($type, $grouped)) {
            $type = 'other';
        }

        $grouped[$type][] = $term;
    }

    return $grouped;
}

function groupTreatmentsByType($treatments) {
    $grouped = [];

    foreach ($treatments as $treatment) {
        $type = trim((string)($treatment['typ'] ?? ''));

        if ($type === '') {
            $type = 'Ohne Kategorie';
        }

        if (!array_key_exists($type, $grouped)) {
            $grouped[$type] = [];
        }

        $grouped[$type][] = $treatment;
    }

    return $grouped;
}

try {
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

    if (!$id || $id <= 0) {
        throw new InvalidArgumentException("Keine gültige Arzt-ID übergeben.");
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

    $doctorSql = "
        SELECT
            results.*,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.pro / results.total_votes) * 100)
                ELSE 0
            END AS positive_ratio,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.neutral / results.total_votes) * 100)
                ELSE 0
            END AS neutral_ratio,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.contra / results.total_votes) * 100)
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
                d.dr_org_name,
                d.dr_website,
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

            WHERE d.dr_id = :id

            LIMIT 1
        ) AS results
    ";

    $doctorStmt = $pdo->prepare($doctorSql);
    $doctorStmt->bindValue(':id', $id, PDO::PARAM_INT);
    $doctorStmt->execute();

    $item = $doctorStmt->fetch();

    if (!$item) {
        sendJson([
            'ok' => false,
            'error' => true,
            'message' => 'Für diese Arzt-ID wurde kein Datensatz gefunden.',
        ], 404);
    }

    $termsSql = "
        SELECT
            t.term_id,
            t.term_type,
            t.term_code,
            t.term_label,
            t.term_desc,
            c.confidence
        FROM tbl_cpl_drs2terms_03 c
        INNER JOIN tbl_terms_03 t
            ON c.term_id = t.term_id
        WHERE c.dr_id = :id
        ORDER BY
            CASE t.term_type
                WHEN 'specialty' THEN 1
                WHEN 'badge' THEN 2
                WHEN 'accessibility' THEN 3
                ELSE 4
            END,
            t.term_label ASC
    ";

    $termsStmt = $pdo->prepare($termsSql);
    $termsStmt->bindValue(':id', $id, PDO::PARAM_INT);
    $termsStmt->execute();

    $terms = $termsStmt->fetchAll();
    $groupedTerms = groupTermsByType($terms);

    $treatmentsSql = "
        SELECT
            results.*,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.pro / results.total_votes) * 100)
                ELSE 0
            END AS positive_ratio,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.neutral / results.total_votes) * 100)
                ELSE 0
            END AS neutral_ratio,

            CASE
                WHEN results.total_votes > 0
                THEN ROUND((results.contra / results.total_votes) * 100)
                ELSE 0
            END AS negative_ratio

        FROM (
            SELECT
                c.treat_id,
                c.sort_order,
                t.slug,
                t.behandlung,
                t.typ,
                t.unterkategorie,

                COALESCE(rv.pro, 0) AS pro,
                COALESCE(rv.neutral, 0) AS neutral,
                COALESCE(rv.contra, 0) AS contra,
                (
                    COALESCE(rv.pro, 0)
                    + COALESCE(rv.neutral, 0)
                    + COALESCE(rv.contra, 0)
                ) AS total_votes,

                COALESCE(pc.provider_count, 0) AS provider_count

            FROM tbl_cpl_drs2treatments_03 c

            INNER JOIN tbl_treatments_03 t
                ON c.treat_id = t.treat_id

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
                ON c.treat_id = pc.treat_id

            WHERE c.dr_id = :id
        ) AS results
        ORDER BY
            CASE
                WHEN results.sort_order IS NULL OR results.sort_order = 0 THEN 999999
                ELSE results.sort_order
            END ASC,
            results.typ ASC,
            results.behandlung ASC
    ";

    $treatmentsStmt = $pdo->prepare($treatmentsSql);
    $treatmentsStmt->bindValue(':id', $id, PDO::PARAM_INT);
    $treatmentsStmt->execute();

    $treatments = $treatmentsStmt->fetchAll();

    $hasCoordinates = (int)$item['has_coordinates'] === 1;

    $item['dr_id'] = (int)$item['dr_id'];
    $item['dr_is_dr'] = $item['dr_is_dr'] !== null ? (int)$item['dr_is_dr'] : null;

    $item['loc_id'] = $item['loc_id'] !== null ? (int)$item['loc_id'] : null;
    $item['loc_is_primary'] = $item['loc_is_primary'] !== null ? (int)$item['loc_is_primary'] : null;

    $item['has_coordinates'] = $hasCoordinates;

    if ($hasCoordinates) {
        $item['loc_lat'] = (float)$item['loc_lat'];
        $item['loc_lng'] = (float)$item['loc_lng'];
    } else {
        $item['loc_lat'] = null;
        $item['loc_lng'] = null;
    }

    $item['pro'] = (int)$item['pro'];
    $item['neutral'] = (int)$item['neutral'];
    $item['contra'] = (int)$item['contra'];
    $item['total_votes'] = (int)$item['total_votes'];

    $item['positive_ratio'] = (int)$item['positive_ratio'];
    $item['neutral_ratio'] = (int)$item['neutral_ratio'];
    $item['negative_ratio'] = (int)$item['negative_ratio'];

    foreach ($treatments as &$treatment) {
        $treatment['treat_id'] = (int)$treatment['treat_id'];
        $treatment['sort_order'] = $treatment['sort_order'] !== null ? (int)$treatment['sort_order'] : null;
        $treatment['pro'] = (int)$treatment['pro'];
        $treatment['neutral'] = (int)$treatment['neutral'];
        $treatment['contra'] = (int)$treatment['contra'];
        $treatment['total_votes'] = (int)$treatment['total_votes'];
        $treatment['positive_ratio'] = (int)$treatment['positive_ratio'];
        $treatment['neutral_ratio'] = (int)$treatment['neutral_ratio'];
        $treatment['negative_ratio'] = (int)$treatment['negative_ratio'];
        $treatment['provider_count'] = (int)$treatment['provider_count'];
    }
    unset($treatment);

    $groupedTreatments = groupTreatmentsByType($treatments);

    sendJson([
        'ok' => true,
        'item' => $item,
        'terms' => $groupedTerms,
        'treatments' => $treatments,
        'treatments_grouped' => $groupedTreatments,
    ]);

} catch (InvalidArgumentException $e) {
    sendJson([
        'ok' => false,
        'error' => true,
        'message' => $e->getMessage(),
    ], 400);

} catch (Throwable $e) {
    sendJson([
        'ok' => false,
        'error' => true,
        'message' => $e->getMessage(),
    ], 500);
}
