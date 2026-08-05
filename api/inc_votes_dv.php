<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

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

try {
  $pdo = lcnDatabase();
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
  lcnLogApiError('inc_votes_dv', $e);
  http_response_code(500);
  echo json_encode(["error"=>"Die Bewertung konnte nicht gespeichert werden."], JSON_UNESCAPED_UNICODE);
}


