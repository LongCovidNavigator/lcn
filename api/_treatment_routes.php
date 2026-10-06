<?php
declare(strict_types=1);
require_once __DIR__ . '/_treatments_nd.php';
function lcnTreatmentSearchCatalogSql(): string { return 'v_lcn_treatments'; }
function lcnTreatmentSearchProvidersSql(): string { return 'v_lcn_provider_treatments'; }
function lcnAttachTreatmentRoutes(PDO $pdo,array &$items): void { foreach($items as &$item) $item['nd_id']=(int)$item['treat_id']; }
