<?php
// CLI-only, additive and repeatable; existing votes remain untouched.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/_doctor_hybrid.php';
$pdo = lcnDoctorDatabase();
if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'lcn_hybrid_database') throw new RuntimeException('Expected local lcn_hybrid_database.');
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/012_treatment_experience_dummy.sql'));
$insert = $pdo->prepare('INSERT INTO treatment_experience_dummy_counts (treat_id,worsening,unchanged,improvement,healing) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE treat_id=VALUES(treat_id)');
$pdo->beginTransaction();
try {
    foreach ($pdo->query('SELECT treat_id FROM v_lcn_treatments') as $row) {
        $id = (int)$row['treat_id'];
        $counts = [];
        for ($i=0; $i<4; $i++) $counts[] = 2 + (int)(sprintf('%u', crc32("treatment-experience:$id:$i")) % 49);
        $insert->execute([$id, ...$counts]);
    }
    $pdo->commit();
} catch (Throwable $error) { $pdo->rollBack(); throw $error; }
echo 'Synthetic four-category ratings: '.$pdo->query('SELECT COUNT(*) FROM treatment_experience_dummy_counts')->fetchColumn()." therapies.\n";
