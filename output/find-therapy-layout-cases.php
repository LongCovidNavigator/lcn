<?php
require __DIR__.'/../api/_treatments_nd.php';
require __DIR__.'/../api/_treatment_discovery.php';
require __DIR__.'/../components/treatment_relationship_stages.php';
$g=lcnTreatmentDiscoveryGraph(lcnDoctorDatabase());$rows=[];
foreach($g['entries'] as $id=>$e){$s=ndRelationshipStages($g,$id);$rows[]=['id'=>$id,'name'=>$e['treatmentname'],'type'=>$e['typ'],'columns'=>array_column($s['stages'],'title'),'blocks'=>array_values(array_unique(array_column($s['stages'][2]['blocks'],'heading'))),'parents'=>count($s['stages'][0]['nodes']),'middle'=>count($s['stages'][1]['nodes']),'role'=>lcnTreatmentAliasNavigation($g,$id)['role'],'combination'=>isset($g['comboIds'][$id]),'parts'=>array_values($g['components'][$id]??[]),'partNames'=>array_values($g['componentNames'][$id]??[]),'incomplete'=>!empty($g['componentIncomplete'][$id]),'combinations'=>array_values($g['combinations'][$id]??[])];}
file_put_contents(__DIR__.'/therapy-layout-cases.json',json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));echo count($rows).' entries exported';

