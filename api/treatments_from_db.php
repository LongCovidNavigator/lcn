<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

// Tabelle (du nutzt aktuell TABLE_NAME="lcn_raw_wiki" im Import)
$table = 'tbl_treatments_03';

try {
    $pdo = lcnDatabase();
} catch (Throwable $e) {
    lcnLogApiError('treatments_from_db connection', $e);
    http_response_code(500);
    echo json_encode(["error" => "Therapiedaten konnten nicht geladen werden."]);
    exit;
}

// 5) Spalten holen (damit Header/Keys exakt wie im JSON bleiben)
try {
    $stmt = $pdo->prepare("
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t
        ORDER BY ORDINAL_POSITION
    ");
    $stmt->execute([':t' => $table]);
    $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
    lcnLogApiError('treatments_from_db columns', $e);
    http_response_code(500);
    echo json_encode(["error" => "Therapiedaten konnten nicht geladen werden."]);
    exit;
}

if (!$cols) {
    echo json_encode([]);
    exit;
}

// technische Spalten rauswerfen
$tech = ['__id','__source','__entity_type','__payload_hash','__created_at'];
$dataCols = array_values(array_filter($cols, fn($c) => !in_array($c, $tech, true)));

if (!$dataCols) {
    echo json_encode([]);
    exit;
}

// Select bauen mit Backticks (wegen Sonderzeichen in JSON-Keys)
$selectList = implode(", ", array_map(fn($c) => "`" . str_replace("`","``",$c) . "`", $dataCols));

// Falls die Tabelle eine Spalte "behandlung" hat, zusätzlich als "Behandlung" ausgeben,
// damit bewertung.js weiterhin item.Behandlung findet.
if (in_array('behandlung', $dataCols, true) && !in_array('Behandlung', $dataCols, true)) {
    $selectList .= ", `behandlung` AS `Behandlung`";
}

try {
    $rows = $pdo->query("SELECT $selectList FROM `$table`")->fetchAll();
} catch (Throwable $e) {
    lcnLogApiError('treatments_from_db select', $e);
    http_response_code(500);
    echo json_encode(["error" => "Therapiedaten konnten nicht geladen werden."]);
    exit;
}

// Optional: JSON-Strings wieder zu Arrays/Objekten machen (wenn es wie JSON aussieht)
function maybeJsonDecode($v) {
    if (!is_string($v)) return $v;
    $t = trim($v);
    if ($t === '') return $v;
    if (($t[0] === '{' && str_ends_with($t, '}')) || ($t[0] === '[' && str_ends_with($t, ']'))) {
        $decoded = json_decode($t, true);
        if (json_last_error() === JSON_ERROR_NONE) return $decoded;
    }
    return $v;
}

foreach ($rows as &$r) {
    foreach ($r as $k => $v) {
        $r[$k] = maybeJsonDecode($v);
    }
}
unset($r);

echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
