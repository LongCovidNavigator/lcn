<?php
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_discovery.php';
require_once __DIR__.'/../components/treatment_relationship_stages.php';
function couplingCheck(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
// A renamed alias and arbitrary child names must still resolve only via saved coupling types.
$rows=[];
foreach([[1,'Basis','reference'],[2,'Beliebige Darreichung','application_form'],[3,'Andere Verbindung','substance_variant'],[4,'Basis (oral) Sonderfall',null]] as [$id,$name,$relation])
 $rows[]=['treat_nd_id'=>$id,'treatmentname'=>$name,'typ'=>'Nahrungsergänzungsmittel','alias_id'=>10,'alias'=>'Abweichender Aliasname','alias_type'=>'umbrella_term','member_relation_type'=>$relation];
$g=lcnBuildTreatmentDiscoveryGraph($rows);$group=$g['groups'][10];
couplingCheck($group['root']===1,'Saved reference ignored');
couplingCheck(lcnGroupMemberRelation($group,2)==='application_form'&&lcnGroupMemberRelation($group,3)==='substance_variant','Mixed relationship types lost');
couplingCheck(lcnGroupMemberRelation($group,4)==='unspecified','Oral keyword incorrectly classified');
$m=ndRelationshipStages($g,1);$blocks=[];foreach($m['stages'][2]['blocks'] as $b)$blocks[$b['heading']]=array_keys($b['nodes']);
couplingCheck($blocks['Anwendungsformen']===[2]&&$blocks['Stoffvarianten']===[3]&&$blocks['Zugeordnete Einträge (Art offen)']===[4],'Display guessed or mixed relationship types');
couplingCheck(str_contains(ndRelationshipAssertion($g,'ag:10:t:2')['statement'],'Anwendungsform'),'Feedback lost specific meaning');
$p=lcnTreatmentsNdDatabase();$g=lcnTreatmentDiscoveryGraph($p);
$combination=ndRelationshipStages($g,397);
couplingCheck($combination['stages'][1]['title']==='Therapie / Verfahren','Supplement combination must remain a normal therapy');
couplingCheck(!in_array('Stoffvarianten',array_column($combination['stages'][2]['blocks'],'heading'),true)&&!in_array('Anwendungsformen',array_column($combination['stages'][2]['blocks'],'heading'),true),'Empty substance blocks invented for a combination');
foreach($g['groups'] as $group){
 if($group['name']==='Psychotherapie')couplingCheck(lcnGroupMemberRelation($group,515)==='group_member','EMDR must be group member, not detailed method');
 if($group['name']==='Magnesium')foreach($group['members'] as $id){$name=$g['entries'][$id]['treatmentname'];couplingCheck(lcnGroupMemberRelation($group,$id)===($name==='Magnesium-Infusion'?'application_form':'substance_variant'),'Magnesium coupling not explicit');}
}
foreach($g['entries'] as $id=>$entry){$m=ndRelationshipStages($g,$id);$current=0;foreach($m['stages'] as $stage){foreach($stage['nodes']??[] as $n)$current+=(int)$n['current'];foreach($stage['blocks']??[] as $b)foreach($b['nodes'] as $n)$current+=(int)$n['current'];}couplingCheck($current===1,'Missing or duplicate current entry: '.$id);}
// Search does not depend on the additional relationship metadata.
$terms=['H1-Antihistaminika','Cetirizin','Psychotherapie','EMDR','Magnesium','NAD','Cromoglicinsäure','Allergoval','Aripiprazol'];
$before=[];foreach($terms as $term)$before[$term]=array_column(lcnNdSearch($p,$term),'treat_nd_id');
$p->beginTransaction();try{
 $p->exec('UPDATE tbl_cpl_treatments_nd2aliases SET relation_type=NULL');
 foreach($terms as $term)couplingCheck($before[$term]===array_column(lcnNdSearch($p,$term),'treat_nd_id'),'Search changed: '.$term);
}finally{$p->rollBack();}
echo 'PASS: explicit references, mixed coupling types, no keyword guesses, EMDR membership, '.count($g['entries']).' diagrams, unchanged ND search; search test rolled back.'.PHP_EOL;
