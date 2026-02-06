<?php
header('Content-Type: application/json; charset=utf-8');

function loadEnvFile($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        $pos = strpos($line, '=');
        if ($pos === false) continue;

        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));

        // strip quotes
        if ((str_starts_with($val, '"') && str_ends_with($val, '"')) || (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
            $val = substr($val, 1, -1);
        }

        // don't overwrite existing env
        if (getenv($key) === false) {
            putenv("$key=$val");
            $_ENV[$key] = $val;
        }
    }
}

// 1) .env im selben Ordner wie dieses PHP (api/.env) ODER Projektroot (lcn/.env)
$envCandidates = [
  __DIR__ . '/.env',                 // optional: lcn/api/.env
  dirname(__DIR__) . '/.env',        // optional: lcn/.env
  'C:/xampp/htdocs/bookstack/.env',  // <-- DEINE BookStack .env
];

foreach ($envCandidates as $p) {
  loadEnvFile($p);
}



// 2) Nur LCN-DB erlauben (kein BookStack)
$dbName = getenv('LCN_DB_DATABASE');
if (!$dbName) {
    http_response_code(500);
    echo json_encode(["error" => "LCN_DB_DATABASE fehlt. Lege eine .env mit LCN_DB_* an."]);
    exit;
}
$lower = strtolower(trim($dbName));
if (in_array($lower, ['bookstack_db', 'bookstack', 'bookstackdb'], true)) {
    http_response_code(500);
    echo json_encode(["error" => "Refusing to use BookStack DB. Check LCN_DB_DATABASE."]);
    exit;
}

$host = getenv('LCN_DB_HOST') ?: (getenv('DB_HOST') ?: 'localhost');
$port = getenv('LCN_DB_PORT') ?: (getenv('DB_PORT') ?: '3306');
$user = getenv('LCN_DB_USERNAME') ?: (getenv('DB_USERNAME') ?: 'root');
$pass = getenv('LCN_DB_PASSWORD') ?: (getenv('DB_PASSWORD') ?: '');

// 3) Tabelle (du nutzt aktuell TABLE_NAME="lcn_raw_wiki" im Import)
$table = 'lcn_raw_wiki';

// 4) DB connect
$dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "DB connect failed", "details" => $e->getMessage()]);
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
    http_response_code(500);
    echo json_encode(["error" => "Could not read columns", "details" => $e->getMessage()]);
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

try {
    $rows = $pdo->query("SELECT $selectList FROM `$table`")->fetchAll();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Select failed", "details" => $e->getMessage()]);
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
