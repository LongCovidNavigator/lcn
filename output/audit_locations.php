<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/_doctor_hybrid.php';
$pdo=lcnDatabase();
$pdo->exec('SET TRANSACTION READ ONLY');
$pdo->beginTransaction();
$rows=$pdo->query('SELECT l.*,e.anzeigename,e.aktiv,e.datensatztyp FROM tbl_drs_locations_03 l LEFT JOIN tbl_entities_nd e ON e.lcn_id=l.dr_id')->fetchAll();
$summary=[];$missing=[];
foreach($rows as $r){
    $valid=is_numeric($r['loc_lat'])&&is_numeric($r['loc_lng'])&&abs((float)$r['loc_lat'])<=90&&abs((float)$r['loc_lng'])<=180;
    $has=static fn($k)=>trim((string)($r[$k]??''))!=='';
    $category=$has('loc_street')&&$has('loc_housenumber')&&$has('loc_plz')&&$has('loc_city')?'full':($has('loc_street')?'partial_street':($has('loc_plz')||$has('loc_city')?'place_only':'no_address'));
    foreach(['all',((int)$r['aktiv']===1?'active':'inactive_or_orphan')] as $scope){
        $summary[$scope]['total']=($summary[$scope]['total']??0)+1;
        $key=$valid?'coordinates':'missing_coordinates';$summary[$scope][$key]=($summary[$scope][$key]??0)+1;
        if(!$valid)$summary[$scope][$category]=($summary[$scope][$category]??0)+1;
    }
    if(!$valid)$missing[]=array_merge($r,['address_category'=>$category,'online_only'=>in_array((int)$r['dr_id'],LCN_VERIFIED_ONLINE_ONLY_DOCTOR_IDS,true)]);
}
$noLocation=$pdo->query('SELECT e.lcn_id,e.anzeigename,e.datensatztyp FROM tbl_entities_nd e LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=e.lcn_id WHERE e.aktiv=1 AND l.loc_id IS NULL')->fetchAll();
$pdo->rollBack();
$result=['profile'=>lcnDatabaseProfile(),'summary'=>$summary,'active_entities_without_location'=>$noLocation,'missing'=>$missing];
file_put_contents(__DIR__.'/location-audit.json',json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
echo json_encode(['profile'=>$result['profile'],'summary'=>$summary,'active_entities_without_location'=>$noLocation],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
