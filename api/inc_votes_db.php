<?php
require_once __DIR__ . '/_security.php';

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

foreach ([__DIR__ . '/../data2bs/data2lcn_db/.env'] as $p) loadEnvFile($p);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(["error"=>"Method not allowed", "method"=>($_SERVER['REQUEST_METHOD'] ?? null)], JSON_UNESCAPED_UNICODE);
  exit;
}

$dbName = getenv('LCN_DB_DATABASE');
if (!$dbName) { error_log('inc_votes_db failed: database configuration missing'); http_response_code(500); echo json_encode(["error"=>"Die Bewertung konnte nicht gespeichert werden."]); exit; }
if (in_array(strtolower(trim($dbName)), ['bookstack_db','bookstack','bookstackdb'], true)) {
  http_response_code(500);
  error_log('inc_votes_db failed: unsafe database configuration');
  echo json_encode(["error"=>"Die Bewertung konnte nicht gespeichert werden."]);
  exit;
}

$host = getenv('LCN_DB_HOST') ?: (getenv('DB_HOST') ?: 'localhost');
$port = getenv('LCN_DB_PORT') ?: (getenv('DB_PORT') ?: '3306');
$user = getenv('LCN_DB_USERNAME') ?: (getenv('DB_USERNAME') ?: 'root');
$pass = getenv('LCN_DB_PASSWORD') ?: (getenv('DB_PASSWORD') ?: '');

$raw = file_get_contents("php://input");
$body = null;

// 1) JSON versuchen
$body = json_decode($raw, true);

// 2) Fallback: form-urlencoded / multipart (falls fetch/clients anders senden)
if (!is_array($body)) {
  $body = $_POST ?: [];
}

// Payload lesen (akzeptiere mehrere Key-Namen)
$treatment = trim((string)($body["treatment"] ?? $body["Behandlung"] ?? ""));
$type      = trim((string)($body["type"] ?? $body["voteType"] ?? ""));

// UI types -> DB columns
$map = [
  "hilft" => "pro",
  "gleich" => "neutral",
  "verschlechterung" => "contra",
  "pro" => "pro",
  "neutral" => "neutral",
  "contra" => "contra",
];

if ($treatment === "" || !isset($map[$type])) {
  http_response_code(400);
  echo json_encode([
    "error" => "Ungültige Anfrage"
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$col = $map[$type];

$liveTable = "lcn_votes";     // nur schreiben
$rawTable  = "lcn_raw_votes"; // nur lesen

try {
  $dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);

  // Atomarer increment in lcn_votes
  $sql = "
    INSERT INTO `$liveTable` (Behandlung, pro, neutral, contra)
    VALUES (:b, 0, 0, 0)
    ON DUPLICATE KEY UPDATE `$col` = `$col` + 1
  ";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([":b" => $treatment]);

  // Summe live + raw zurückgeben (wie get_votes_db)
  $sum = $pdo->prepare("
    SELECT
      COALESCE(x.Behandlung, TRIM(:b)) AS Behandlung,
      (COALESCE(x.pro,0) + COALESCE(y.pro,0)) AS pro,
      (COALESCE(x.neutral,0) + COALESCE(y.neutral,0)) AS neutral,
      (COALESCE(x.contra,0) + COALESCE(y.contra,0)) AS contra
    FROM
      (SELECT TRIM(Behandlung) AS Behandlung,
              COALESCE(SUM(pro),0) AS pro,
              COALESCE(SUM(neutral),0) AS neutral,
              COALESCE(SUM(contra),0) AS contra
       FROM `$liveTable`
       WHERE TRIM(Behandlung)=TRIM(:b)
       GROUP BY TRIM(Behandlung)
      ) x
    LEFT JOIN
      (SELECT TRIM(Behandlung) AS Behandlung,
              COALESCE(SUM(pro),0) AS pro,
              COALESCE(SUM(neutral),0) AS neutral,
              COALESCE(SUM(contra),0) AS contra
       FROM `$rawTable`
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
  lcnLogApiError('inc_votes_db', $e);
  http_response_code(500);
  echo json_encode([
    "error" => "Die Bewertung konnte nicht gespeichert werden."
  ], JSON_UNESCAPED_UNICODE);
}
