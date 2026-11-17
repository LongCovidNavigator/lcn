<?php
require __DIR__.'/../api/_treatments_nd.php';require __DIR__.'/../api/_treatment_discovery.php';require __DIR__.'/../components/treatment_relationship_stages.php';
$p=lcnDoctorDatabase();$pairs=[[625,624],[627,626],[636,637]];
$backup=lcnNdRows($p,'SELECT a.*,c.id AS coupling_id,c.treat_nd_id,c.relation_type,c.note FROM tbl_aliases_03 a LEFT JOIN tbl_cpl_treatments_nd2aliases c ON c.alias_id=a.alias_id WHERE a.alias IN (?,?,?)',['EGCG','Oligomere Proanthocyanidine (OPC)','Sulforaphan']);
$path=__DIR__.'/extract-variant-backup-'.date('Ymd-His').'.json';if(file_put_contents($path,json_encode($backup,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT))===false)throw new RuntimeException('Backup failed');
$p->beginTransaction();try{
$g=lcnTreatmentDiscoveryGraph($p);
foreach($pairs as [$base,$child]){
$name=$g['entries'][$base]['treatmentname'];$aliases=lcnNdRows($p,"SELECT alias_id FROM tbl_aliases_03 WHERE alias=? AND alias_type='umbrella_term'",[$name]);
if(count($aliases)>1)throw new RuntimeException('Ambiguous alias');
if($aliases)$aid=(int)$aliases[0]['alias_id'];else{$p->prepare("INSERT INTO tbl_aliases_03(alias,alias_type) VALUES (?,'umbrella_term')")->execute([$name]);$aid=(int)$p->lastInsertId();}
foreach([[$base,'reference'],[$child,'substance_variant']] as [$id,$type]){
$existing=lcnNdRows($p,'SELECT relation_type FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=? AND treat_nd_id=?',[$aid,$id]);
if($existing){if($existing[0]['relation_type']!==null&&$existing[0]['relation_type']!==$type)throw new RuntimeException('Conflicting relationship');$p->prepare('UPDATE tbl_cpl_treatments_nd2aliases SET relation_type=? WHERE alias_id=? AND treat_nd_id=?')->execute([$type,$aid,$id]);}
else $p->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,relation_type) VALUES (?,?,?)')->execute([$id,$aid,$type]);
}}
$g=lcnTreatmentDiscoveryGraph($p);
foreach($pairs as [$base,$child])foreach([$base,$child] as $id){$m=ndRelationshipStages($g,$id);if(!isset($m['stages'][1]['nodes'][$base]))throw new RuntimeException('Base not in middle');$found=false;foreach($m['stages'][2]['blocks'] as $b)if(isset($b['nodes'][$child])&&$b['add']['kind']==='has_variant')$found=true;if(!$found)throw new RuntimeException('Extract missing on right');}
$p->commit();echo "Verified 3 extract relationships on all 6 pages.\n";
}catch(Throwable $e){if($p->inTransaction())$p->rollBack();throw $e;}
