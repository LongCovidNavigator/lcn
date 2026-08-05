<?php
require_once __DIR__ . '/_lcn_db.php';

header('Content-Type: application/json; charset=utf-8');

$pdo = lcnDatabase();

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
