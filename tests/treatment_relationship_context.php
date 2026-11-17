<?php
require __DIR__.'/../api/_treatments_nd.php';require __DIR__.'/../api/_treatment_discovery.php';require __DIR__.'/../components/treatment_relationship_stages.php';
if(!function_exists('ndEscape')){function ndEscape($s){return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}}
function check($condition,$message){if(!$condition)throw new Exception($message);}
$g=lcnTreatmentDiscoveryGraph(lcnTreatmentsNdDatabase());$variants=[];$feedback=0;$classifications=0;
foreach($g['entries'] as $id=>$entry){
 $m=ndRelationshipStages($g,$id);$expected=[];$rendered=[];
 foreach($m['stages'] as $stage){$nodes=array_values($stage['nodes']??[]);foreach($stage['blocks']??[] as $b)$nodes=array_merge($nodes,array_values($b['nodes']));foreach($nodes as $n)foreach($n['assertions']??[] as $key=>$a)if($a['parent']===$id||$a['child']===$id)$expected[$key]=true;}
 $doc=new DOMDocument();@$doc->loadHTML('<?xml encoding="utf-8" ?>'.ndRenderRelationshipStages($g,$id));$x=new DOMXPath($doc);
 $current=$x->query('//*[@aria-current="page"]');check($current->length===1,"Current marker $id");$current=$current->item(0);
 check($x->query('.//*[@data-treatment-relation-feedback]',$current)->length===0,"Current entry repeats link votes $id");
 foreach($x->query('//*[@data-stage-node]') as $node){$votes=$x->query('.//*[@data-treatment-relation-feedback]',$node);check($votes->length<=1,"Multiple vote pairs $id");foreach($votes as $vote){$key=$vote->getAttribute('data-treatment-relation-feedback');$rendered[$key]=true;$a=ndRelationshipAssertion($g,$key);check($a['parent']===$id||$a['child']===$id,"Unrelated vote $id/$key");check($a['parent']===(int)$node->getAttribute('data-stage-node')||$a['child']===(int)$node->getAttribute('data-stage-node'),"Wrong host $id/$key");check($vote->getAttribute('data-feedback-statement')===$a['statement'],"Incorrect tooltip statement $id/$key");$feedback++;}}
 check(!array_diff_key($expected,$rendered)&&!array_diff_key($rendered,$expected),"Missing direct relationship $id");
 foreach($x->query('//*[@data-stage-classification]') as $host){check((int)$host->getAttribute('data-stage-classification')===$id,"Classification of unrelated entry $id");$roles=$m['drug']?['group','ingredient','brand']:['therapy_group','therapy','detailed_method','substance','substance_variant','application_form','combination'];check(in_array($host->getAttribute('data-classification-current'),$roles,true),"Invalid role $id");$classifications++;}
 foreach($x->query('//*[@data-treatment-relation-add]') as $add)check((int)$add->getAttribute('data-source-id')===$id,"Add affects unrelated entry $id");
 $level=$current->getAttribute('data-node-level');$variant=($m['drug']?'medication':'other').'/'.$level.'/'.implode('|',array_column($m['stages'],'title'));$variants[$variant]=($variants[$variant]??0)+1;
}
echo 'PASS '.count($g['entries'])." entries: one current marker, at most one vote pair per card, only direct relationships, exact tooltip statements, own classification and own additions.\n";
echo "PASS $feedback relationship controls, $classifications classification controls, ".count($variants)." distinct variants.\n";

