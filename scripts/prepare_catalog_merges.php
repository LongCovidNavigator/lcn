<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/_treatments_nd.php';
lcnTreatmentsNdDatabase()->exec(file_get_contents(__DIR__.'/../migrations/020_catalog_merges.sql'));
echo "Catalog merge archive and redirects ready.\n";
