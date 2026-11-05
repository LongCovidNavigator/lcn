<?php
require __DIR__.'/../api/_lcn_db.php';
$p=lcnDatabase();
echo json_encode($p->query("SELECT datensatztyp,behandlertyp,institutionstyp,COUNT(*) n FROM tbl_entities_nd GROUP BY 1,2,3 ORDER BY 1,2,3")->fetchAll(),JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
