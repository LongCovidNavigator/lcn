<?php
require_once __DIR__ . '/_voting.php';

header('Content-Type: application/json; charset=utf-8');

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

function normalizeNullableInt($value) {
    return $value !== null ? (int)$value : null;
}

function normalizeNullableFloat($value) {
    return $value !== null ? (float)$value : null;
}

function loadTreatmentBase(PDO $pdo, int $treatId) {
    $stmt = $pdo->prepare("
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

                COALESCE(pc.provider_count, 0) AS provider_count

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

            WHERE t.treat_id = :treat_id
        ) AS calculated
    ");

    $stmt->bindValue(':treat_id', $treatId, PDO::PARAM_INT);
    $stmt->execute();

    $item = $stmt->fetch();

    if (!$item) {
        return null;
    }

    $item['treat_id'] = (int)$item['treat_id'];

    $item['pro'] = (int)$item['pro'];
    $item['neutral'] = (int)$item['neutral'];
    $item['contra'] = (int)$item['contra'];
    $item['total_votes'] = (int)$item['total_votes'];

    $item['positive_ratio'] = (int)$item['positive_ratio'];
    $item['neutral_ratio'] = (int)$item['neutral_ratio'];
    $item['negative_ratio'] = (int)$item['negative_ratio'];

    $item['provider_count'] = (int)$item['provider_count'];

    return $item;
}

function loadTreatmentProviders(PDO $pdo, int $treatId) {
    $stmt = $pdo->prepare("
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
                c.dr_id,
                c.sort_order,

                d.dr_display_name,
                d.dr_type,
                d.dr_is_dr,
                d.dr_website,
                d.dr_email,
                d.dr_accepts_gkv,
                d.dr_accepts_pkv,

                l.loc_label,
                l.loc_plz,
                l.loc_city,
                l.loc_street,
                l.loc_housenumber,
                l.loc_phone,
                l.loc_email,
                l.loc_website,
                l.loc_lat,
                l.loc_lng,

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

            FROM tbl_cpl_drs2treatments_03 c

            INNER JOIN tbl_drs_03 d
                ON d.dr_id = c.dr_id

            LEFT JOIN tbl_drs_locations_03 l
                ON l.dr_id = d.dr_id
                AND l.loc_is_primary = 1

            LEFT JOIN lcn_raw_doctor_votes rv
                ON rv.dr_id = d.dr_id

            LEFT JOIN tbl_drs_votes_03 wv
                ON wv.dr_id = d.dr_id

            WHERE c.treat_id = :treat_id
        ) AS calculated

        ORDER BY calculated.sort_order ASC, calculated.dr_display_name ASC
    ");

    $stmt->bindValue(':treat_id', $treatId, PDO::PARAM_INT);
    $stmt->execute();

    $providers = $stmt->fetchAll();

    foreach ($providers as &$provider) {
        $hasCoordinates = (int)$provider['has_coordinates'] === 1;

        $provider['dr_id'] = (int)$provider['dr_id'];
        $provider['sort_order'] = (int)$provider['sort_order'];
        $provider['dr_is_dr'] = (int)$provider['dr_is_dr'];
        $provider['has_coordinates'] = $hasCoordinates;

        if ($hasCoordinates) {
            $provider['loc_lat'] = normalizeNullableFloat($provider['loc_lat']);
            $provider['loc_lng'] = normalizeNullableFloat($provider['loc_lng']);
        } else {
            $provider['loc_lat'] = null;
            $provider['loc_lng'] = null;
        }

        $provider['pro'] = (int)$provider['pro'];
        $provider['neutral'] = (int)$provider['neutral'];
        $provider['contra'] = (int)$provider['contra'];
        $provider['total_votes'] = (int)$provider['total_votes'];

        $provider['positive_ratio'] = (int)$provider['positive_ratio'];
        $provider['neutral_ratio'] = (int)$provider['neutral_ratio'];
        $provider['negative_ratio'] = (int)$provider['negative_ratio'];
    }

    unset($provider);

    return $providers;
}

function loadTreatmentSources(PDO $pdo, int $treatId) {
    $stmt = $pdo->prepare("
        SELECT
            c.source_id,
            c.sort_order,
            c.relation_type,
            c.note AS link_note,

            s.source_key,
            s.source_type,
            s.title,
            s.display_name,
            s.landing_url,
            s.source_url,
            s.doi,
            s.publisher,
            s.authors,
            s.publication_year,
            s.journal_or_org,
            s.citation_text,
            s.source_detail,
            s.review_status
        FROM tbl_cpl_treatments2sources_03 c
        INNER JOIN tbl_treatments_sources_03 s
            ON s.source_id = c.source_id
        WHERE c.treat_id = :treat_id
        ORDER BY c.sort_order ASC, s.display_name ASC
    ");

    $stmt->bindValue(':treat_id', $treatId, PDO::PARAM_INT);
    $stmt->execute();

    $sources = $stmt->fetchAll();

    foreach ($sources as &$source) {
        $source['source_id'] = (int)$source['source_id'];
        $source['sort_order'] = (int)$source['sort_order'];
        $source['publication_year'] = normalizeNullableInt($source['publication_year']);
    }

    unset($source);

    return $sources;
}

function loadTreatmentAliases(PDO $pdo, int $treatId) {
    $stmt = $pdo->prepare("
        SELECT
            c.alias_id,
            c.sort_order,
            c.note AS link_note,

            a.alias,
            a.alias_type,
            a.source_examples
        FROM tbl_cpl_treatments2aliases_03 c
        INNER JOIN tbl_aliases_03 a
            ON a.alias_id = c.alias_id
        WHERE c.treat_id = :treat_id
        ORDER BY c.sort_order ASC, a.alias ASC
    ");

    $stmt->bindValue(':treat_id', $treatId, PDO::PARAM_INT);
    $stmt->execute();

    $aliases = $stmt->fetchAll();

    foreach ($aliases as &$alias) {
        $alias['alias_id'] = (int)$alias['alias_id'];
        $alias['sort_order'] = (int)$alias['sort_order'];
    }

    unset($alias);

    return $aliases;
}

try {
    $treatId = getIntParam('treat_id', 0, 1, 999999);

    if ($treatId <= 0) {
        http_response_code(400);

        echo json_encode([
            'ok' => false,
            'error' => true,
            'message' => 'Parameter treat_id fehlt oder ist ungültig.',
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }

    $pdo = lcnDatabase();

    $item = loadTreatmentBase($pdo, $treatId);

    if (!$item) {
        http_response_code(404);

        echo json_encode([
            'ok' => false,
            'error' => true,
            'message' => 'Keine Therapie mit dieser treat_id gefunden.',
            'treat_id' => $treatId,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }

    $item['own_vote'] = null;
    $voterKey = lcnExistingVoterKey();

    if ($voterKey !== null) {
        $ownVoteStatement = $pdo->prepare("
            SELECT vote
            FROM treatment_votes
            WHERE voter_key = :voter_key AND treat_id = :treat_id
            LIMIT 1
        ");
        $ownVoteStatement->execute([':voter_key' => $voterKey, ':treat_id' => $treatId]);
        $ownVote = $ownVoteStatement->fetchColumn();
        $item['own_vote'] = $ownVote !== false ? $ownVote : null;
    }

    $item['providers'] = loadTreatmentProviders($pdo, $treatId);
    $item['sources'] = loadTreatmentSources($pdo, $treatId);
    $item['aliases'] = loadTreatmentAliases($pdo, $treatId);

    echo json_encode([
        'ok' => true,
        'item' => $item,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    lcnLogApiError('treatments_detail', $e);
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => true,
        'message' => 'Therapiedetails konnten nicht geladen werden.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
