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

$raw = file_get_contents("php://input");
$body = json_decode($raw, true);

$treatment = trim((string)($body["treatment"] ?? ""));
$type = (string)($body["type"] ?? "");

// UI types -> DB columns
$map = [
  "hilft" => "pro",
  "gleich" => "neutral",
  "verschlechterung" => "contra",
  // optional accept DB names too
  "pro" => "pro",
  "neutral" => "neutral",
  "contra" => "contra",
];

if ($treatment === "" || !isset($map[$type])) {
  http_response_code(400);
  echo json_encode(["error"=>"bad request"]);
  exit;
}

$col = $map[$type];

// WICHTIG: Wir schreiben NUR in lcn_votes
$table = "lcn_votes";

$dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";


try {
  // Atomarer Increment
  $sql = "
    INSERT INTO `$table` (Behandlung, pro, neutral, contra)
    VALUES (:b, 0, 0, 0)
    ON DUPLICATE KEY UPDATE `$col` = `$col` + 1
  ";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([":b" => $treatment]);

  // SUMME (live + raw)
  $sum = $pdo->prepare("
    SELECT
      x.Behandlung,
      (x.pro + COALESCE(y.pro,0)) AS pro,
      (x.neutral + COALESCE(y.neutral,0)) AS neutral,
      (x.contra + COALESCE(y.contra,0)) AS contra
    FROM
      (SELECT TRIM(Behandlung) AS Behandlung,
              COALESCE(SUM(pro),0) AS pro,
              COALESCE(SUM(neutral),0) AS neutral,
              COALESCE(SUM(contra),0) AS contra
       FROM lcn_votes
       WHERE TRIM(Behandlung)=TRIM(:b)
       GROUP BY TRIM(Behandlung)
      ) x
    LEFT JOIN
      (SELECT TRIM(Behandlung) AS Behandlung,
              COALESCE(SUM(pro),0) AS pro,
              COALESCE(SUM(neutral),0) AS neutral,
              COALESCE(SUM(contra),0) AS contra
       FROM lcn_raw_votes
       WHERE TRIM(Behandlung)=TRIM(:b)
       GROUP BY TRIM(Behandlung)
      ) y
    ON x.Behandlung = y.Behandlung
  ");
  $sum->execute([":b" => $treatment]);
  $row = $sum->fetch();

  if (!$row) {
    $row = ["Behandlung"=>$treatment, "pro"=>0, "neutral"=>0, "contra"=>0];
  }

  echo json_encode(["ok"=>true, "row"=>$row], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["error"=>"vote_inc failed", "details"=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}


