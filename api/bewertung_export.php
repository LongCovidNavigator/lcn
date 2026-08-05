<?php
require_once __DIR__ . '/_lcn_db.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: http://localhost:8080");

$liveTable = 'lcn_votes';
$rawTable  = 'lcn_raw_votes';

try {
  $pdo = lcnDatabase();

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
