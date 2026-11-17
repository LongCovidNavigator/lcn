<?php
require __DIR__.'/../api/_treatments_nd.php';
$p=lcnDoctorDatabase();
echo json_encode(lcnNdRows($p,'SELECT treat_nd_id,legacy_treat_id,treatmentname,typ,notes_internal,created_at FROM tbl_treatments_nd WHERE treat_nd_id IN (144,918,720,631,784,344,706,707,807)'),JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
echo json_encode(lcnNdRows($p,'SELECT a.alias_id,a.alias,a.alias_type,a.notes_internal,c.treat_nd_id,c.note,c.relation_type FROM tbl_aliases_03 a JOIN tbl_cpl_treatments_nd2aliases c ON c.alias_id=a.alias_id WHERE a.alias_id IN (1346,1578,1357,1344,1826) ORDER BY a.alias_id,c.treat_nd_id'),JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
