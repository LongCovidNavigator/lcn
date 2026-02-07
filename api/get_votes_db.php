<?php
header('Content-Type: application/json; charset=utf-8');

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
if (!$dbName) { http_response_code(500); echo json_encode(["error"=>"LCN_DB_DATABASE fehlt"]); exit; }
if (in_array(strtolower(trim($dbName)), ['bookstack_db','bookstack','bookstackdb'], true)) {
  http_response_code(500);
  echo json_encode(["error"=>"Refusing BookStack DB"]);
  exit;
}

$host = getenv('LCN_DB_HOST') ?: (getenv('DB_HOST') ?: 'localhost');
$port = getenv('LCN_DB_PORT') ?: (getenv('DB_PORT') ?: '3306');
$user = getenv('LCN_DB_USERNAME') ?: (getenv('DB_USERNAME') ?: 'root');
$pass = getenv('LCN_DB_PASSWORD') ?: (getenv('DB_PASSWORD') ?: '');

$dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
$pdo = new PDO($dsn, $user, $pass, [
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
]);

// =========================
// CONFIG: TABLES
// =========================
$liveTable = 'lcn_votes';
$rawTable  = 'lcn_raw_votes';

// =========================
// 1) LIVE votes (normalerweise 1 row pro Behandlung)
// =========================
$liveRows = $pdo->query("
  SELECT
    TRIM(`Behandlung`) AS `Behandlung`,
    COALESCE(`pro`, 0)     AS `pro`,
    COALESCE(`neutral`, 0) AS `neutral`,
    COALESCE(`contra`, 0)  AS `contra`
  FROM `$liveTable`
  WHERE `Behandlung` IS NOT NULL AND TRIM(`Behandlung`) <> ''
")->fetchAll();

$map = []; // Behandlung -> sums
foreach ($liveRows as $r) {
  $b = (string)$r['Behandlung'];
  // falls doch Duplikate in lcn_votes existieren: addieren
  if (!isset($map[$b])) $map[$b] = ["pro"=>0, "neutral"=>0, "contra"=>0];
  $map[$b]["pro"]     += (int)$r["pro"];
  $map[$b]["neutral"] += (int)$r["neutral"];
  $map[$b]["contra"]  += (int)$r["contra"];
}

// =========================
// 2) RAW votes (kann Duplikate enthalten -> GROUP BY + SUM)
// =========================
$rawSums = $pdo->query("
  SELECT
    TRIM(`Behandlung`) AS `Behandlung`,
    COALESCE(SUM(`pro`), 0)     AS `pro`,
    COALESCE(SUM(`neutral`), 0) AS `neutral`,
    COALESCE(SUM(`contra`), 0)  AS `contra`
  FROM `$rawTable`
  WHERE `Behandlung` IS NOT NULL AND TRIM(`Behandlung`) <> ''
  GROUP BY TRIM(`Behandlung`)
")->fetchAll();

foreach ($rawSums as $r) {
  $b = (string)$r['Behandlung'];
  if (!isset($map[$b])) $map[$b] = ["pro"=>0, "neutral"=>0, "contra"=>0];
  $map[$b]["pro"]     += (int)$r["pro"];
  $map[$b]["neutral"] += (int)$r["neutral"];
  $map[$b]["contra"]  += (int)$r["contra"];
}

// =========================
// 3) Output als Liste
// =========================
$out = [];
foreach ($map as $b => $v) {
  $out[] = [
    "Behandlung" => $b,
    "pro" => (int)$v["pro"],
    "neutral" => (int)$v["neutral"],
    "contra" => (int)$v["contra"],
  ];
}

usort($out, fn($a,$b) => strcasecmp($a["Behandlung"], $b["Behandlung"]));

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
