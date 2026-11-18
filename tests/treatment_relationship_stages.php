<?php
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_discovery.php';
require_once __DIR__.'/../components/treatment_relationship_stages.php';
$g=lcnTreatmentDiscoveryGraph(lcnTreatmentsNdDatabase());
foreach($g['entries'] as $id=>$entry){$m=ndRelationshipStages($g,$id);$current=[];if(count($m['stages'])!==3)throw new Exception('Not three stages: '.$id);foreach([0,1] as $level)foreach($m['stages'][$level]['nodes'] as $n)if($n['current'])$current[]=$n['id'];foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)if($n['current'])$current[]=$n['id'];if($current!==[$id])throw new Exception('Wrong current entry '.json_encode([$id,$current]));foreach($m['stages'][1]['adds'] as $a)if($a['kind']==='group_contains'){if(!$a['group'])throw new Exception('Missing group context: '.$id);$root=$g['groups'][$a['group']]['root'];if(!$root||!isset($m['stages'][0]['nodes'][$root]))throw new Exception('Group action without visible group: '.$id);}if(!empty($m['stages'][0]['nodes'][$id]['current'])){if($m['stages'][0]['adds'])throw new Exception('Group action in current stage: '.$id);}elseif(!$m['stages'][0]['adds'])throw new Exception('Missing parent group action: '.$id);if(!empty($m['stages'][1]['nodes'][$id]['current'])&&$m['stages'][1]['adds'])throw new Exception('Sibling action in current stage: '.$id);if(!$m['stages'][2]['blocks'])throw new Exception('Missing third-stage action: '.$id);}
foreach([169=>0,84=>1,693=>2,271=>0,770=>1,869=>1,65=>2,64=>2,717=>2] as $id=>$expected){$m=ndRelationshipStages($g,$id);$found=false;if($expected<2){foreach($m['stages'][$expected]['nodes'] as $n)if($n['current'])$found=true;}else foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)if($n['current'])$found=true;if(!$found)throw new Exception('Unstable role '.$id);}
$m=ndRelationshipStages($g,63);$heads=array_column($m['stages'][2]['blocks'],'heading');if(!in_array('Stoffvarianten',$heads)||!in_array('Applikation',$heads))throw new Exception('Magnesium relations mixed');
$m=ndRelationshipStages($g,65);foreach($m['stages'][2]['blocks'] as $b)if($b['heading']==='Handelsnamen'&&isset($b['nodes'][65]))throw new Exception('NAD form treated as brand');
foreach([64,65,717] as $id){
 $m=ndRelationshipStages($g,$id);$base=null;
 foreach($g['groups'] as $group)if(isset($group['members'][$id])&&in_array(lcnGroupMemberRelation($group,$id),['application_form','substance_variant'],true))$base=$group['root'];
 if(!$base||!isset($m['stages'][1]['nodes'][$base]))throw new Exception('Substance missing in middle: '.$id);
 foreach($m['edges'] as [$from,$parent,$to,$child])if($to===2&&$child===$id&&($from!==1||$parent!==$base))throw new Exception('Wrong form parent: '.$id);
 if($id===64){$peers=[];foreach($m['stages'][2]['blocks'] as $b)foreach($b['nodes'] as $n)$peers[]=$n['name'];foreach(['NAD⁺ (oral)','NAD⁺ (subkutan)'] as $peer)if(!in_array($peer,$peers))throw new Exception('Missing peer '.$peer);}
}
echo 'PASS '.count($g['entries']).' entries: three stages, exactly one current entry, stable roles, addition controls and separate form/variant blocks.'.PHP_EOL;
