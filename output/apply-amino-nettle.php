<?php
require __DIR__.'/../api/_treatments_nd.php';require __DIR__.'/../api/_treatment_discovery.php';require __DIR__.'/../components/treatment_relationship_stages.php';
$p=lcnDoctorDatabase();$backup=lcnNdRows($p,'SELECT * FROM tbl_cpl_treatments_nd2aliases WHERE alias_id IN (1346,1578,1826)');file_put_contents(__DIR__.'/amino-nettle-backup-'.date('Ymd-His').'.json',json_encode($backup,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
$p->beginTransaction();try{
$old=lcnNdRows($p,'SELECT relation_type FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=1346 AND treat_nd_id=720');if(count($old)!==1||$old[0]['relation_type']!==null)throw new RuntimeException('Unexpected AXA relationship');
$p->exec('DELETE FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=1346 AND treat_nd_id=720 AND relation_type IS NULL');
$existing=lcnNdRows($p,'SELECT relation_type FROM tbl_cpl_treatments_nd2aliases WHERE alias_id=1578 AND treat_nd_id=720');
if(!$existing)$p->exec("INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,relation_type) VALUES (720,1578,'group_member')");elseif($existing[0]['relation_type']!=='group_member')throw new RuntimeException('Conflicting AXA group');
$s=$p->prepare("UPDATE tbl_cpl_treatments_nd2aliases SET relation_type='substance_variant' WHERE alias_id=1826 AND treat_nd_id=631 AND relation_type='group_member'");$s->execute();if($s->rowCount()!==1)throw new RuntimeException('Unexpected nettle relationship');
$g=lcnTreatmentDiscoveryGraph($p);
foreach([918,720] as $id){$m=ndRelationshipStages($g,$id);if(!isset($m['stages'][0]['nodes'][918],$m['stages'][1]['nodes'][720]))throw new RuntimeException('AXA layout failed');}
foreach([784,631] as $id){$m=ndRelationshipStages($g,$id);if(!isset($m['stages'][1]['nodes'][784]))throw new RuntimeException('Nettle base missing');$found=false;foreach($m['stages'][2]['blocks'] as $b)if(isset($b['nodes'][631])&&$b['add']['kind']==='has_variant')$found=true;if(!$found)throw new RuntimeException('Nettle extract missing');}
$p->commit();echo "Verified: AXA1125 in Aminosäuren; Brennnessel in middle and Nesselextrakt on right, on all four pages.\n";
}catch(Throwable $e){if($p->inTransaction())$p->rollBack();throw $e;}
