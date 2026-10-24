<?php
declare(strict_types=1);
require_once __DIR__ . '/_treatments_nd.php';
function lcnTreatmentSearchCatalogSql(): string { return "(SELECT v.* FROM v_lcn_treatments v JOIN tbl_treatments_nd n ON n.treat_nd_id=v.treat_id WHERE n.review_status<>'rejected_group')"; }
function lcnTreatmentSearchProvidersSql(): string { return 'v_lcn_provider_treatments'; }
function lcnAttachTreatmentRoutes(PDO $pdo,array &$items): void {  $pending=array_fill_keys(array_column(lcnNdRows($pdo,"SELECT treat_nd_id FROM tbl_treatments_nd WHERE review_status='pending_group'"),'treat_nd_id'),true);foreach($items as &$item){$item['nd_id']=(int)$item['treat_id'];$item['review_pending']=isset($pending[$item['nd_id']]);} }
