<?php
require __DIR__.'/../api/_treatments_nd.php';require __DIR__.'/../api/_treatment_discovery.php';require __DIR__.'/../components/treatment_relationship_stages.php';
$g=lcnTreatmentDiscoveryGraph(lcnDoctorDatabase());$pairs=[];$pages=[];
foreach($g['entries'] as $id=>$e){$m=ndRelationshipStages($g,$id);foreach($m['stages'] as $s){$nodes=array_values($s['nodes']??[]);foreach($s['blocks']??[] as $b)$nodes=array_merge($nodes,array_values($b['nodes']));foreach($nodes as $n)if(!empty($n['open_parent'])){$parent=$n['open_parent'];$pairs[$parent.':'.$n['id']]=['parent'=>$g['entries'][$parent]['treatmentname'],'child'=>$n['name']];$pages[$id]=$e['treatmentname'];}}}
echo json_encode(['entries_checked'=>count($g['entries']),'open_connections'=>array_values($pairs),'affected_pages'=>$pages],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
