<?php
require_once __DIR__.'/../api/_treatments_nd.php';require_once __DIR__.'/../api/_treatment_discovery.php';require_once __DIR__.'/../components/treatment_relationship_stages.php';
$p=lcnTreatmentsNdDatabase();$g=lcnTreatmentDiscoveryGraph($p);$checked=0;
foreach($g['entries'] as $id=>$entry){$m=ndRelationshipStages($g,$id);$actual=[];
 foreach([0,1] as $level)foreach($m['stages'][$level]['nodes'] as $n)foreach($n['assertions']??[] as $a)$actual[$a['key']]=$a;
 foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)foreach($n['assertions']??[] as $a)$actual[$a['key']]=$a;
 $expected=[];foreach($m['edges'] as [$from,$parent,$to,$child])if($from===0){foreach($g['groups'] as $group)if($group['root']===$parent&&isset($group['members'][$child]))$expected['ag:'.$group['alias_id'].':t:'.$child]=true;if(isset($g['bases'][$child][$parent]))$expected['bs:'.$child.':'.$parent]=true;}
 foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)if($n['feedback'])$expected[$n['feedback']]=true;
 if(array_diff_key($expected,$actual)||array_diff_key($actual,$expected))throw new Exception('Missing or unrelated feedback on page '.$id);
 foreach($actual as $a){lcnValidateTreatmentDiscoveryFeedback($p,$a['key'],$g);if(!str_contains($a['statement'],$g['entries'][$a['child']]['treatmentname']))throw new Exception('Statement missing target');if($a['parent']&&!str_contains($a['statement'],$g['entries'][$a['parent']]['treatmentname']))throw new Exception('Statement missing source');$checked++;}
 if($id===770&&count($actual)!==3)throw new Exception('Wim Hof must have three separately named group links');
}
echo "PASS ".count($g['entries'])." pages: $checked relationship assertions have valid keys, both endpoint names, full coverage, no unrelated feedback.\n";
