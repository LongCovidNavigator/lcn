<?php
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_discovery.php';
require_once __DIR__.'/../components/treatment_relationship_stages.php';
$g=lcnTreatmentDiscoveryGraph(lcnTreatmentsNdDatabase());
foreach($g['entries'] as $id=>$entry){$m=ndRelationshipStages($g,$id);$current=[];if(count($m['stages'])!==3)throw new Exception('Not three stages: '.$id);foreach([0,1] as $level)foreach($m['stages'][$level]['nodes'] as $n)if($n['current'])$current[]=$n['id'];foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)if($n['current'])$current[]=$n['id'];if($current!==[$id])throw new Exception('Wrong current entry '.json_encode([$id,$current]));if(!$m['stages'][1]['adds'])throw new Exception('Missing middle-stage action: '.$id);if(!$m['stages'][0]['adds'])throw new Exception('Missing group action: '.$id);if(!$m['stages'][2]['blocks'])throw new Exception('Missing third-stage action: '.$id);}
foreach([169=>0,84=>1,693=>2,271=>0,770=>1,869=>1,65=>1] as $id=>$expected){$m=ndRelationshipStages($g,$id);$found=false;if($expected<2){foreach($m['stages'][$expected]['nodes'] as $n)if($n['current'])$found=true;}else foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)if($n['current'])$found=true;if(!$found)throw new Exception('Unstable role '.$id);}
$m=ndRelationshipStages($g,63);$heads=array_column($m['stages'][2]['blocks'],'heading');if(!in_array('Stoffvarianten',$heads)||!in_array('Anwendungsformen',$heads))throw new Exception('Magnesium relations mixed');
$m=ndRelationshipStages($g,65);if(in_array('Handelsnamen',array_column($m['stages'][2]['blocks'],'heading')))throw new Exception('NAD form treated as brand');
echo 'PASS '.count($g['entries']).' entries: three stages, exactly one current entry, stable roles, addition controls and separate form/variant blocks.'.PHP_EOL;
