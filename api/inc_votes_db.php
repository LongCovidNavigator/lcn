<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(["error"=>"Method not allowed", "method"=>($_SERVER['REQUEST_METHOD'] ?? null)], JSON_UNESCAPED_UNICODE);
  exit;
}

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
  $pdo = lcnDatabase();

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
