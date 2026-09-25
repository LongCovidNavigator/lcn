<?php
declare(strict_types=1);

require_once __DIR__ . '/_doctor_hybrid.php';
require_once __DIR__ . '/_search_normalization.php';

/** Read-only repository for the separate ND prototype. */
function lcnTreatmentsNdDatabase(): PDO
{
    $pdo = lcnDoctorDatabase();
    if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'lcn_hybrid_database') {
        throw new RuntimeException('ND prototype requires lcn_hybrid_database.');
    }
    return $pdo;
}

function lcnNdRows(PDO $pdo, string $sql, array $params = []): array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function lcnNdSearch(PDO $pdo, string $search = ''): array
{
    $name = lcnNormalizedSearchSql('t.treatmentname');
    $alias = lcnNormalizedSearchSql('a.alias');
    // Literal substring matching: user-entered % and _ are not SQL wildcards.
    $term = '%' . strtr(lcnNormalizeSearchTerm($search), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    return lcnNdRows($pdo, "SELECT t.* FROM tbl_treatments_nd t
        WHERE $name LIKE ? ESCAPE '!' OR EXISTS (
            SELECT 1 FROM tbl_cpl_treatments_nd2aliases c
            JOIN tbl_aliases_03 a ON a.alias_id = c.alias_id
            WHERE c.treat_nd_id = t.treat_nd_id AND $alias LIKE ? ESCAPE '!')
        ORDER BY t.treatmentname, t.treat_nd_id", [$term, $term]);
}

function lcnNdDetail(PDO $pdo, int $id): ?array
{
    $rows = lcnNdRows($pdo, 'SELECT * FROM tbl_treatments_nd WHERE treat_nd_id = ?', [$id]);
    if (!$rows) return null;
    $item = $rows[0];
    $item['costs'] = lcnNdRows($pdo, 'SELECT * FROM tbl_treatment_costs_nd WHERE treat_nd_id = ? ORDER BY land, treatment_cost_id', [$id]);
    $item['pharmacies'] = lcnNdRows($pdo, 'SELECT p.name, p.ort, p.land, c.konkretes_angebot, c.quelle_url, c.sicherheit
        FROM tbl_cpl_treatments_nd2pharmacies c JOIN tbl_treatment_pharmacies_nd p ON p.pharmacy_id = c.pharmacy_id
        WHERE c.treat_nd_id = ? ORDER BY p.name', [$id]);
    $item['relations'] = lcnNdRows($pdo, 'SELECT r.*, COALESCE(n.treat_nd_id, mapped.treat_nd_id) AS resolved_nd_id,
        COALESCE(n.treatmentname, mapped.treatmentname, r.target_label, old.behandlung) AS resolved_name,
        old.treat_id AS resolved_legacy_id
        FROM tbl_cpl_treatments_nd_relations r
        LEFT JOIN tbl_treatments_nd n ON n.treat_nd_id = r.target_treat_nd_id
        LEFT JOIN tbl_treatments_nd mapped ON r.target_treat_nd_id IS NULL AND mapped.legacy_treat_id = r.target_legacy_treat_id
        LEFT JOIN tbl_treatments_03 old ON old.treat_id = r.target_legacy_treat_id
        WHERE r.source_treat_nd_id = ? ORDER BY r.relation_id', [$id]);
    $item['incoming_relations'] = lcnNdRows($pdo, 'SELECT r.*, source.treat_nd_id AS resolved_nd_id, source.treatmentname AS resolved_name
        FROM tbl_cpl_treatments_nd_relations r JOIN tbl_treatments_nd source ON source.treat_nd_id = r.source_treat_nd_id
        WHERE (r.target_treat_nd_id = ? OR (r.target_treat_nd_id IS NULL AND r.target_legacy_treat_id = ?))
        AND r.source_treat_nd_id <> ? ORDER BY source.treatmentname, r.relation_id', [$id, $item['legacy_treat_id'], $id]);
    $item['category_peers'] = ndHasCategory($item['unterkategorie']) ? lcnNdRows($pdo,
        'SELECT treat_nd_id, treatmentname, typ FROM tbl_treatments_nd WHERE unterkategorie = ? AND treat_nd_id <> ? ORDER BY treatmentname', [$item['unterkategorie'], $id]) : [];
    $item['symptom_peers'] = lcnNdRows($pdo,
        "SELECT DISTINCT t.treat_nd_id, t.treatmentname, s.sym_id, s.sym_name FROM tbl_cpl_treatments_nd2symptoms own
        JOIN tbl_cpl_treatments_nd2symptoms other ON other.sym_id = own.sym_id
        JOIN tbl_treatments_nd t ON t.treat_nd_id = other.treat_nd_id
        JOIN tbl_symptoms s ON s.sym_id = own.sym_id
        WHERE own.treat_nd_id = ? AND t.treat_nd_id <> ? AND own.aktiv = 1 AND other.aktiv = 1
        AND own.match_status IN ('eindeutig gematcht', 'manuell normalisiert nach LCN-Entscheid 2026-09-24')
        AND other.match_status IN ('eindeutig gematcht', 'manuell normalisiert nach LCN-Entscheid 2026-09-24')
        ORDER BY t.treatmentname, s.sym_name", [$id, $id]);
    $item['aliases'] = lcnNdRows($pdo, 'SELECT DISTINCT a.alias FROM tbl_cpl_treatments_nd2aliases c
        JOIN tbl_aliases_03 a ON a.alias_id = c.alias_id WHERE c.treat_nd_id = ? ORDER BY a.alias', [$id]);
    // Shared aliases are navigational links, never inferred treatment-relation types.
    // Include legacy targets not yet present in the smaller ND catalogue.
    $item['alias_peers'] = lcnNdRows($pdo, 'SELECT DISTINCT n.treat_nd_id AS resolved_nd_id,
        n.legacy_treat_id AS resolved_legacy_id, n.treatmentname AS resolved_name, a.alias
        FROM tbl_cpl_treatments_nd2aliases own
        JOIN tbl_cpl_treatments_nd2aliases other ON other.alias_id = own.alias_id AND other.treat_nd_id <> own.treat_nd_id
        JOIN tbl_treatments_nd n ON n.treat_nd_id = other.treat_nd_id
        JOIN tbl_aliases_03 a ON a.alias_id = own.alias_id WHERE own.treat_nd_id = ?
        UNION
        SELECT DISTINCT mapped.treat_nd_id, old.treat_id, COALESCE(mapped.treatmentname, old.behandlung), a.alias
        FROM tbl_cpl_treatments_nd2aliases own
        JOIN tbl_cpl_treatments2aliases_03 other ON other.alias_id = own.alias_id
        JOIN tbl_treatments_03 old ON old.treat_id = other.treat_id
        LEFT JOIN tbl_treatments_nd mapped ON mapped.legacy_treat_id = old.treat_id
        JOIN tbl_aliases_03 a ON a.alias_id = own.alias_id
        WHERE own.treat_nd_id = ? AND old.treat_id <> ?
        AND (mapped.treat_nd_id IS NULL OR mapped.treat_nd_id <> ?)
        ORDER BY resolved_name, alias', [$id, $id, $item['legacy_treat_id'] ?? -1, $id]);
    $item['symptoms'] = lcnNdRows($pdo, "SELECT DISTINCT s.sym_id, s.sym_name, s.sym_category FROM tbl_cpl_treatments_nd2symptoms c
        JOIN tbl_symptoms s ON s.sym_id = c.sym_id WHERE c.treat_nd_id = ? AND c.aktiv = 1
        AND c.match_status IN ('eindeutig gematcht', 'manuell normalisiert nach LCN-Entscheid 2026-09-24')
        ORDER BY s.sym_category, s.sym_name", [$id]);
    $item['providers'] = lcnNdRows($pdo, "SELECT c.id, c.lcn_id AS dr_id,
        COALESCE(NULLIF(e.anzeigename, ''), c.anbieter_label) AS name,
        COALESCE(e.behandlertyp, e.institutionstyp, e.datensatztyp) AS kind,
        l.loc_city, l.loc_plz, l.loc_lat, l.loc_lng, e.website, c.relation_status, c.sicherheit, c.quelle_url, c.note
        FROM tbl_cpl_entities2treatments_nd c LEFT JOIN tbl_entities_nd e ON e.lcn_id = c.lcn_id
        LEFT JOIN tbl_drs_locations_03 l ON l.loc_id = (SELECT ll.loc_id FROM tbl_drs_locations_03 ll
            WHERE ll.dr_id = e.lcn_id ORDER BY ll.loc_is_primary DESC, ll.loc_id LIMIT 1)
        WHERE c.treat_nd_id = ? AND (e.aktiv = 1 OR (c.lcn_id IS NULL AND c.relation_status = 'kandidat'))
        AND c.relation_status IN ('bestand', 'belegt', 'kandidat')
        ORDER BY c.relation_status, name, c.id", [$id]);
    $item['studies'] = lcnNdRows($pdo, 'SELECT studienname, studienlink, quellentyp, pruefdatum, review_status
        FROM tbl_treatment_studies_nd WHERE treat_nd_id = ? ORDER BY study_id', [$id]);
    $item['field_sources'] = lcnNdRows($pdo, 'SELECT datenpunkt, unterpunkt, recherchierter_wert, sicherheit, quellentyp, quelle_url, pruefdatum, recherchekontext
        FROM tbl_treatment_field_sources_nd WHERE treat_nd_id = ? ORDER BY field_source_id', [$id]);
    // Aggregate only; respondent identifiers and individual answers never reach the view.
    $item['community'] = lcnNdRows($pdo, "SELECT question_key, answer_value, answer_unit, review_status, COUNT(*) AS n
        FROM tbl_treatment_community_answers_nd WHERE treat_nd_id = ?
        AND review_status IN ('active', 'approved', 'suspicious')
        GROUP BY question_key, answer_value, answer_unit, review_status ORDER BY question_key, answer_value", [$id]);
    return $item;
}

function ndHasCategory(?string $value): bool { return $value !== null && trim($value) !== ''; }
