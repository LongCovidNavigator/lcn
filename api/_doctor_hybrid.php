<?php
require_once __DIR__ . '/_lcn_db.php';

// Development selection: keep the original LCN IDs for routes and relationships.
const LCN_PRIORITY_DOCTOR_IDS = [2,542,581,589,608,609,613,627,645,673,676,679,686,690,694,775,1056,1057,1059,1074,1111,1112,1147,1148,1149,1150,1151,1152,1153,1154,1155,1156,1157,1158,1159,1160,1161,1162,1163];

function lcnDoctorDatabase(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    // Use the local hybrid database without changing the profile of other APIs.
    $host = lcnEnv('LCN_DOCTORS_DB_HOST', lcnEnv('LCN_DB_LOCAL_MAIN_HOST', 'localhost'));
    $database = lcnEnv('LCN_DOCTORS_DB_DATABASE', 'lcn_hybrid_database');
    $user = lcnEnv('LCN_DOCTORS_DB_USERNAME', lcnEnv('LCN_DB_LOCAL_MAIN_USERNAME', lcnEnv('LCN_DB_LOCAL_MAIN_USER')));
    $password = lcnEnv('LCN_DOCTORS_DB_PASSWORD', lcnEnv('LCN_DB_LOCAL_MAIN_PASSWORD', ''));
    if (!$user || !preg_match('/\A[a-zA-Z0-9_]+\z/', $database) || stripos($database, 'bookstack') !== false) {
        throw new RuntimeException('Invalid hybrid doctor database configuration.');
    }
    $pdo = new PDO('mysql:host=' . $host . ';port=' . lcnEnv('LCN_DOCTORS_DB_PORT', '3306') . ';dbname=' . $database . ';charset=utf8mb4', $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);
    return $pdo;
}

function lcnDoctorSourceSql(): string
{
    $ids = implode(',', LCN_PRIORITY_DOCTOR_IDS);
    return "(SELECT lcn_id AS dr_id, anzeigename AS dr_display_name,
        COALESCE(behandlertyp, institutionstyp, datensatztyp) AS dr_type,
        CASE WHEN titel LIKE '%Dr.%' THEN 1 ELSE 0 END AS dr_is_dr,
        titel AS dr_title_raw, vorname AS dr_firstname, nachname AS dr_lastname,
        organisationsname AS dr_org_name, website AS dr_website, email AS dr_email, telefon AS dr_phone,
        CASE sprechstunde_gkv WHEN 'GKV' THEN 'yes' WHEN 'Selbstzahler' THEN 'no' ELSE NULL END AS dr_accepts_gkv,
        CASE sprechstunde_pkv WHEN 'PKV' THEN 'yes' WHEN 'Selbstzahler' THEN 'no' ELSE NULL END AS dr_accepts_pkv
        FROM tbl_entities_nd WHERE lcn_id IN ($ids) AND aktiv = 1)";
}

function lcnDoctorResearch(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare('SELECT * FROM tbl_entities_nd WHERE lcn_id = ?');
    $stmt->execute([$id]);
    $result = ['entity' => $stmt->fetch()];
    foreach (['specialty' => ['tbl_fachrichtungen_nd', 'fachrichtung'], 'qualifications' => ['tbl_zusatzqualifikationen_nd', 'zusatzqualifikation'], 'specializations' => ['tbl_spezialisierungen_nd', 'spezialisierung']] as $key => [$table, $column]) {
        $stmt = $pdo->prepare("SELECT id AS term_id, $column AS term_label FROM $table WHERE lcn_id = ? ORDER BY $column");
        $stmt->execute([$id]);
        $result[$key] = $stmt->fetchAll();
    }
    $stmt = $pdo->prepare('SELECT * FROM tbl_costs_nd WHERE lcn_id = ? ORDER BY cost_id');
    $stmt->execute([$id]);
    $result['costs'] = $stmt->fetchAll();
    $stmt = $pdo->prepare('SELECT * FROM tbl_drs_locations_03 WHERE dr_id = ? ORDER BY loc_is_primary DESC, loc_id');
    $stmt->execute([$id]);
    $result['locations'] = $stmt->fetchAll();
    return $result;
}
