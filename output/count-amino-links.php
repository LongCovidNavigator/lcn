<?php
require __DIR__.'/../api/_treatments_nd.php';require __DIR__.'/../api/_treatment_discovery.php';
$g=lcnTreatmentDiscoveryGraph(lcnDoctorDatabase());
foreach([918,144] as $id){$members=[];foreach($g['groups'] as $group)if($group['root']===$id)foreach($group['members'] as $child)$members[$child]=['id'=>$child,'name'=>$g['entries'][$child]['treatmentname'],'relation'=>lcnGroupMemberRelation($group,$child)];echo json_encode(['id'=>$id,'name'=>$g['entries'][$id]['treatmentname'],'direct_count'=>count($members),'members'=>array_values($members)],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;}
