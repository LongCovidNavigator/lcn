<?php
require_once __DIR__ . '/_lcn_db.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $pdo=lcnDatabase();
    $treatments=$pdo->query("SELECT treat_id AS id, behandlung AS label, typ AS meta, COALESCE(wiki_url_path,'') AS website FROM tbl_treatments_03 ORDER BY behandlung")->fetchAll();
    $doctors=$pdo->query("SELECT dr_id AS id, dr_display_name AS label, COALESCE(dr_type,'') AS meta, COALESCE(dr_website,'') AS website FROM tbl_drs_03 ORDER BY dr_display_name")->fetchAll();
    $specialties=$pdo->query("SELECT term_id AS id, term_label AS label, term_code AS meta FROM tbl_terms_03 WHERE term_type='specialty' ORDER BY term_label")->fetchAll();
    echo json_encode(['ok'=>true,'treatments'=>$treatments,'doctors'=>$doctors,'specialties'=>$specialties],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch(Throwable $error){lcnLogApiError('submission_options',$error);http_response_code(500);echo json_encode(['ok'=>false,'error'=>'Auswahllisten konnten nicht geladen werden.'],JSON_UNESCAPED_UNICODE);}
