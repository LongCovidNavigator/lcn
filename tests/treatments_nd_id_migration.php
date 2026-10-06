<?php
// Read-only regression check for the October 2026 ID migration.
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_id_migration.php';
$p=lcnTreatmentsNdDatabase();
foreach(LCN_PREVIOUS_ND_IDS as $previous=>$current){
    $item=lcnNdDetail($p,$current);
    if(!$item || ($item['legacy_treat_id']!==null && (int)$item['legacy_treat_id']!==$current))throw new RuntimeException('ID mismatch '.$current);
    $html=file_get_contents('http://localhost/lcn/therapie_detail.php?nd_id='.$previous);
    if(!str_contains($html,'data-treatment-id="'.$current.'"') || !str_contains($html,'data-previous-treatment-id="'.$previous.'"'))throw new RuntimeException('Compatibility mismatch '.$previous);
}
$refs=$p->query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='tbl_treatments_nd'")->fetchAll();
foreach($refs as $r){$t=$r['TABLE_NAME'];$c=$r['COLUMN_NAME'];$n=$p->query("SELECT COUNT(*) FROM `$t` c LEFT JOIN tbl_treatments_nd t ON t.treat_nd_id=c.`$c` WHERE c.`$c` IS NOT NULL AND t.treat_nd_id IS NULL")->fetchColumn();if($n)throw new RuntimeException('Orphans '.$t);}
echo "29 treatment IDs and compatibility routes verified; all treatment foreign keys resolve.\n";
