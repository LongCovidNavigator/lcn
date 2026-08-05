<?php
require_once __DIR__ . '/_security.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: http://localhost:8080");

function loadEnvFile($path) {
  if (!file_exists($path)) return;
  foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#')) continue;
    $pos = strpos($line, '=');
    if ($pos === false) continue;
    $key = trim(substr($line, 0, $pos));
    $val = trim(substr($line, $pos + 1));
    if ((str_starts_with($val, '"') && str_ends_with($val, '"')) || (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
      $val = substr($val, 1, -1);
    }
    if (getenv($key) === false) putenv("$key=$val");
  }
}

foreach ([__DIR__.'/.env', dirname(__DIR__).'/.env', 'C:/xampp/htdocs/bookstack/.env'] as $p) loadEnvFile($p);

$dbName = getenv('LCN_DB_DATABASE');
if (!$dbName) { error_log('bewertung_export failed: database configuration missing'); http_response_code(500); echo json_encode(["error"=>"Export konnte nicht geladen werden."]); exit; }
if (in_array(strtolower(trim($dbName)), ['bookstack_db','bookstack','bookstackdb'], true)) {
  http_response_code(500);
  error_log('bewertung_export failed: unsafe database configuration');
  echo json_encode(["error"=>"Export konnte nicht geladen werden."]);
  exit;
}

$host = getenv('LCN_DB_HOST') ?: (getenv('DB_HOST') ?: 'localhost');
$port = getenv('LCN_DB_PORT') ?: (getenv('DB_PORT') ?: '3306');
$user = getenv('LCN_DB_USERNAME') ?: (getenv('DB_USERNAME') ?: 'root');
$pass = getenv('LCN_DB_PASSWORD') ?: (getenv('DB_PASSWORD') ?: '');

$liveTable = 'lcn_votes';
$rawTable  = 'lcn_raw_votes';

try {
  $dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);

  // SQL: beide Tabellen UNION ALL -> GROUP BY normalized key
  $sql = "
    SELECT
      MIN(Behandlung_display) AS Behandlung,
      SUM(pro)     AS pro,
      SUM(neutral) AS neutral,
      SUM(contra)  AS contra
    FROM (
      SELECT
        LOWER(TRIM(Behandlung)) AS k,
        TRIM(Behandlung) AS Behandlung_display,
        COALESCE(pro,0)     AS pro,
        COALESCE(neutral,0) AS neutral,
        COALESCE(contra,0)  AS contra
      FROM `$liveTable`
      WHERE Behandlung IS NOT NULL AND TRIM(Behandlung) <> ''

      UNION ALL

      SELECT
        LOWER(TRIM(Behandlung)) AS k,
        TRIM(Behandlung) AS Behandlung_display,
        COALESCE(pro,0)     AS pro,
        COALESCE(neutral,0) AS neutral,
        COALESCE(contra,0)  AS contra
      FROM `$rawTable`
      WHERE Behandlung IS NOT NULL AND TRIM(Behandlung) <> ''
    ) all_votes
    GROUP BY k
    ORDER BY Behandlung
  ";

  $out = $pdo->query($sql)->fetchAll();

  // sicherheitshalber ints
  foreach ($out as &$r) {
    $r["pro"] = (int)$r["pro"];
    $r["neutral"] = (int)$r["neutral"];
    $r["contra"] = (int)$r["contra"];
  }

  echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  lcnLogApiError('bewertung_export', $e);
  http_response_code(500);
  echo json_encode(["error"=>"Export konnte nicht geladen werden."], JSON_UNESCAPED_UNICODE);
}
